import type { ShockObservation } from './shockOnlyDetector';

/**
 * Strict boundary between camera/chart extraction and SHOCK detector.
 * OCR text alone or a single image is not a verified OHLC stream.
 * This adapter intentionally fails closed instead of fabricating prices.
 */
export type ChartCandleSample = {
  marketId?: string; timeframeMinutes?: number; candleStartMs?: number;
  observedAtMs?: number; open?: number; high?: number; low?: number; close?: number;
  chartVerified?: boolean; ohlcVerified?: boolean;
};
export function toShockObservation(sample: ChartCandleSample): ShockObservation | null {
  const {marketId,timeframeMinutes,candleStartMs,observedAtMs,open,high,low,close,chartVerified,ohlcVerified}=sample;
  if (!chartVerified || !ohlcVerified || !marketId || !marketId.trim() ||
      ![5,10,15].includes(Number(timeframeMinutes)) ||
      ![candleStartMs,observedAtMs,open,high,low,close].every(v=>typeof v==='number' && Number.isFinite(v)) ||
      (candleStartMs as number) > (observedAtMs as number) ||
      (open as number)<=0 || (close as number)<=0 ||
      (high as number)<Math.max(open as number,close as number) ||
      (low as number)>Math.min(open as number,close as number) ||
      (high as number)<(low as number)) return null;
  const duration=(timeframeMinutes as number)*60000;
  // A candle must begin on its actual timeframe boundary. This prevents
  // camera frames from being grouped under an arbitrary or shifting candle ID.
  if ((candleStartMs as number) % duration !== 0 ||
      (observedAtMs as number) > Date.now() + 2000 ||
      (observedAtMs as number)-(candleStartMs as number)>=duration ||
      (low as number)<=0) return null;
  return {
    marketId:marketId.trim(), timeframeMinutes:timeframeMinutes as 5|10|15,
    candleId:String(candleStartMs),timestampMs:observedAtMs as number,
    open:open as number,high:high as number,low:low as number,close:close as number,
    sourceConfirmed:true
  };
}
