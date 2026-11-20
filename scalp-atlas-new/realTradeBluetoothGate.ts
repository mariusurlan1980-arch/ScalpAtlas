/**
 * Scalp Atlas REAL / Fingerbot Touch: hardware-independent safety gate.
 * No BLE command is sent here. Device pairing/protocol integration is deliberately absent.
 * This file does not change the QT Demo execution path.
 */
export type TradeDirection = 'BUY' | 'SELL';
export type AccountMode = 'DEMO' | 'REAL';
export type TouchChannel = 'A' | 'B';

export interface RealTradeSignal {
  id: string;
  account: AccountMode;
  direction: TradeDirection;
  pair: string;
  timeframe: string;
  payoutPercent: number;
  emittedAtMs: number;
}

export interface RealTouchSafetyContext {
  nowMs: number;
  confirmedSignalId: string | null;
  brokerApprovedExternalActuator: boolean;
  bluetoothPaired: boolean;
  capacitiveTwoChannelDeviceVerified: boolean;
  touchPositionsCalibrated: boolean;
  openTrade: boolean;
}

export type RealTouchDecision =
  | { allowed: false; reason: string }
  | {
      allowed: true;
      intent: {
        signalId: string;
        channel: TouchChannel;
        direction: TradeDirection;
        pair: string;
        /** UI must not reuse this intent after this timestamp. */
        validUntilMs: number;
      };
    };

export const MAX_REAL_SIGNAL_AGE_MS = 8_000;
export const MIN_REAL_PAYOUT_PERCENT = 92;

/**
 * Only prepares a one-shot, user-approved touch intent for a verified dual-channel
 * capacitive device. Callers must consume the confirmation and enforce idempotency,
 * verify the broker order state, and re-check safety before any hardware action.
 */
export function prepareRealTouchIntent(
  signal: RealTradeSignal,
  context: RealTouchSafetyContext,
): RealTouchDecision {
  const deny = (reason: string): RealTouchDecision => ({ allowed: false, reason });
  if (signal.account !== 'REAL') return deny('Mod REAL neconfirmat');
  if (!signal.id || !signal.pair.trim()) return deny('Semnal incomplet');
  if (signal.timeframe !== 'M5') return deny('Timeframe diferit de M5');
  if (signal.direction !== 'BUY' && signal.direction !== 'SELL') return deny('Directie necunoscuta');
  if (!Number.isFinite(signal.payoutPercent) || signal.payoutPercent < MIN_REAL_PAYOUT_PERCENT) {
    return deny('Payout sub pragul de 92%');
  }
  const ageMs = context.nowMs - signal.emittedAtMs;
  if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > MAX_REAL_SIGNAL_AGE_MS) {
    return deny('Semnal expirat sau ceas invalid');
  }
  if (!context.brokerApprovedExternalActuator) return deny('Aprobarea brokerului lipseste');
  if (!context.bluetoothPaired) return deny('Bluetooth neconectat');
  if (!context.capacitiveTwoChannelDeviceVerified) return deny('Dispozitivul tactil nu este verificat');
  if (!context.touchPositionsCalibrated) return deny('Pozitiile BUY/SELL nu sunt calibrate');
  if (context.openTrade) return deny('Exista deja un ordin activ');
  if (context.confirmedSignalId !== signal.id) return deny('Confirmare manuala necesara');

  return {
    allowed: true,
    intent: {
      signalId: signal.id,
      channel: signal.direction === 'BUY' ? 'A' : 'B',
      direction: signal.direction,
      pair: signal.pair,
      validUntilMs: signal.emittedAtMs + MAX_REAL_SIGNAL_AGE_MS,
    },
  };
}
