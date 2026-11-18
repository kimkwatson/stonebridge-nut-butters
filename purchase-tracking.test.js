const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const { purchaseData } = require('./lib/ga4-purchase');
const { createHandler } = require('./lib/stripe-sandbox');
const session = { id: 'cs_test_verified', currency: 'usd', amount_total: 2675, total_details: { amount_shipping: 795, amount_tax: 180 } };
const lines = [{ description: 'Classic jar', quantity: 2, amount_total: 1880, amount_tax: 180 }];
const payload = purchaseData(session, lines);
test('Stripe amounts become discounted item revenue, separate shipping and tax in dollars', () => {
  assert.deepEqual(payload, { transaction_id: 'cs_test_verified', currency: 'USD', value: 17, shipping: 7.95, tax: 1.8, items: [{ item_name: 'Classic jar', quantity: 2, price: 8.5 }] });
  assert.equal(purchaseData({ ...session, currency: 'jpy' }, lines), undefined);
});
test('only complete AND paid Stripe sessions expose a purchase payload', async () => {
  for (const status of ['open', 'complete']) for (const payment_status of ['unpaid', 'paid']) {
    const handler = createHandler('summary', { ENABLE_STRIPE_SANDBOX: 'true', STRIPE_SECRET_KEY: 'sk_test_placeholder', SITE_URL: 'https://example.com' }, async url => ({ ok: true, json: async () => url.includes('/line_items?') ? { data: lines, has_more: false } : { ...session, status, payment_status, livemode: false, metadata: { store: 'stonebridge-sandbox' } } }));
    const result = JSON.parse((await handler({ httpMethod: 'GET', queryStringParameters: { session_id: session.id } })).body);
    assert.equal(!!result.purchase, status === 'complete' && payment_status === 'paid');
  }
});
const source = fs.readFileSync('public/js/purchase-tracking.js', 'utf8');
function browser(values = new Map(), search = '') {
  const calls = [];
  const context = { URLSearchParams, localStorage: { getItem: k => values.get(k), setItem: (k,v) => values.set(k,v) }, window: { location: { search }, gtag: (...args) => calls.push(args) } };
  vm.runInNewContext(source, context);
  return { context, calls, track: context.window.StonebridgePurchase.track };
}
const summary = { paid: true, sandbox: false, reference: session.id, purchase: payload };
test('repeated calls, handler registration and refresh send once per transaction', async () => {
  const storage = new Map(); const a = browser(storage);
  await Promise.all([a.track(summary), a.track(summary)]);
  vm.runInNewContext(source, a.context);
  await a.context.window.StonebridgePurchase.track(summary);
  const refreshed = browser(storage); await refreshed.track(summary);
  assert.equal(a.calls.length, 1); assert.equal(refreshed.calls.length, 0);
  assert.equal(a.calls[0][2].send_to, 'G-M571TGWTG8');
});
test('unpaid and sandbox purchases are suppressed; explicit debug enables sandbox', async () => {
  const a = browser(); await a.track({ ...summary, paid: false }); await a.track({ ...summary, sandbox: true }); assert.equal(a.calls.length, 0);
  const debug = browser(new Map(), '?ga_debug=1'); await debug.track({ ...summary, sandbox: true }); assert.equal(debug.calls[0][2].debug_mode, true);
});
test('missing tag can retry later and storage failure retains in-page guard', async () => {
  const a = browser(); const tag = a.context.window.gtag; delete a.context.window.gtag;
  await a.track(summary); a.context.window.gtag = tag;
  a.context.localStorage = { getItem() { throw Error(); }, setItem() { throw Error(); } };
  await a.track(summary); await a.track(summary); assert.equal(a.calls.length, 1);
});

test('a throwing tag leaves no persistent marker and can retry in the same page', async () => {
  const storage = new Map(); const a = browser(storage);
  const tag = a.context.window.gtag;
  a.context.window.gtag = () => { throw new Error('queue unavailable'); };
  await assert.doesNotReject(a.track(summary));
  assert.equal(storage.size, 0);
  a.context.window.gtag = tag;
  await a.track(summary); await a.track(summary);
  assert.equal(a.calls.length, 1);
  assert.equal(storage.get('stonebridge-ga4-purchase-v1-' + session.id), 'queued');
});

test('refresh after a throwing tag can retry, then later refresh is suppressed', async () => {
  const storage = new Map(); const a = browser(storage);
  a.context.window.gtag = () => { throw new Error('queue unavailable'); };
  await a.track(summary);
  const refreshed = browser(storage); await refreshed.track(summary);
  const later = browser(storage); await later.track(summary);
  assert.equal(refreshed.calls.length, 1); assert.equal(later.calls.length, 0);
});

test('memory guard prevents reentrant sends before the persistent marker is saved', async () => {
  const a = browser(); const tag = a.context.window.gtag;
  a.context.window.gtag = (...args) => { a.track(summary); tag(...args); };
  await a.track(summary);
  assert.equal(a.calls.length, 1);
});

test('Web Locks serialize confirmation tabs and release after a queue failure', async () => {
  const storage = new Map(); const a = browser(storage); const b = browser(storage);
  let tail = Promise.resolve();
  const locks = { request: (key, callback) => {
    const result = tail.then(callback); tail = result.catch(() => {}); return result;
  } };
  a.context.window.navigator = b.context.window.navigator = { locks };
  a.context.window.gtag = () => { throw new Error('queue unavailable'); };
  await Promise.all([a.track(summary), b.track(summary)]);
  const c = browser(storage); c.context.window.navigator = { locks };
  await c.track(summary);
  assert.equal(b.calls.length, 1); assert.equal(c.calls.length, 0);
});
