export const FREE_ANALYSIS_LIMIT = 5;

export type AccessMode = 'trial' | 'subscriber' | 'locked';

export type CommercialAccessState = {
  freeAnalysesUsed: number;
  subscriptionActive: boolean;
  subscriptionProductId?: string | null;
  subscriptionExpiresAt?: string | null;
};

export const INITIAL_COMMERCIAL_ACCESS: CommercialAccessState = {
  freeAnalysesUsed: 0,
  subscriptionActive: false,
  subscriptionProductId: null,
  subscriptionExpiresAt: null,
};

export function freeAnalysesRemaining(state: CommercialAccessState): number {
  return Math.max(0, FREE_ANALYSIS_LIMIT - state.freeAnalysesUsed);
}

export function accessMode(state: CommercialAccessState): AccessMode {
  if (state.subscriptionActive) return 'subscriber';
  return freeAnalysesRemaining(state) > 0 ? 'trial' : 'locked';
}

export function canAnalyze(state: CommercialAccessState): boolean {
  return accessMode(state) !== 'locked';
}

/**
 * Call this only after the Atlas engine returns a completed analysis result.
 * Failed/cancelled analyses should not consume a free attempt.
 */
export function consumeCompletedAnalysis(
  state: CommercialAccessState
): CommercialAccessState {
  if (state.subscriptionActive) return state;
  if (freeAnalysesRemaining(state) <= 0) return state;

  return {
    ...state,
    freeAnalysesUsed: Math.min(
      FREE_ANALYSIS_LIMIT,
      state.freeAnalysesUsed + 1
    ),
  };
}

export function activateSubscription(
  state: CommercialAccessState,
  productId: string,
  expiresAt?: string | null
): CommercialAccessState {
  return {
    ...state,
    subscriptionActive: true,
    subscriptionProductId: productId,
    subscriptionExpiresAt: expiresAt ?? null,
  };
}

export function deactivateSubscription(
  state: CommercialAccessState
): CommercialAccessState {
  return {
    ...state,
    subscriptionActive: false,
    subscriptionProductId: null,
    subscriptionExpiresAt: null,
  };
}

/**
 * Production note:
 * This module contains access rules only. The authoritative access state must
 * live on a backend tied to the user's account and verified store purchases,
 * otherwise reinstalling the app could reset a device-only trial counter.
 */
