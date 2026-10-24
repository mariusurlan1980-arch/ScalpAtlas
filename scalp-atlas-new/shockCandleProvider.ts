import type {ChartCandleSample} from './shockChartAdapter';

/**
 * Trusted input contract for SHOCK ONLY. A camera image or OCR output is NOT
 * trusted OHLC data. A chart provider must supply the full forming-candle sample.
 */
export type VerifiedCandleProvider = {
  getCurrentCandle(): Promise<ChartCandleSample | null>;
};

export type ShockCaptureResult =
  | {kind:'verified'; sample:ChartCandleSample}
  | {kind:'unavailable'; reason:'NO_PROVIDER'|'NO_SAMPLE'|'UNVERIFIED_SAMPLE'};

/** Prevents the UI from implying that camera/OCR alone can calculate OHLC. */
export async function readVerifiedCandle(provider: VerifiedCandleProvider | null): Promise<ShockCaptureResult> {
  if (!provider) return {kind:'unavailable',reason:'NO_PROVIDER'};
  let sample:ChartCandleSample | null;
  try { sample=await provider.getCurrentCandle(); }
  catch { return {kind:'unavailable',reason:'NO_SAMPLE'}; }
  if (!sample) return {kind:'unavailable',reason:'NO_SAMPLE'};
  if (!sample.chartVerified || !sample.ohlcVerified)
    return {kind:'unavailable',reason:'UNVERIFIED_SAMPLE'};
  return {kind:'verified',sample};
}
