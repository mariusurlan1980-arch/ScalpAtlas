/**
 * Minimal, read-only SSE integration for independent OTCharts data.
 * NOT a Pocket Option official API. No order placement, account access,
 * session tokens or simulated prices. A stale/mismatched tick is rejected.
 */
import type { QuoteTick } from './shockQuoteAdapter';

export const OTC_ENDPOINT = 'https://otcharts.com';
export const OTC_CLOCK_OFFSET_SECONDS = 7200; // Provider says Pocket Option historical bars are UTC+2.
export type PublicCandle = { open: number; high: number; low: number; close: number; time: number };
export type LiveDataMessage =
  | { ok: true; tick: QuoteTick }
  | { ok: false; reason: string };

export function validateLiveTick(data: unknown, expectedSymbol: string, nowMs: number, tf: 5|10|15): LiveDataMessage {
  if (!data || typeof data !== 'object') return {ok:false,reason:'DATE_INVALIDE'};
  const d = data as Record<string, unknown>;
  if (d.symbol !== expectedSymbol || typeof d.price !== 'number' ||
      !Number.isFinite(d.price) || d.price <= 0 ||
      typeof d.time !== 'number' || !Number.isSafeInteger(d.time)) {
    return {ok:false,reason:'PRET_SAU_PERECHE_INVALIDA'};
  }
  const timestampMs = d.time * 1000;
  if (timestampMs > nowMs + 2000 || nowMs - timestampMs > 5000) {
    return {ok:false,reason:'FLUX_INTARZIAT'};
  }
  return {ok:true,tick:{
    marketId:expectedSymbol, timestampMs, price:d.price,
    timeframeMinutes:tf, sourceConfirmed:true,
  }};
}

export function normalizeCompletedOTCCandles(
  data: unknown,
  nowMs: number,
  tf:5|10|15
): Array<{startMs:number;open:number;high:number;low:number;close:number}> {
  if (!data || typeof data !== 'object' ||
      !Array.isArray((data as {candles?:unknown}).candles)) return [];
  const raw = (data as {candles:unknown[]}).candles;
  const width = tf * 60_000;
  const start = Math.floor(nowMs/width)*width;
  return raw.map(v => {
    if (!v || typeof v !== 'object') return null;
    const c = v as Record<string, unknown>;
    const numbers = [c.time,c.open,c.high,c.low,c.close];
    if (!numbers.every(x=>typeof x==='number' && Number.isFinite(x))) return null;
    const t = (c.time as number)*1000 - OTC_CLOCK_OFFSET_SECONDS*1000;
    const [open,high,low,close] = [c.open,c.high,c.low,c.close] as number[];
    if (open <= 0 || close <= 0 || low <= 0 || high < Math.max(open,close) ||
        low > Math.min(open,close) || t % width !== 0 || t + width > start ||
        t < nowMs - 24*60*60*1000) return null;
    return {startMs:t,open,high,low,close};
  }).filter((c):c is NonNullable<typeof c> => c!==null)
    .sort((a,b)=>a.startMs-b.startMs);
}
