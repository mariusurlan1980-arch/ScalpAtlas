import { useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import {
  finishTransaction,
  getAvailablePurchases as getAvailablePurchasesDirect,
  useIAP,
  type ProductSubscription,
  type Purchase,
} from 'expo-iap';
import {
  SUBSCRIPTION_PRODUCT_IDS,
  SUBSCRIPTION_PRODUCTS,
  type SubscriptionPlan,
} from './billingProducts';
import {
  subscriptionVerificationConfigured,
  verifySubscriptionOnBackend,
  type VerifiedSubscription,
} from './subscriptionVerification';

type Options = {
  onEntitlementVerified: (entitlement: VerifiedSubscription) => void;
  onMessage: (message: string) => void;
};

function androidOfferToken(subscription: ProductSubscription): string | null {
  const product = subscription as unknown as {
    subscriptionOffers?: Array<{ offerTokenAndroid?: string; offerToken?: string }>;
    subscriptionOfferDetailsAndroid?: Array<{ offerTokenAndroid?: string; offerToken?: string }>;
    subscriptionOfferDetails?: Array<{ offerTokenAndroid?: string; offerToken?: string }>;
  };

  const offers =
    product.subscriptionOffers ||
    product.subscriptionOfferDetailsAndroid ||
    product.subscriptionOfferDetails ||
    [];

  const firstOffer = offers[0];
  return firstOffer?.offerTokenAndroid || firstOffer?.offerToken || null;
}

export function useCommercialBilling({ onEntitlementVerified, onMessage }: Options) {
  const [billingBusy, setBillingBusy] = useState(false);

  const {
    connected,
    subscriptions,
    fetchProducts,
    requestPurchase,
  } = useIAP({
    onPurchaseSuccess: async (purchase: Purchase) => {
      setBillingBusy(true);
      try {
        const entitlement = await verifySubscriptionOnBackend(purchase);
        if (!entitlement.subscriptionActive) {
          onMessage('Plata a fost primită, dar abonamentul nu a putut fi validat. Accesul PREMIUM nu a fost activat.');
          return;
        }

        onEntitlementVerified(entitlement);
        await finishTransaction({ purchase, isConsumable: false });
        onMessage('Abonamentul SCALP ATLAS PREMIUM a fost activat.');
      } catch (error) {
        onMessage(error instanceof Error ? error.message : 'Verificarea plății nu a reușit.');
      } finally {
        setBillingBusy(false);
      }
    },
    onPurchaseError: (error) => {
      setBillingBusy(false);
      const code = String((error as { code?: unknown })?.code || '').toLowerCase();
      if (code.includes('cancel')) {
        onMessage('Achiziția a fost anulată.');
        return;
      }
      onMessage(`Achiziția nu a reușit: ${error.message || 'eroare necunoscută'}`);
    },
  });

  useEffect(() => {
    if (!connected) return;
    fetchProducts({
      skus: [...SUBSCRIPTION_PRODUCT_IDS],
      type: 'subs',
    }).catch(() => {
      onMessage('Produsele de abonament nu au putut fi încărcate din magazin.');
    });
  }, [connected, fetchProducts, onMessage]);

  const monthlyPrice = useMemo(
    () => subscriptions.find((item) => item.id === SUBSCRIPTION_PRODUCTS.monthly)?.displayPrice || null,
    [subscriptions]
  );
  const annualPrice = useMemo(
    () => subscriptions.find((item) => item.id === SUBSCRIPTION_PRODUCTS.annual)?.displayPrice || null,
    [subscriptions]
  );

  const purchaseSubscription = async (plan: SubscriptionPlan) => {
    if (!subscriptionVerificationConfigured()) {
      onMessage('Plățile sunt pregătite, dar serverul de verificare trebuie conectat înainte de lansarea comercială.');
      return;
    }
    if (!connected) {
      onMessage('Magazinul nu este conectat încă. Încearcă din nou imediat.');
      return;
    }

    const productId = SUBSCRIPTION_PRODUCTS[plan];
    const subscription = subscriptions.find((item) => item.id === productId);
    if (!subscription) {
      onMessage('Abonamentul nu este încă disponibil în magazin.');
      return;
    }

    const offerToken = androidOfferToken(subscription);
    if (Platform.OS === 'android' && !offerToken) {
      onMessage('Oferta Google Play pentru acest abonament nu este configurată încă.');
      return;
    }

    setBillingBusy(true);
    try {
      await requestPurchase({
        request: {
          apple: { sku: productId },
          google: {
            skus: [productId],
            subscriptionOffers: offerToken
              ? [{ sku: productId, offerToken }]
              : undefined,
          },
        },
        type: 'subs',
      });
    } catch (error) {
      setBillingBusy(false);
      onMessage(error instanceof Error ? error.message : 'Magazinul nu a putut porni plata.');
    }
  };

  const restorePurchases = async () => {
    if (!subscriptionVerificationConfigured()) {
      onMessage('Restabilirea este pregătită, dar necesită serverul de verificare a abonamentului.');
      return;
    }
    if (!connected) {
      onMessage('Magazinul nu este conectat încă.');
      return;
    }

    setBillingBusy(true);
    try {
      const purchases = await getAvailablePurchasesDirect();
      const relevant = purchases.filter((purchase: Purchase) =>
        (SUBSCRIPTION_PRODUCT_IDS as readonly string[]).includes(purchase.productId)
      );

      for (const purchase of relevant) {
        const entitlement = await verifySubscriptionOnBackend(purchase);
        if (entitlement.subscriptionActive) {
          onEntitlementVerified(entitlement);
          onMessage('Abonamentul activ a fost restabilit.');
          return;
        }
      }

      onMessage('Nu a fost găsit un abonament SCALP ATLAS activ pentru acest cont de magazin.');
    } catch (error) {
      onMessage(error instanceof Error ? error.message : 'Restabilirea achiziției nu a reușit.');
    } finally {
      setBillingBusy(false);
    }
  };

  return {
    storeConnected: connected,
    billingBusy,
    billingVerificationConfigured: subscriptionVerificationConfigured(),
    monthlyPrice,
    annualPrice,
    purchaseSubscription,
    restorePurchases,
  };
}
