import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../native-overlay/ScalpOverlayService.kt', import.meta.url), 'utf8');
const flow = readFileSync(new URL('../workflows/build-native-robot-safe-preflight-379.yml', import.meta.url), 'utf8');

test('610 user MG ON gesture grants only a time-limited read-only QT Demo history visit', () => {
  const click = src.split('val stakeButton565 = localButton(')[1]
    .split('stakeAutoRow565.addView',1)[0];
  for (const term of [
    'val oldShock610 = getSharedPreferences(',
    'historyReviewRequestedAt610 = if (oldShock610 &&',
    '!demoAutoStakePlan565.isEnabled()',
    '!demoAutoStakePlan565.isRiskStopped()',
    'demoRecoveryLedger.verifiedOpenPositionId429() == null',
    '!demoRecoveryLedger.isRecovering429()',
    '!realAccountSafetyStop517',
    'TouchTestService.demoFxAccountInForeground()',
    'requestAt572 else 0L',
  ]) assert.ok(click.includes(term),term);
  assert.ok(!click.includes('pressVerifiedDemoStakeOnce429('));
  assert.ok(!click.includes('pressAutoOneDollarDemoOrderOnce('));
  assert.ok(!click.includes('putBoolean("attempted", false)'));
});

test('610 never enters auto history before expired prior attempt and explicit permission', () => {
  const start = src.indexOf('val userReview610 =');
  const end = src.indexOf('if (pendingAutoHistory589)',start);
  const snippet = src.slice(start,end);
  for (const term of [
    'historyReviewRequestedAt610 > 0L',
    'pendingStakeOptIn571',
    'nowElapsed592 - historyReviewRequestedAt610 in 0L..90_000L',
    'attempted592',
    '!demoAutoStakePlan565.isEnabled()',
    'demoRecoveryLedger.verifiedOpenPositionId429() == null',
    'TouchTestService.demoFxAccountInForeground()',
    'historyFresh592 || brokerChartReturnProven604 || userReview610',
    'afterExpiry592 && !reviewCompleted600',
    'nowElapsed592 >= historyPeekRetryAfter592',
  ]) assert.ok(snippet.includes(term),term);
  assert.ok(!snippet.includes('brokerVerifiedEmptyDemoReview(true)'));
  assert.ok(!snippet.includes('pressAnyPairDemo'));
});

test('610 preserves 609 two-read no-OPEN check and broker position safeguards', () => {
  assert.ok(src.includes('val legacyBaseReview609 = attempted592 &&'));
  assert.ok(src.includes('val historyReviewWindow609 = 3_000L'));
  assert.ok(src.includes('demoEmptyReviewReads >= 2'));
  assert.ok(src.includes('tradePositionGate.brokerVerifiedEmptyDemoReview(true)'));
  assert.ok(src.includes('val unknownBaseEligible454 = !savedReconciled437 &&'));
  assert.ok(src.includes('if (unknownBaseCleared454) {\n                  pendingReceipt429 = false\n                  historyReviewRequestedAt610 = 0L'));
  assert.ok(src.includes('realAccountSafetyStop517 = true\n          historyReviewRequestedAt610 = 0L'));
});

test('610 G24 signed release references regression, new code and arm64 APK', () => {
  assert.ok(flow.includes("expo['android']['versionCode']=612"));
  assert.ok(flow.includes('ScalpAtlas-612-OVERLAY-QT-DEMO-G24.apk'));
  assert.ok(flow.includes('node --test .github/scripts/test_610_history_bootstrap.mjs'));
  assert.ok(flow.includes('fix/scalpatlas-610-user-authorized-history-proof'));
  assert.ok(flow.includes('apksigner'));
});
