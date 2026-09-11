import { Platform } from 'react-native';
import type { Purchase } from 'expo-iap';

export type VerifiedSubscription = {
  subscriptionActive: boolean;
  productId: string | null;
  expiresAt: string | null;
};

const verificationApiUrl = (process.env.EXPO_PUBLIC_ENTITLEMENT_API_URL || '').trim();

export function subscriptionVerificationConfigured(): boolean {
  return verificationApiUrl.length > 0;
}

export async function verifySubscriptionOnBackend(
  purchase: Purchase
): Promise<VerifiedSubscription> {
  if (!verificationApiUrl) {
    throw new Error('Serverul de verificare a abonamentelor nu este configurat încă.');
  }

  const response = await fetch(`${verificationApiUrl.replace(/\/$/, '')}/v1/subscriptions/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      platform: Platform.OS,
      packageId: 'com.scalpatlas.app',
      productId: purchase.productId,
      purchase,
    }),
  });

  if (!response.ok) {
    throw new Error(`Verificarea abonamentului a eșuat (${response.status}).`);
  }

  const payload = await response.json() as Partial<VerifiedSubscription>;
  if (payload.subscriptionActive !== true || typeof payload.productId !== 'string') {
    return {
      subscriptionActive: false,
      productId: typeof payload.productId === 'string' ? payload.productId : null,
      expiresAt: typeof payload.expiresAt === 'string' ? payload.expiresAt : null,
    };
  }

  return {
    subscriptionActive: true,
    productId: payload.productId,
    expiresAt: typeof payload.expiresAt === 'string' ? payload.expiresAt : null,
  };
}
