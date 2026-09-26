# Florentina Flowers Order Router

This service is the automation layer between Shopify orders and florist supplier payouts.

## Financial rule

The default rule is **pay supplier only after confirmed delivery and successful capture of the customer's authorized payment**.

1. Customer payment is authorized.
2. Router offers the order to eligible florists.
3. A florist accepts and prepares the order.
4. Florist submits a pre-delivery photo.
5. The photo is approved against the product standard.
6. Florist delivers and submits delivery proof.
7. Customer payment is captured.
8. Supplier payout is released.
9. Remaining margin stays with Florentina Flowers, before fees/taxes.

If no florist accepts, an uncaptured authorization is voided. If money had already been captured, a refund path is used.

## Safety rules

- Never pay a florist before successful customer payment capture under the default model.
- Never pay when the pre-delivery product failed the quality standard.
- Capture failure blocks supplier payout.
- Payout failure creates an exception; it does not silently mark the order complete.
- All provider calls must be idempotent before production launch.
- No credentials are stored in this repository.

## Current status

The state machine and safety tests are implemented. Payment provider adapters are placeholders. Real Shopify payment capture, authorization void/refund, supplier payout, webhook verification and persistence are not connected yet.

Those connections require:
- an upgraded Shopify store with a supported payment setup,
- merchant/legal onboarding,
- a payout provider account for supplier onboarding,
- production secrets and a deployed HTTPS endpoint.

The Android app and the Shopify storefront are not modified by this router branch.
