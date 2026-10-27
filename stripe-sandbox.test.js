const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHandler } = require('./lib/stripe-sandbox');
const env = { ENABLE_STRIPE_SANDBOX: 'true', STRIPE_SECRET_KEY: 'sk_test_placeholder', SITE_URL: 'https://stonebridgenutbutters.com' };
const event = items => ({ httpMethod: 'POST', headers: { origin: env.SITE_URL, 'content-type': 'application/json' }, body: JSON.stringify({ items }) });
const item = { productId: 'classic', sizeId: '8oz', quantity: 2 };

test('checkout uses authoritative catalog prices and sandbox return URLs', async () => {
  let params;
  const handler = createHandler('create', env, async (url, options) => {
    assert.equal(url, 'https://api.stripe.com/v1/checkout/sessions');
    params = new URLSearchParams(options.body);
    return { ok: true, json: async () => ({ id: 'cs_test_example', livemode: false, url: 'https://checkout.stripe.com/c/pay/cs_test_example' }) };
  });
  const response = await handler(event([{ ...item, price: 1, name: 'Tampered' }]));
  assert.equal(response.statusCode, 200);
  assert.equal(params.get('line_items[0][price_data][unit_amount]'), '800');
  assert.equal(params.get('line_items[0][quantity]'), '2');
  assert.equal([...params.keys()].some(key => key.startsWith('payment_method_types')), false);
  assert.match(params.get('success_url'), /^https:\/\/stonebridgenutbutters.com\/cart\/\?session_id=/);
});

test('invalid carts, wrong origins, malformed JSON and live keys never reach Stripe', async () => {
  const fail = async () => { assert.fail('Must not call Stripe'); };
  const handler = createHandler('create', env, fail);
  for (const items of [[], [null], [{ ...item, quantity: 1.5 }], [{ ...item, quantity: 0 }], [{ ...item, sizeId: 'fake' }], [{ ...item, quantity: 70 }, { ...item, quantity: 40 }]]) {
    assert.equal((await handler(event(items))).statusCode, 400);
  }
  assert.equal((await handler({ ...event([item]), headers: { origin: 'https://other.example' } })).statusCode, 403);
  assert.equal((await handler({ ...event([item]), body: '{' })).statusCode, 400);
  assert.equal((await createHandler('create', { ...env, STRIPE_SECRET_KEY: 'sk_live_placeholder' }, fail)(event([item]))).statusCode, 503);
  assert.equal((await createHandler('create', { ...env, ENABLE_STRIPE_SANDBOX: 'false' }, fail)(event([item]))).statusCode, 503);
});

test('status confirms only paid completed sessions for this sandbox and exposes no customer data', async () => {
  const statusEvent = { httpMethod: 'GET', queryStringParameters: { session_id: 'cs_test_example' } };
  for (const payment_status of ['paid', 'unpaid']) {
    const handler = createHandler('status', env, async () => ({ ok: true, json: async () => ({ livemode: false, status: 'complete', payment_status, metadata: { store: 'stonebridge-sandbox' }, customer_email: 'private@example.com' }) }));
    const result = await handler(statusEvent);
    assert.deepEqual(JSON.parse(result.body), { paid: payment_status === 'paid' });
  }
  const foreign = createHandler('status', env, async () => ({ ok: true, json: async () => ({ livemode: false, metadata: { store: 'other' } }) }));
  assert.equal((await foreign(statusEvent)).statusCode, 404);
  assert.equal((await foreign({ ...statusEvent, queryStringParameters: { session_id: 'cs_live_example' } })).statusCode, 400);
});

test('Stripe errors do not expose internal API details or secrets', async () => {
  const handler = createHandler('create', env, async () => { throw new Error('private error including API key'); });
  const response = await handler(event([item]));
  assert.equal(response.statusCode, 502);
  assert.doesNotMatch(response.body, /private|API key/);
});
