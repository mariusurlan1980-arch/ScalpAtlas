import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';

const source = readFileSync(new URL('../native-overlay/ScalpOverlayService.kt', import.meta.url), 'utf8');
const workflow = readFileSync(new URL('../workflows/build-native-robot-safe-preflight-379.yml', import.meta.url), 'utf8');

test('612 bounds every QT Demo history review to three seconds', () => {
  const start = source.indexOf('val legacyBaseReview609 =');
  const end = source.indexOf('// 595: QT Demo', start);
  assert.ok(start > 0 && end > start);
  const review = source.slice(start, end);
  for (const proof of [
    'attempted592',
    'getLong("expectedStakeCents429", -1L) in',
    'setOf(100L, 109L)',
    '!demoAutoStakePlan565.isEnabled()',
    '!demoAutoStakePlan565.isRiskStopped()',
    'demoRecoveryLedger.verifiedOpenPositionId429() == null',
    '!demoRecoveryLedger.isRecovering429()',
    'TouchTestService.priorDemoGestureCooldownComplete()',
    'val historyReviewWindow609 = 3_000L',
    'historyPeekRetryAfter592 = reviewNow592 + historyReviewCooldown609',
    '}, historyReviewWindow609)',
  ]) assert.ok(review.includes(proof), proof);
  assert.ok(!review.includes('pressVerifiedDemoStakeOnce429('));
  assert.ok(!review.includes('dispatchGesture('));
  assert.ok(!review.includes('putBoolean("attempted", false)'));
});

test('609 checks EMPTY OPEN twice before the legacy base-stake release', () => {
  assert.ok(source.includes('historyPageTab433 == "DESCHIS" &&\n            !legacyBaseReview609'));
  assert.ok(source.includes('recoveryNow595 - historyPageFirstSeenAt603 >= historyReviewWindow609'));
  const start = source.indexOf('val explicitZero = eligibleForBrokerEmptyReview');
  const end = source.indexOf('val unknownBaseEligible454', start);
  assert.ok(start > 0 && end > start);
  const proof = source.slice(start, end);
  assert.ok(proof.includes('TouchTestService.inspectExplicitEmptyOpenDemoTabReadOnly('));
  assert.ok(proof.includes('demoEmptyReviewReads >= 2'));
  assert.ok(proof.includes('tradePositionGate.brokerVerifiedEmptyDemoReview(true)'));
  assert.ok(source.includes('!demoAutoStakePlan565.isEnabled() &&\n                  !demoAutoStakePlan565.isRiskStopped()'));
  assert.ok(source.includes('!savedReconciled437'));
});

test('609 signed APK workflow references the guarded recovery test', () => {
  assert.ok(workflow.includes("expo['android']['versionCode']=612"));
  assert.ok(workflow.includes('ScalpAtlas-612-OVERLAY-QT-DEMO-G24.apk'));
  assert.ok(workflow.includes('node --test .github/scripts/test_609_open_review.mjs'));
  assert.ok(workflow.includes('apksigner'));
  assert.ok(workflow.includes("fix/scalpatlas-609-empty-open-review"));
});
