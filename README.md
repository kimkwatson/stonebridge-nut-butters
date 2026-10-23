# Stonebridge Nut Butters

A small Express + EJS storefront. No database, bundler, framework frontend, or payment processing.

## Run locally

Install Node.js 20 or newer. In this folder run:

```sh
npm install
npm run dev
```

Open http://localhost:3000. Use `npm start` without automatic restarts. Set `PORT` to change the port.

## Where to edit

- `data/products.json`: flavor names, descriptions, ingredients, featured status, size IDs, and prices. Prices are integer US cents (800 = $8). Keep product IDs and size IDs unique and stable, since saved baskets reference them. Restart the server after changing this file (dev mode does this automatically).
- `views/`: homepage, shop, product detail, about, FAQ, cart, and 404 pages.
- `views/partials/`: shared header, footer, product card, and illustrated jar placeholder.
- `public/css/styles.css`: colors at the top, followed by layout and responsive styles.
- `public/js/cart.js`: browser cart behavior, localStorage persistence, validation, and basket count.
- `public/images/`: supplied watercolor artwork. Other supplied images remain available in their original locations.
- `server.js`: page routes and read-only catalog endpoint.
- `scripts/build.js`: renders the existing EJS pages to static HTML for Netlify.
- `netlify.toml`: Netlify build command, publish folder, and catalog rewrite.

## Deploy to Netlify

Run `npm run build` to generate `dist/`. Keep editing the source files above; never edit the generated files in dist.

For Git-based deployment, connect this project repository to Netlify. If the repository contains this folder at its root, leave Base directory empty. If the repository contains parent folders, set Base directory to the repository-relative path of this folder (the one with package.json and netlify.toml). The configuration sets Build command to `npm run build` and Publish directory to `dist`. No secrets or environment variables are needed for the current storefront.

For a manual deployment, run `npm run build` and upload the generated `dist` folder. The build includes a `_redirects` file so the catalog works with manual uploads too. Git-based deployment is recommended so future source edits rebuild automatically.

EJS runs at build time on Netlify; Express still runs locally using npm start or npm run dev. The hosted cart uses the same public catalog and browser storage. Product edits need a new deployment. No live Express backend is deployed in this static version. Future Stripe checkout will require a serverless function that validates items and prices on the server, plus verified webhooks and order storage.

All flavors, recipes, prices, policies, and story copy are starter content. Confirm the ingredient and allergen information, shelf life, shipping, and business policies before launch. The illustrations are branding assets, not photographs of products.

## Replace jar placeholders with product photos

Add a photo to `public/images/`, then add an `image` field such as `/images/classic.jpg` to each product in the JSON file. Replace the contents of `views/partials/jar.ejs` with:

```ejs
<img class="product-photo" src="<%= product.image %>" alt="<%= product.name %>">
```

Add `.product-photo { width: 100%; aspect-ratio: 1; object-fit: cover; }` to the CSS. That shared partial controls all product cards and the product detail image. The cart uses a small generic watercolor; update its image assignment in `cart.js` if desired.

## Cart decisions

The cart stores only product ID, size ID, and quantity. Each product/size combination gets a separate line. Quantities are whole numbers from 1 to 99 per line; the count is the total number of jars. Invalid, obsolete, or malformed saved entries are discarded. Tabs in the same browser stay in sync. If storage is blocked, the cart can still work during the current page visit but will not persist through navigation.

Browser totals are previews only. localStorage is editable and never a trusted source for checkout. No customer or payment data is collected.

## Stripe later

Add an Express POST endpoint for checkout. Accept identifiers and quantities only, validate them against the server catalog, derive prices and currency on the server, and create the Stripe Checkout Session using a secret key stored in environment variables. Never accept a browser price or total. Verify Stripe webhook signatures and use successful payment events to fulfill orders. Durable order storage and webhook idempotency will be needed when real orders are enabled. Do not put secret keys in browser code or JSON data.

## Checks

`npm test` checks rendered routes, catalog consistency, static assets, and missing products using Node's built-in test runner. No additional test dependency is needed.

For manual browser checks: add both sizes of a flavor, add another flavor, change quantities, remove an item, refresh, and open a second tab. Confirm the count and subtotal. Check narrow screens and keyboard navigation. Checkout is intentionally disabled.
