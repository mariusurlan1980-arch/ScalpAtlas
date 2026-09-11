import type { SubscriptionPlan } from './billingProducts';
import { subscriptionVerificationConfigured, type VerifiedSubscription } from './subscriptionVerification';

type Options = {
  onEntitlementVerified: (entitlement: VerifiedSubscription) => void;
  onMessage: (message: string) => void;
};

// SAFE START build:
// Nu încărcăm niciun modul nativ de billing la pornirea APK-ului instalat direct.
// După ce confirmăm stabilitatea aplicației pe telefon, reactivăm Google Play /
// App Store billing într-un build separat, testat prin canalele magazinelor.
export function useCommercialBilling({ onMessage }: Options) {
  const purchaseSubscription = async (_plan: SubscriptionPlan) => {
    onMessage('Plățile sunt dezactivate în această versiune de test sigură. Mai întâi verificăm stabilitatea aplicației și fluxul 5/5.');
  };

  const restorePurchases = async () => {
    onMessage('Restabilirea achizițiilor va fi activată în buildul de magazin, după testul de stabilitate.');
  };

  return {
    storeConnected: false,
    billingBusy: false,
    billingVerificationConfigured: subscriptionVerificationConfigured(),
    monthlyPrice: null as string | null,
    annualPrice: null as string | null,
    purchaseSubscription,
    restorePurchases,
  };
}
