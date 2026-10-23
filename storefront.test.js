const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const app = require('./server');
const products = require('./data/products.json');
let server, base;
before(async () => {
  server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  base = 'http://127.0.0.1:' + server.address().port;
});
after(() => new Promise(resolve => server.close(resolve)));
test('all pages and product detail pages render', async () => {
  for (const route of ['/', '/shop', '/about', '/faq', '/cart', ...products.map(p => '/products/' + p.slug)]) {
    const response = await fetch(base + route);
    assert.equal(response.status, 200, route);
    const html = await response.text();
    assert.match(html, /<h1>/);
    assert.match(html, /data-cart-count/);
  }
});
test('unknown products and pages return a rendered 404', async () => {
  for (const route of ['/products/missing', '/missing']) assert.equal((await fetch(base + route)).status, 404);
});
test('catalog has stable unique IDs and valid cent prices', async () => {
  assert.deepEqual(await (await fetch(base + '/api/products')).json(), products);
  assert.equal(new Set(products.map(p => p.id)).size, products.length);
  assert.equal(new Set(products.map(p => p.slug)).size, products.length);
  for (const product of products) {
    assert.equal(new Set(product.sizes.map(s => s.id)).size, product.sizes.length);
    for (const size of product.sizes) assert.ok(Number.isInteger(size.price) && size.price > 0);
  }
});
test('browser assets are served', async () => {
  for (const file of ['/css/styles.css', '/js/cart.js', '/images/bridge.png', '/images/butter.png']) assert.equal((await fetch(base + file)).status, 200);
});
