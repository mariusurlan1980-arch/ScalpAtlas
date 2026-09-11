export const SUBSCRIPTION_PRODUCTS = {
  monthly: 'com.scalpatlas.app.premium.monthly',
  annual: 'com.scalpatlas.app.premium.annual',
} as const;

export type SubscriptionPlan = keyof typeof SUBSCRIPTION_PRODUCTS;

export const SUBSCRIPTION_PRODUCT_IDS = [
  SUBSCRIPTION_PRODUCTS.monthly,
  SUBSCRIPTION_PRODUCTS.annual,
] as const;

export function planForProductId(productId: string): SubscriptionPlan | null {
  if (productId === SUBSCRIPTION_PRODUCTS.monthly) return 'monthly';
  if (productId === SUBSCRIPTION_PRODUCTS.annual) return 'annual';
  return null;
}
