const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const products = require('./data/products.json');
const { subtractPurchased } = require('./public/js/cart-state');
const item = (quantity, productId = 'classic') => ({ productId, sizeId: '8oz', quantity });
async function returnFromCheckout(paid, stored, snapshot, query = '?session_id=cs_test_example') {
  const values = new Map([['stonebridge-cart-v1', JSON.stringify(stored)]]);
  if (snapshot) values.set('stonebridge-checkout-cs_test_example', JSON.stringify(snapshot));
  const status = { textContent: '' }, button = { addEventListener() {} };
  const context = {
    URL, URLSearchParams, setTimeout, clearTimeout,
    localStorage: { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) },
    document: { querySelectorAll: () => [], querySelector: selector => selector === '#checkout-button' ? button : selector === '#checkout-status' ? status : null },
    window: { StonebridgeCart: { subtractPurchased }, location: { search: query, pathname: '/cart/' }, history: { replaceState() {} }, addEventListener() {} },
    fetch: async url => ({ ok: true, json: async () => url === '/api/products' ? products : { paid } })
  };
  vm.runInNewContext(fs.readFileSync('public/js/cart.js', 'utf8'), context);
  await new Promise(resolve => setImmediate(resolve));
  return { stored: JSON.parse(values.get('stonebridge-cart-v1')), status: status.textContent };
}
test('confirmed payment removes purchased quantities and preserves later additions', async () => {
  const result = await returnFromCheckout(true, [item(3), item(1, 'honey')], [item(2)]);
  assert.deepEqual(result.stored.items, [item(1), item(1, 'honey')]);
  assert.deepEqual(result.stored.settled, ['cs_test_example']);
});
test('a return URL cannot clear an unpaid or canceled basket', async () => {
  assert.deepEqual((await returnFromCheckout(false, [item(2)], [item(2)])).stored, [item(2)]);
  assert.deepEqual((await returnFromCheckout(false, [item(2)], [item(2)], '?checkout=canceled')).stored, [item(2)]);
});
test('revisiting a confirmed payment does not subtract a second time', async () => {
  const saved = { items: [item(3)], settled: ['cs_test_example'] };
  assert.deepEqual((await returnFromCheckout(true, saved, [item(2)])).stored, saved);
});
test('older checkouts without a snapshot leave the current basket untouched', async () => {
  assert.deepEqual((await returnFromCheckout(true, [item(2)])).stored, [item(2)]);
});
