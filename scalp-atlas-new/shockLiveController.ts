import {ShockOnlyDetector, type ShockLiveStatus, type ShockDirection} from './shockOnlyDetector';
import {toShockObservation, type ChartCandleSample} from './shockChartAdapter';

/**
 * Integration boundary for SHOCK-only mode.
 * Call ingest() only with independently verified OHLC samples from the same forming candle.
 * Camera JPEG/OCR text alone must never trigger a BIP.
 */
export class ShockLiveController {
  private detector = new ShockOnlyDetector();
  private lastContext: string | null = null;
  private lastCandleId: string | null = null;
  // Retain BIP deduplication even if one OCR/camera frame is unreadable.
  private alertedCandles = new Set<string>();
  constructor(private onConfirmedAlert: (direction: ShockDirection) => void) {}
  ingest(sample: ChartCandleSample): ShockLiveStatus {
    const observation = toShockObservation(sample);
    if (!observation) {
      // A temporary unreadable frame must not erase the forming-candle history.
      // Only a verified market/timeframe change or explicit stop resets the detector.
      return {intensityPercent:0,phase:'OBSERVING',signal:null};
    }
    const context = observation.marketId+'|'+observation.timeframeMinutes;
    if (this.lastContext !== context) {
      this.detector.reset();
      this.lastContext = context;
    }
    // The first observation of a new candle establishes its baseline.
    // Keep deduplication across invalid camera frames but reset after a genuine candle change.
    this.lastCandleId=observation.candleId;
    const status=this.detector.observeLive(observation);
    if (status.signal) {
      const alertKey=context+'|'+status.signal.candleId;
      if (this.alertedCandles.has(alertKey)) {
        status.signal=null;
      } else {
        this.alertedCandles.add(alertKey);
        // Bound memory while preserving deduplication across short capture gaps.
        if (this.alertedCandles.size>256) this.alertedCandles.delete(this.alertedCandles.values().next().value as string);
        this.onConfirmedAlert(status.signal.direction);
      }
    }
    return status;
  }
  reset() {this.detector.reset();this.lastContext=null;this.lastCandleId=null;}
}
