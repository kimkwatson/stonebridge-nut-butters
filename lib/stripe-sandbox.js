const products = require('../data/products.json');

class CheckoutError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const reply = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body)
});

function configuration(env) {
  if (env.ENABLE_STRIPE_SANDBOX !== 'true' || !/^(sk|rk)_test_/.test(env.STRIPE_SECRET_KEY || '')) {
    throw new CheckoutError(503, 'Sandbox checkout is not configured yet. No payment was started.');
  }
  let site;
  try { site = new URL(env.SITE_URL); } catch { throw new CheckoutError(503, 'Checkout site URL is not configured.'); }
  if (site.protocol !== 'https:' && !(site.protocol === 'http:' && site.hostname === 'localhost')) {
    throw new CheckoutError(503, 'Checkout requires a secure site URL.');
  }
  return { key: env.STRIPE_SECRET_KEY, origin: site.origin };
}

function lineItems(items) {
  if (!Array.isArray(items) || !items.length || items.length > 32) throw new CheckoutError(400, 'Add a jar to your basket before checkout.');
  const merged = new Map();
  for (const item of items) {
    const product = products.find(p => p.id === item?.productId);
    const size = product?.sizes.find(s => s.id === item?.sizeId);
    if (!size || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) {
      throw new CheckoutError(400, 'Your basket contains an invalid item or quantity. Please refresh and try again.');
    }
    const id = product.id + ':' + size.id;
    const quantity = (merged.get(id)?.quantity || 0) + item.quantity;
    if (quantity > 99) throw new CheckoutError(400, 'Choose no more than 99 of each jar size.');
    merged.set(id, { name: product.name + ' — ' + size.label, price: size.price, quantity });
  }
  return [...merged.values()];
}

async function stripe(path, config, params, request) {
  const response = await request('https://api.stripe.com/v1/' + path, {
    method: params ? 'POST' : 'GET',
    headers: { Authorization: 'Bearer ' + config.key, ...(params ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
    ...(params ? { body: params.toString() } : {}),
    signal: AbortSignal.timeout(12000)
  });
  if (!response.ok) throw new CheckoutError(502, 'Stripe could not complete this request. Please try again.');
  return response.json();
}

function createHandler(action, env = process.env, request = globalThis.fetch) {
  return async event => {
    try {
      if (event.httpMethod !== (action === 'create' ? 'POST' : 'GET')) return reply(405, { error: 'Method not allowed.' });
      const config = configuration(env);
      if (action === 'create') {
        const headers = Object.fromEntries(Object.entries(event.headers || {}).map(([key, value]) => [key.toLowerCase(), value]));
        if (headers.origin !== config.origin) throw new CheckoutError(403, 'Please start checkout from the Stonebridge website.');
        if (!(headers['content-type'] || '').startsWith('application/json')) throw new CheckoutError(415, 'Checkout requires JSON.');
        if (event.isBase64Encoded || (event.body || '').length > 12000) throw new CheckoutError(400, 'Invalid checkout request.');
        let body;
        try { body = JSON.parse(event.body || ''); } catch { throw new CheckoutError(400, 'Invalid checkout request.'); }
        const items = lineItems(body?.items);
        const params = new URLSearchParams({
          mode: 'payment',
          success_url: config.origin + '/cart/?session_id={CHECKOUT_SESSION_ID}',
          cancel_url: config.origin + '/cart/?checkout=canceled',
          'payment_method_types[0]': 'card',
          'metadata[store]': 'stonebridge-sandbox',
          'custom_text[submit][message]': 'Sandbox test only. No real order will be shipped. Shipping and tax are not included.'
        });
        items.forEach((item, i) => {
          params.set(`line_items[${i}][price_data][currency]`, 'usd');
          params.set(`line_items[${i}][price_data][unit_amount]`, String(item.price));
          params.set(`line_items[${i}][price_data][product_data][name]`, item.name);
          params.set(`line_items[${i}][quantity]`, String(item.quantity));
        });
        const session = await stripe('checkout/sessions', config, params, request);
        if (session.livemode !== false || !session.id?.startsWith('cs_test_') || !session.url?.startsWith('https://checkout.stripe.com/')) {
          throw new CheckoutError(502, 'Stripe did not return a valid sandbox checkout.');
        }
        return reply(200, { url: session.url });
      }
      const id = event.queryStringParameters?.session_id || '';
      if (!/^cs_test_[A-Za-z0-9_]{1,220}$/.test(id)) throw new CheckoutError(400, 'Invalid sandbox checkout reference.');
      const session = await stripe('checkout/sessions/' + encodeURIComponent(id), config, null, request);
      if (session.livemode !== false || session.metadata?.store !== 'stonebridge-sandbox') throw new CheckoutError(404, 'Sandbox checkout not found.');
      return reply(200, { paid: session.status === 'complete' && session.payment_status === 'paid' });
    } catch (error) {
      return reply(error instanceof CheckoutError ? error.status : 502, {
        error: error instanceof CheckoutError ? error.message : 'Checkout is temporarily unavailable. Please try again.'
      });
    }
  };
}

module.exports = { createHandler, lineItems };
