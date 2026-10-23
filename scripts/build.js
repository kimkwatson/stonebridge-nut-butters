// Render the same EJS pages ahead of time for static hosting on Netlify.
const fs = require('node:fs/promises');
const path = require('node:path');
const ejs = require('ejs');
const products = require('../data/products.json');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist');
const money = cents => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD'
}).format(cents / 100);

async function render(template, destination, locals) {
  const html = await ejs.renderFile(path.join(root, 'views', template + '.ejs'), {
    products, money, ...locals
  });
  const file = path.join(output, destination);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, html);
}

async function build() {
  // Delete only this project's generated dist directory, never source files.
  if (path.dirname(output) !== root || path.basename(output) !== 'dist') {
    throw new Error('Unexpected build output path');
  }
  await fs.rm(output, { recursive: true, force: true });
  await fs.mkdir(output, { recursive: true });
  await fs.cp(path.join(root, 'public'), output, { recursive: true });
  const pages = [
    ['home', 'index.html', 'A little goodness, in every jar'],
    ['shop', 'shop/index.html', 'The nut butter pantry'],
    ['about', 'about/index.html', 'Our story'],
    ['faq', 'faq/index.html', 'A few good questions'],
    ['cart', 'cart/index.html', 'Your basket'],
    ['404', '404.html', 'Page not found']
  ];
  for (const [page, destination, title] of pages) {
    await render(page, destination, { title, page });
  }
  for (const product of products) {
    if (!/^[a-z0-9-]+$/.test(product.slug)) throw new Error('Invalid product slug: ' + product.slug);
    await render('product', `products/${product.slug}/index.html`, {
      title: product.name, page: 'shop', product
    });
  }
  // netlify.toml maps /api/products to this public catalog file.
  await fs.writeFile(path.join(output, 'products.json'), JSON.stringify(products));
  // Also support uploading dist directly through Netlify's manual deploy UI.
  await fs.writeFile(path.join(output, '_redirects'), '/api/products /products.json 200\n');
  console.log(`Built ${pages.length + products.length} pages in dist/`);
}

build().catch(error => { console.error(error); process.exitCode = 1; });
