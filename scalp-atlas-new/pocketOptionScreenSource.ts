/**
 * SCALP ATLAS — screen source contract for Pocket Option-only Android capture.
 *
 * The actual Android implementation must use MediaProjection with explicit user
 * consent and a foreground service. This file does NOT grant screen access,
 * capture frames, start an overlay, or trade on a broker.
 */
export const SUPPORTED_BROKER_PACKAGE = 'com.pocketoption.app' as const;

export type ScreenCaptureState =
  | { status: 'idle' }
  | { status: 'permission-required' }
  | { status: 'capturing'; startedAt: number }
  | { status: 'stopped'; reason: string };

export type CapturedChartFrame = {
  imageUri: string;
  capturedAt: number;
  brokerVisible: boolean;
  source: 'android-mediaprojection';
};

export function validateCapturedChartFrame(
  frame: CapturedChartFrame,
  now = Date.now(),
): { accepted: true } | { accepted: false; reason: string } {
  if (!frame.brokerVisible) return { accepted: false, reason: 'POCKET_OPTION_NOT_VISIBLE' };
  if (frame.source !== 'android-mediaprojection')
    return { accepted: false, reason: 'UNTRUSTED_CAPTURE_SOURCE' };
  if (!frame.imageUri || !frame.imageUri.startsWith('file://'))
    return { accepted: false, reason: 'INVALID_FRAME_URI' };
  if (!Number.isFinite(frame.capturedAt) || frame.capturedAt > now || now - frame.capturedAt > 3000)
    return { accepted: false, reason: 'STALE_FRAME' };
  return { accepted: true };
}
