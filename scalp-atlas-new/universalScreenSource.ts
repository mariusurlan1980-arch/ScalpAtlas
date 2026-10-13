/**
 * SCALP ATLAS UNIVERSAL LIVE — broker-neutral screen capture contract.
 * Pure validation only; does not obtain screen access or generate trading signals.
 */
export type BrokerProfile = Readonly<{ id: string; label: string; androidPackage: string }>;
export type ChartRegion = Readonly<{ x: number; y: number; width: number; height: number }>;
export type UniversalChartFrame = Readonly<{
  imageUri: string;
  capturedAt: number;
  source: 'android-mediaprojection';
  captureConsentActive: boolean;
  foregroundAndroidPackage: string | null;
  chartRegion: ChartRegion | null;
  chartVerified: boolean;
}>;
export type FrameDecision =
  | { accepted: true; brokerId: string; region: ChartRegion }
  | { accepted: false; reason: string };

/** Fail closed: a frame can be analysed only from the selected broker app. */
export function validateUniversalChartFrame(
  frame: UniversalChartFrame, broker: BrokerProfile, now = Date.now(),
): FrameDecision {
  if (!broker.id.trim() || !broker.androidPackage.trim())
    return { accepted: false, reason: 'BROKER_NOT_SELECTED' };
  if (!frame.captureConsentActive)
    return { accepted: false, reason: 'CAPTURE_CONSENT_REQUIRED' };
  if (frame.foregroundAndroidPackage !== broker.androidPackage)
    return { accepted: false, reason: 'WRONG_FOREGROUND_APP' };
  if (frame.source !== 'android-mediaprojection' || !frame.imageUri.startsWith('file://'))
    return { accepted: false, reason: 'UNTRUSTED_FRAME' };
  if (!Number.isFinite(now) || !Number.isFinite(frame.capturedAt) ||
      frame.capturedAt > now || now - frame.capturedAt > 2000)
    return { accepted: false, reason: 'STALE_FRAME' };
  if (!frame.chartVerified || !frame.chartRegion)
    return { accepted: false, reason: 'CHART_NOT_VERIFIED' };
  const r = frame.chartRegion;
  if (![r.x, r.y, r.width, r.height].every(Number.isFinite) ||
      r.x < 0 || r.y < 0 || r.width <= 0 || r.height <= 0 ||
      r.x + r.width > 1 || r.y + r.height > 1)
    return { accepted: false, reason: 'INVALID_CHART_REGION' };
  return { accepted: true, brokerId: broker.id, region: r };
}
