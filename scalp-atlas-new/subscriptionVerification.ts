import { Platform } from 'react-native';
import type { Purchase } from 'expo-iap';
import { commercialAuthorizationHeader } from './commercialAuth';
import { commercialBackendBaseUrl, commercialBackendConfigured } from './commercialBackend';

export type VerifiedSubscription = {
  subscriptionActive: boolean;
  productId: string | null;
  expiresAt: string | null;
};

export function subscriptionVerificationConfigured(): boolean {
  return commercialBackendConfigured();
}

export async function verifySubscriptionOnBackend(
  purchase: Purchase
): Promise<VerifiedSubscription> {
  if (!commercialBackendConfigured()) {
    throw new Error('Serverul de verificare a abonamentelor nu este configurat încă.');
  }

  const authHeaders = await commercialAuthorizationHeader();
  const response = await fetch(`${commercialBackendBaseUrl()}/v1/subscriptions/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...authHeaders,
    },
    body: JSON.stringify({
      platform: Platform.OS,
      packageId: 'com.scalpatlas.app',
      productId: purchase.productId,
      purchase,
    }),
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Contul trebuie autentificat înainte de activarea abonamentului.');
    }
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
