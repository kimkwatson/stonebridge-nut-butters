const express = require('express');
const path = require('node:path');
const products = require('./data/products.json');
const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.locals.money = cents => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
app.locals.products = products;
app.get('/api/products', (req, res) => res.json(products));
app.get('/', (req, res) => res.render('home', { title: 'A little goodness, in every jar', page: 'home' }));
app.get('/shop', (req, res) => res.render('shop', { title: 'The nut butter pantry', page: 'shop' }));
app.get('/products/:slug', (req, res, next) => {
  const product = products.find(item => item.slug === req.params.slug);
  if (!product) return next();
  res.render('product', { title: product.name, page: 'shop', product });
});
for (const page of ['about', 'faq', 'cart']) {
  app.get('/' + page, (req, res) => res.render(page, { title: {about: 'Our story', faq: 'A few good questions', cart: 'Your basket'}[page], page }));
}
app.use((req, res) => res.status(404).render('404', { title: 'Page not found', page: '' }));
if (require.main === module) app.listen(process.env.PORT || 3000, () => console.log('Stonebridge is ready at http://localhost:' + (process.env.PORT || 3000)));
module.exports = app;
