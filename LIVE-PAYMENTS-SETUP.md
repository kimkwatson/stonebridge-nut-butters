# Stonebridge live payment activation

The code supports sandbox and live modes. It does not activate your Stripe account, change Netlify settings, or publish itself.

## Activate after publishing the code

In Netlify, open the existing Stonebridge project, Project configuration > Environment variables. Set these in the Production context, with Functions runtime scope:

| Variable | Live value |
| --- | --- |
| STRIPE_MODE | live |
| ENABLE_LIVE_PAYMENTS | true |
| STRIPE_SECRET_KEY | Your live Stripe restricted key (rk_live_) with the permissions needed to create and retrieve Checkout Sessions and line items, or your existing live secret key (sk_live_) |
| SITE_URL | https://stonebridgenutbutters.com (must match the canonical browser origin) |
| ENABLE_STRIPE_SANDBOX | false, or delete this old variable |

Enter the key directly in Netlify; never put it in GitHub, chat, screenshots, or this document. No publishable key is needed for hosted Checkout. Publish the code from GitHub and redeploy after setting variables. A live mode with a test key, or without explicit ENABLE_LIVE_PAYMENTS=true, fails closed.

Confirm your Stripe live account can accept payments and has payout details completed. Account verification is separate from government food, tax, and business registrations.

## Receipts and your email notifications

In Stripe LIVE mode, enable Successful payments under Customer emails for customer payment receipts. Enable successful-payment account email notifications for yourself as well; these are separate settings. Use Dashboard search if navigation differs.

References:
- https://docs.stripe.com/receipts
- https://support.stripe.com/questions/set-up-account-email-notifications
- https://docs.stripe.com/keys

## Fulfilling a purchase for the milestone

Stripe stores the Checkout Session and payment even if the customer never returns to Stonebridge. The payment description identifies shipping or pickup. Payment metadata includes the purchased jar names and quantities, the store, and fulfillment method. The shipping address is attached to the payment for shipped orders. Customer email is collected by Stripe Checkout. Check the payment is Succeeded before fulfillment; an open, unpaid, or pending payment is not a completed purchase.

Use Stripe for manual order tracking and fulfillment at this stage. There is no separate Stonebridge order database, webhook-driven fulfillment service, or custom order email. Stripe account email notifications alert you to payments but may not include all order details; inspect the payment in Stripe. You must arrange actual pickup or shipping yourself.

The success page verifies status and retrieves the purchased items and totals from Stripe; it does not create the order or send email. Reloading it does not remove basket quantities twice.

## Verify activation without a purchase

After Netlify publishes, /.netlify/functions/checkout-config should return {"mode":"live"}. The basket should show Secure checkout and explain that payment charges real money. Starting checkout creates an unpaid live session; it does not charge until the customer authorizes payment in Stripe. Do not use Stripe test-card numbers in live mode or make fake live test transactions. A genuine intended purchase for actual goods is different from sandbox testing.

## Current limits

Tax is not calculated or collected automatically by this code. Food/tax/local registration, final ingredient and allergen labels, and your policies remain your responsibility; live mode does not establish an exemption or finish those registrations. The product pages still disclose incomplete ingredient/cross-contact details.

There is no custom refund automation, rate-limit service, inventory control, or order dashboard. Stripe payment status and manual fulfillment are the source of truth for this milestone.

## Disable or return to sandbox

To stop live checkout, set ENABLE_LIVE_PAYMENTS=false and redeploy. To use sandbox, set STRIPE_MODE=sandbox and STRIPE_SECRET_KEY to the sandbox key, and redeploy. Test and live data are separate; old test confirmation links cannot be verified with the live key. Create a fresh checkout after a mode change.
