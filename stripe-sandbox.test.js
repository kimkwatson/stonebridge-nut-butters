const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHandler } = require('./lib/stripe-sandbox');
const env = { ENABLE_STRIPE_SANDBOX: 'true', STRIPE_SECRET_KEY: 'sk_test_placeholder', SITE_URL: 'https://stonebridgenutbutters.com' };
const event = items => ({ httpMethod: 'POST', headers: { origin: env.SITE_URL, 'content-type': 'application/json' }, body: JSON.stringify({ items, fulfillment: { method: 'pickup' } }) });
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
  assert.equal(params.get('line_items[0][price_data][unit_amount]'), '1000');
  assert.equal(params.get('line_items[0][quantity]'), '2');
  assert.equal([...params.keys()].some(key => key.startsWith('payment_method_types')), false);
  assert.match(params.get('success_url'), /^https:\/\/stonebridgenutbutters.com\/confirmation\/\?session_id=/);
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
    assert.deepEqual(JSON.parse(result.body), { paid: payment_status === 'paid', sandbox: true });
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

test('confirmation summary uses Stripe line items and totals without disclosing customer details', async () => {
  const paths = [];
  const handler = createHandler('summary', env, async url => {
    paths.push(url);
    return { ok: true, json: async () => url.includes('/line_items?') ? {
      data: [{ description: 'Classic Peanut Butter — 8 oz jar', quantity: 2, amount_total: 1600 }], has_more: false
    } : {
      id: 'cs_test_example', livemode: false, status: 'complete', payment_status: 'paid', metadata: { store: 'stonebridge-sandbox' },
      currency: 'usd', amount_subtotal: 1600, amount_total: 1600, total_details: {}, customer_email: 'private@example.com'
    } };
  });
  const response = await handler({ httpMethod: 'GET', queryStringParameters: { session_id: 'cs_test_example' } });
  const summary = JSON.parse(response.body);
  assert.equal(response.statusCode, 200);
  assert.equal(summary.total, 1600);
  assert.equal(summary.items[0].quantity, 2);
  assert.equal(summary.items[0].total, 1600);
  assert.equal(summary.reference, 'cs_test_example');
  assert.equal(summary.sandbox, true);
  assert.match(paths[1], /line_items\?limit=100$/);
  assert.doesNotMatch(response.body, /private@example.com|customer_email/);
});
test('unpaid and expired sessions never return a purchased-items summary', async () => {
  let requests = 0;
  const handler = createHandler('summary', env, async () => {
    requests++;
    return { ok: true, json: async () => ({ livemode: false, status: 'expired', payment_status: 'unpaid', metadata: { store: 'stonebridge-sandbox' } }) };
  });
  const response = await handler({ httpMethod: 'GET', queryStringParameters: { session_id: 'cs_test_example' } });
  assert.deepEqual(JSON.parse(response.body), { paid: false, status: 'expired' });
  assert.equal(requests, 1);
});
test('line-item failures cannot produce a false confirmation summary', async () => {
  const handler = createHandler('summary', env, async url => ({ ok: !url.includes('/line_items?'), json: async () => ({ livemode: false, status: 'complete', payment_status: 'paid', metadata: { store: 'stonebridge-sandbox' } }) }));
  const response = await handler({ httpMethod: 'GET', queryStringParameters: { session_id: 'cs_test_example' } });
  assert.equal(response.statusCode, 502);
});

test('all six approved jar prices come from the catalog', () => {
  const catalog = require('./data/products.json');
  assert.equal(catalog.length, 3);
  assert.deepEqual(catalog.map(p => p.sizes.map(s => [s.id, s.price])), [
    [['4oz', 600], ['8oz', 1000]], [['4oz', 900], ['8oz', 1500]], [['4oz', 1000], ['8oz', 1700]]
  ]);
});
test('Arizona shipping is fixed at 795 cents and pickup at zero regardless of submitted fee', async () => {
  for (const method of ['shipping', 'pickup']) {
    let params;
    const handler = createHandler('create', env, async (url, options) => {
      params = new URLSearchParams(options.body);
      return { ok: true, json: async () => ({ id: 'cs_test_example', livemode: false, url: 'https://checkout.stripe.com/c/pay/cs_test_example' }) };
    });
    const fulfillment = { method, fee: 0, name: 'Test Recipient', address: { line1: '123 Test Street', city: 'Mesa', state: 'AZ', postalCode: '85201' } };
    const response = await handler({ ...event([item]), body: JSON.stringify({ items: [item], fulfillment }) });
    assert.equal(response.statusCode, 200);
    assert.equal(params.get('shipping_options[0][shipping_rate_data][fixed_amount][amount]'), method === 'shipping' ? '795' : '0');
    assert.equal(params.get('metadata[fulfillment]'), method);
    assert.equal(params.get('payment_intent_data[shipping][address][state]'), method === 'shipping' ? 'AZ' : null);
    assert.equal(params.has('shipping_address_collection[allowed_countries][0]'), false);
  }
});
test('invalid destinations and absent fulfillment are rejected before Stripe', async () => {
  const handler = createHandler('create', env, async () => assert.fail('Must not call Stripe'));
  for (const fulfillment of [undefined, { method: 'unknown' }, { method: 'shipping' }, { method: 'shipping', name: 'Test', address: { line1: 'Test', city: 'Test', state: 'CA', postalCode: '90001' } }]) {
    const response = await handler({ ...event([item]), body: JSON.stringify({ items: [item], fulfillment }) });
    assert.equal(response.statusCode, 400);
  }
});

