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
  constructor(private onConfirmedAlert: (direction: ShockDirection) => void) {}
  ingest(sample: ChartCandleSample): ShockLiveStatus {
    const observation = toShockObservation(sample);
    if (!observation) {
      this.reset();
      return {intensityPercent:0,phase:'OBSERVING',signal:null};
    }
    const context = observation.marketId+'|'+observation.timeframeMinutes;
    if (this.lastContext !== context) {
      this.detector.reset();
      this.lastContext = context;
    }
    const status=this.detector.observeLive(observation);
    if (status.signal) this.onConfirmedAlert(status.signal.direction);
    return status;
  }
  reset() {this.detector.reset();this.lastContext=null;}
}
