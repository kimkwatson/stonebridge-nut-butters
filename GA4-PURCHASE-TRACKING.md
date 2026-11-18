# GA4 purchase tracking: implementation and safe testing

Changes are in the existing October 22 Stonebridge project. Nothing has been deployed.

The checkout-summary function builds a GA4 payload only after checking Stripe session status=complete and payment_status=paid. Stripe session ID becomes transaction_id. USD amounts are divided by 100; value=(amount_total-amount_shipping-amount_tax)/100, so discounts are reflected and shipping/tax are separate. Items use Stripe descriptions, quantities and discounted, tax-exclusive unit prices. The storefront already supports USD only. No customer names, addresses or emails are included.

The confirmation handler passes that payload to purchase-tracking.js, which reuses the existing G-M571TGWTG8 tag. No Ads event or additional base tag is added. Memory and localStorage guards prevent repeated sends; Web Locks coordinate concurrent tabs when supported. The receipt and cart logic remain intact.

This is browser delivery, not guaranteed exactly-once delivery. The queued marker is saved only after gtag returns successfully. A synchronous gtag exception releases the in-memory guard and leaves no persistent marker, allowing a later call or refresh to retry. A successful queue call is not proof of delivery, so network failures do not trigger automatic retries. Existing queued markers from earlier versions remain respected because their delivery status is unknown. Blocking analytics can lose an event; clearing storage, changing browsers or browsers without Web Locks can permit another send. The stable transaction ID supports GA4 deduplication. Customers who never return from Stripe are not covered; webhook delivery would be separate work.

## Test locally before production

1. In the GA4 property for G-M571TGWTG8, configure an Exclude Developer Traffic data filter and verify it is Active before sending sandbox purchase events. Testing state does not exclude traffic. Filters permanently exclude matching data; follow Google's filter validation guidance. debug_mode alone is not an isolation mechanism. If you cannot establish that filter safely, use an isolated GA4 test property in a local-only test copy instead.
2. Run the full app with Netlify Dev (not just npm start, which does not serve the serverless payment functions). Use local-only environment settings: STRIPE_MODE=sandbox, ENABLE_STRIPE_SANDBOX=true, ENABLE_LIVE_PAYMENTS=false, STRIPE_SECRET_KEY=your sandbox secret key, SITE_URL=http://localhost:8888. Use the actual Netlify Dev port and matching localhost origin. Keep keys outside tracked source. Do not change production environment settings or run a deploy command.
3. Run npm run build, then netlify dev --port 8888 with the Netlify CLI available. Confirm /.netlify/functions/checkout-config says sandbox. Complete a Stripe sandbox checkout with a test card and dummy information. Verify the return page confirms the test payment. Ordinary sandbox returns do NOT send purchase events.
4. On that verified confirmation URL append &ga_debug=1 (retain session_id). This explicitly permits the sandbox event and adds debug_mode:true. Open the property's DebugView and select your device. Inspect purchase: transaction_id is the cs_test_... session, currency USD, value excludes shipping and tax, and items reflect the order. With two $10 jars and $7.95 shipping, value=20, shipping=7.95, tax=0, total paid=$27.95.
5. Refresh and reopen the same confirmation in another tab. No further purchase should be queued. You can also inspect Network for the GA collect request and the existing dataLayer for the single purchase command. Use a NEW sandbox checkout for each intentional new test; don't clear deduplication storage as your ordinary test procedure.
6. Verify canceled/unpaid sessions never send purchase, and the basket/receipt still work. Test both shipping and pickup. No real payment is needed. No deployment has been performed.

Google guidance:
- https://support.google.com/analytics/answer/13296662
- https://developers.google.com/analytics/devguides/collection/ga4/set-up-ecommerce

