# Florentina Flowers Order Router

This service is the automation layer between Shopify orders, florist partners and supplier payouts.

## Financial rule

The default rule is **pay supplier only after verified delivery and successful capture of the customer's authorized payment**.

1. Customer payment is authorized.
2. Router offers the order to one eligible florist.
3. Only that florist can accept or reject the offer.
4. After acceptance, recipient details become visible only to the assigned florist.
5. Florist prepares the bouquet and uploads a pre-delivery photo.
6. The photo must be approved against the product standard.
7. Florist reports delivery.
8. Delivery proof must be verified separately.
9. Only then does the order become eligible for payment capture.
10. After successful capture, supplier payout can be released.
11. Remaining margin stays with Florentina Flowers, before fees and taxes.

## Five-florist cascade

The routing engine implements the pilot rule:

- maximum 5 florist attempts,
- one florist at a time,
- 10-minute response window by default,
- immediate advance after REJECT,
- automatic advance when the 10-minute deadline expires,
- previously rejected/timed-out florists are never offered the same order again,
- first accepted florist locks the order,
- after five unsuccessful attempts the order enters the payment-authorization void path.

Portal links can stay valid during preparation/delivery, but ACCEPT/REJECT rights expire at the offer deadline.

For production, eligible florists are loaded from Shopify internal metaobjects. A florist must be marked active and have an approved supplier-product quote for the requested product. Current unvalidated candidates therefore cannot receive live orders.

## Safety switch

Routing is disabled by default.

Set:

`ENABLE_ROUTING_ENGINE=true`

only after the production partner directory, notification channel and operational checks are ready.

## Florist portal

The mobile-first partner portal supports:
- ACCEPT / REJECT
- START PREPARATION
- UPLOAD PHOTO
- OUT FOR DELIVERY
- DELIVERED

Recipient address and phone remain hidden until the florist has accepted the order. Another florist cannot continue an order already assigned to someone else.

## Backend

The router includes:
- signed, expiring florist portal tokens,
- state-checked partner actions,
- persistent JSON storage for development/testing,
- append-only audit entries without recipient PII,
- pre-delivery photo upload with MIME and size restrictions,
- internal photo review endpoint,
- separate delivery verification endpoint,
- automatic timed routing scheduler,
- Shopify metaobject partner-directory reader,
- Shopify payment capture and authorization-void client,
- Shopify webhook HMAC verification,
- automated safety tests.

## Important production boundary

The JSON repository, local photo directory and console offer notifier are for development only. Production requires durable database storage, private object storage and a real notification provider. Real payment capture and supplier payout remain disabled until merchant onboarding, production secrets and deployment are complete.

The Android app and Shopify storefront are not modified by this router branch.

## Local development

Install dependencies:

`npm install`

Seed one demo order:

`npm run demo:seed`

Start the router:

`npm start`

Then open the portal URL printed by the seed script.

## Production requirements

- upgraded Shopify store with supported payment setup,
- merchant/legal onboarding,
- durable database,
- private image/object storage,
- deployed HTTPS endpoint,
- verified Shopify webhooks,
- real email/SMS/WhatsApp florist notification channel,
- payout-provider onboarding for florist partners,
- production secrets stored outside the repository.
