# Stonebridge: Stripe sandbox setup

This update adds test checkout to the sample basket. It cannot accept live keys. Sample prices are validated by the server, not trusted from the browser. No separate Stripe products need to be created.

## Netlify deployment

Deploy the full project through a Git-connected Netlify build, or run `netlify deploy --build` from the project root with the Netlify CLI for a draft deployment. Inspect that draft before running `netlify deploy --build --prod` for production. Select the existing Stonebridge site; do not create a replacement site or change DNS.

Dragging only `dist` into Netlify deploys the static storefront without the payment functions. A regular static folder upload will not install this integration.

Build command: `npm run build`. Publish directory: `dist`. Functions directory: `netlify/functions` (declared in netlify.toml). Node: 22. Functions have no additional dependencies.

## Private environment settings

In the existing Netlify project's environment variables, set these for the deployment context being tested. The Stripe key must be available to Functions at runtime. Redeploy after changes.

| Variable | Value |
| --- | --- |
| `ENABLE_STRIPE_SANDBOX` | `true` |
| `STRIPE_SECRET_KEY` | The sandbox secret key from Stripe, beginning `sk_test_`, or a sandbox restricted key beginning `rk_test_` with Checkout Sessions write/read access and any associated permissions Stripe requires |
| `SITE_URL` | `https://stonebridgenutbutters.com` when testing that domain; for a draft use its exact HTTPS origin instead |

Enter the private key directly in Netlify. Never paste it into chat, source code, or a public environment variable. No publishable key is needed for this hosted Checkout redirect.

Keep `SITE_URL` consistent with the browser address used to test; `www` and the root domain are different origins. For a draft deployment, set its URL in that deploy context and rebuild before testing.

## Test

1. Add sample jars to the basket and click **Try test checkout**.
2. Check that Stripe shows a test environment and the correct quantities and prices.
3. Use test card `4242 4242 4242 4242`, a future expiry, and any three-digit CVC. Use dummy details, never real card details.
4. Complete checkout. The return page should say the test payment was confirmed. Verify the payment in Stripe's sandbox Payments page.
5. Cancel a new checkout and check that the basket remains. Test a decline with `4000 0000 0000 0002`.
6. Refresh and retry as needed. Purchased quantities are removed from the same browser basket only after Stripe confirms payment. Items added afterward remain. Each click can create a new test session; do not interpret it as a real order.

If checkout says it is not configured, check the variables, runtime scope, deployment context, and redeploy. A missing function usually means only static files were uploaded.

## Before real sales

This is a sandbox integration, not order fulfillment. Arizona shipping is $7.95 per order and Mesa pickup is free. Shipping addresses are collected on the basket page and attached to the Stripe test payment; tax is not configured. No physical order is created and no customer fulfillment email is sent. Stripe stores the test payment. The return page retrieves its status; no webhook or durable order system is included yet.

Before enabling real payments, implement verified webhooks and durable, idempotent order recording; configure final products, shipping, tax decisions, customer contact and fulfillment; add abuse/rate controls; and perform end-to-end testing. Live keys are intentionally rejected by this code and require a separate reviewed change.

References: https://docs.stripe.com/payments/checkout ; https://docs.stripe.com/testing ; https://docs.netlify.com/build/functions/overview/

## Approved catalog and delivery update

Classic: $6 / 4 oz, $10 / 8 oz. Pistachio Chocolate: $9 / 4 oz, $15 / 8 oz. Coconut Vanilla: $10 / 4 oz, $17 / 8 oz. All contain peanuts; both specialty flavors contain macadamias and Pistachio Chocolate also contains pistachios. Full ingredient and cross-contact details still require confirmation.

Choose Arizona shipping ($7.95 per order) or Mesa pickup (free) on the basket page. The shipping form requires an Arizona address; the server controls the fee and attaches the address to the Stripe payment. Do not add Stripe shipping-address collection without reviewing state restrictions. This remains sandbox-only; no live key or environment setting changes are required for this update.
