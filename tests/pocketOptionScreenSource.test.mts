import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCapturedChartFrame } from '../scalp-atlas-new/pocketOptionScreenSource.ts';

const now = 1_000_000;
const frame = { imageUri: 'file:///data/user/0/com.scalpatlas.app/cache/chart.png', capturedAt: now, brokerVisible: true, source: 'android-mediaprojection' as const };

test('accepts recent Pocket Option screen frame', () => {
  assert.deepEqual(validateCapturedChartFrame(frame, now), { accepted: true });
});
test('rejects frame when Pocket Option is not visible', () => {
  assert.equal(validateCapturedChartFrame({ ...frame, brokerVisible: false }, now).accepted, false);
});
test('rejects stale or future frames', () => {
  assert.equal(validateCapturedChartFrame({ ...frame, capturedAt: now - 3001 }, now).accepted, false);
  assert.equal(validateCapturedChartFrame({ ...frame, capturedAt: now + 1 }, now).accepted, false);
});
test('rejects unsupported capture source and invalid URI', () => {
  assert.equal(validateCapturedChartFrame({ ...frame, source: 'camera' as never }, now).accepted, false);
  assert.equal(validateCapturedChartFrame({ ...frame, imageUri: 'https://example.com/frame' }, now).accepted, false);
});
