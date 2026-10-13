import test from 'node:test';
import assert from 'node:assert/strict';
import { validateUniversalChartFrame } from '../scalp-atlas-new/universalScreenSource.ts';
const broker = { id: 'example', label: 'Example Broker', androidPackage: 'org.example.broker' };
const now = 1_000_000;
const frame = {
  imageUri: 'file:///data/user/0/com.scalpatlas.app/cache/frame.png',
  capturedAt: now,
  source: 'android-mediaprojection' as const,
  captureConsentActive: true,
  foregroundAndroidPackage: 'org.example.broker',
  chartVerified: true,
  chartRegion: { x: 0.05, y: 0.12, width: 0.9, height: 0.7 },
};
test('accepts a recent, user-authorized frame from selected broker', () => {
  assert.equal(validateUniversalChartFrame(frame, broker, now).accepted, true);
});
test('rejects nonconsensual, stale, wrong-app and unverified frames', () => {
  for (const patch of [
    { capturedAt: now - 2001 }, { foregroundAndroidPackage: 'org.other.app' },
    { captureConsentActive: false }, { chartVerified: false }, { chartRegion: null },
    { imageUri: 'https://example.com/anything' },
  ]) assert.equal(validateUniversalChartFrame({ ...frame, ...patch }, broker, now).accepted, false);
});
test('rejects crop outside available image', () => {
  assert.deepEqual(
    validateUniversalChartFrame({ ...frame, chartRegion: { x: 0.5, y: 0, width: 0.6, height: 1 } }, broker, now),
    { accepted: false, reason: 'INVALID_CHART_REGION' },
  );
});
