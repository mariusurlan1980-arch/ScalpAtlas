/**
 * Provider adapters are intentionally interfaces only.
 * No real money moves until credentials, legal setup and provider onboarding are complete.
 */

export class ShopifyPaymentsAdapter {
  async captureAuthorizedPayment(_order) {
    throw new Error("Shopify payment capture adapter not connected");
  }

  async voidAuthorization(_order) {
    throw new Error("Shopify payment void adapter not connected");
  }

  async refundCapturedPayment(_order) {
    throw new Error("Shopify refund adapter not connected");
  }
}

export class SupplierPayoutAdapter {
  async paySupplier(_order, _supplier) {
    throw new Error("Supplier payout provider not connected");
  }
}
