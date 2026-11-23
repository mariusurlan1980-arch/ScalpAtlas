import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const service = readFileSync(new URL('../native-overlay/ScalpOverlayService.kt', import.meta.url), 'utf8');
const workflow = readFileSync(new URL('../workflows/build-native-robot-safe-preflight-379.yml', import.meta.url), 'utf8');

test('611 history OCR sampling at 900ms can accumulate two independent selected-OPEN frames', () => {
  const history = service.split('private fun recordExplicitEmptyOpenOcr(')[1]
    .split('private fun scheduleTimeframeOcr(',1)[0];
  assert.ok(history, 'history OCR function exists');
  const actualPhrases = [
    'observedAt - lastOpenTabVisualAt429 in 750L..12000L',
    'observedAt - lastClosedTabVisualAt in 750L..12000L',
    'observedAt - lastEmptyOpenOcrAt in 750L..12000L'
  ];
  for (const text of actualPhrases) assert.ok(history.includes(text), text);
  assert.ok(!history.includes('observedAt - lastOpenTabVisualAt429 in 1000L..12000L'));
  assert.ok(!history.includes('observedAt - lastEmptyOpenOcrAt in 1000L..12000L'));
  assert.ok(service.includes('if (historyPageVisible433 ||'));
  assert.ok(service.includes('historyPeekStartedAt592 > 0L || nonChartSafety595) 900L'));
  const isIndependent = (elapsed) => elapsed >= 750 && elapsed <= 12000;
  assert.equal(isIndependent(900), true);
  assert.equal(isIndependent(899), true);
  assert.equal(isIndependent(650), false);
  assert.equal(isIndependent(0), false);
});

test('611 does not weaken final 0 OPEN 2/2, DEMO-only or uncertain-order gate', () => {
  for (const phrase of [
    'tick - demoEmptyReviewFirstAt >= 2_000L',
    'demoEmptyReviewReads >= 2',
    'tradePositionGate.brokerVerifiedEmptyDemoReview(true)',
    'val unknownBaseEligible454 = !savedReconciled437 &&',
    '!demoAutoStakePlan565.isEnabled()',
    'demoRecoveryLedger.verifiedOpenPositionId429() == null',
    '!demoRecoveryLedger.isRecovering429()',
    'TouchTestService.priorDemoGestureCooldownComplete()',
    'historyReviewRequestedAt610',
    'realAccountSafetyStop517'
  ]) assert.ok(service.includes(phrase), phrase);
  const history = service.split('private fun recordExplicitEmptyOpenOcr(')[1]
    .split('private fun scheduleTimeframeOcr(',1)[0];
  assert.ok(!history.includes('pressVerifiedDemoStakeOnce429('));
  assert.ok(!history.includes('dispatchGesture('));
  assert.ok(!history.includes('putBoolean("attempted", false)'));
});

test('611 signed Moto G24 build runs the timing regression and uses a distinct version', () => {
  assert.ok(workflow.includes("expo['android']['versionCode']=612"));
  assert.ok(workflow.includes('ScalpAtlas-612-OVERLAY-QT-DEMO-G24.apk'));
  assert.ok(workflow.includes('test_611_history_ocr_timing.mjs'));
  assert.ok(workflow.includes('apksigner'));
});
