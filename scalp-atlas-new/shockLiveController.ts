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
  private lastAcceptedAtMs: number | null = null;
  // Retain BIP deduplication even if one OCR/camera frame is unreadable.
  private alertedCandles = new Set<string>();
  constructor(private onConfirmedAlert: (direction: ShockDirection) => void) {}
  ingest(sample: ChartCandleSample): ShockLiveStatus {
    const observation = toShockObservation(sample);
    if (!observation) {
      // Fail closed on lost verification. Otherwise an unseen reversal could
      // be mistaken for an observed same-candle SHOCK after capture resumes.
      this.detector.reset();
      this.lastAcceptedAtMs = null;
      return {intensityPercent:0,phase:'OBSERVING',signal:null};
    }
    const context = observation.marketId+'|'+observation.timeframeMinutes;
    if (this.lastAcceptedAtMs !== null &&
        (observation.timestampMs <= this.lastAcceptedAtMs || observation.timestampMs - this.lastAcceptedAtMs > 5000)) {
      this.detector.reset();
    }
    this.lastAcceptedAtMs = observation.timestampMs;
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
  reset() {this.detector.reset();this.lastContext=null;this.lastCandleId=null;this.lastAcceptedAtMs=null;}
}