const liveEnv = { STRIPE_MODE: 'live', ENABLE_LIVE_PAYMENTS: 'true', STRIPE_SECRET_KEY: 'sk_live_placeholder', SITE_URL: env.SITE_URL };
test('live payments require explicit activation and a matching live key', async () => {
  const fail = async () => assert.fail('Must not call Stripe');
  for (const settings of [
    { ...liveEnv, ENABLE_LIVE_PAYMENTS: 'false' },
    { ...liveEnv, STRIPE_SECRET_KEY: 'sk_test_placeholder' },
    { ...env, STRIPE_MODE: 'sandbox', STRIPE_SECRET_KEY: 'sk_live_placeholder' },
    { ...liveEnv, SITE_URL: 'http://localhost:3000' }
  ]) assert.equal((await createHandler('create', settings, fail)(event([item]))).statusCode, 503);
});
test('live checkout preserves prices, fulfillment metadata, and idempotent retry headers', async () => {
  const requests = [];
  const handler = createHandler('create', liveEnv, async (url, options) => {
    requests.push(options);
    return { ok: true, json: async () => ({ id: 'cs_live_example', livemode: true, url: 'https://checkout.stripe.com/c/pay/cs_live_example' }) };
  });
  const attempt = { ...event([item]), body: JSON.stringify({ items: [item], fulfillment: { method: 'pickup' }, attemptId: '550e8400-e29b-41d4-a716-446655440000' }) };
  const response = await handler(attempt);
  await handler(attempt);
  assert.equal(response.statusCode,200);
  assert.equal(JSON.parse(response.body).mode,'live');
  const params = new URLSearchParams(requests[0].body);
  assert.equal(params.get('line_items[0][price_data][unit_amount]'),'1000');
  assert.equal(params.get('metadata[store]'),'stonebridge-live');
  assert.match(params.get('payment_intent_data[metadata][items]'),/Classic Peanut Butter/);
  assert.doesNotMatch(params.get('custom_text[submit][message]'), /Sandbox/);
  assert.equal(requests[0].headers['Idempotency-Key'], requests[1].headers['Idempotency-Key']);
});
test('live mode rejects sandbox sessions before a lookup and mismatched responses after lookup', async () => {
  const handler = createHandler('summary', liveEnv, async () => assert.fail('Must not retrieve sandbox IDs with live key'));
  assert.equal((await handler({httpMethod:'GET',queryStringParameters:{session_id:'cs_test_example'}})).statusCode,400);
  const mismatch = createHandler('create', liveEnv, async () => ({ok:true,json:async()=>({id:'cs_test_example',livemode:false,url:'https://checkout.stripe.com/c/pay/cs_test_example'})}));
  assert.equal((await mismatch(event([item]))).statusCode,502);
});
test('public configuration never returns Stripe credentials', async () => {
  const response = await createHandler('config',liveEnv)({httpMethod:'GET'});
  assert.deepEqual(JSON.parse(response.body),{mode:'live'});
  assert.doesNotMatch(response.body,/sk_live|SECRET_KEY/);
});
test('live confirmation is verified with Stripe and distinguished from sandbox', async () => {
  const handler = createHandler('summary',liveEnv,async url=>({ok:true,json:async()=>url.includes('/line_items?')?{data:[{description:'Classic Peanut Butter — 8 oz jar',quantity:1,amount_total:1000}],has_more:false}:{id:'cs_live_example',livemode:true,status:'complete',payment_status:'paid',metadata:{store:'stonebridge-live',fulfillment:'pickup'},currency:'usd',amount_subtotal:1000,amount_total:1000,total_details:{}}}));
  const response=await handler({httpMethod:'GET',queryStringParameters:{session_id:'cs_live_example'}});
  const summary=JSON.parse(response.body);
  assert.equal(summary.paid,true); assert.equal(summary.sandbox,false); assert.equal(summary.total,1000); assert.equal(summary.fulfillment,'pickup');
});
