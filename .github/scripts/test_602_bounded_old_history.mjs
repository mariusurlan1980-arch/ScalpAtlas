import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const service = readFileSync(new URL('../native-overlay/ScalpOverlayService.kt', import.meta.url), 'utf8');
const flow = readFileSync(new URL('../workflows/build-native-robot-safe-preflight-379.yml', import.meta.url), 'utf8');
const monitor=service.split('private fun startBrokerAccountMonitor()')[1]
  .split('private fun startDemoClickMonitor()')[0];

test('602 stale QT Demo attempt >24h can be inspected READ ONLY, never treated as CLOSED',()=>{
  assert.match(monitor,/wallAge592 >= DEMO_TEST_EXPIRY_MS_465 \+ 3_000L/);
  assert.match(monitor,/elapsedAge592 >= DEMO_TEST_EXPIRY_MS_465 \+ 3_000L/);
  assert.doesNotMatch(monitor,/wallAge592 in \(DEMO_TEST_EXPIRY_MS_465 \+ 3_000L\)\.\.86_400_000L/);
  assert.match(monitor,/val pendingAutoHistory589 = CHART_ONLY_DEMO_462 &&/);
  assert.match(service,/martingaleResultDurable581\(nextStakeStatus565\)/);
});
test('609 repeated history visit remains bounded, with 12s for old base attempt',()=>{
  for (const proof of [
    'val reviewCompleted600 = attemptKey600 != null',
    'previousReviewWall602 > 0L',
    'System.currentTimeMillis() - previousReviewWall602 in 0L..historyReviewCooldown609',
    'historyPeekRetryAfter592 = reviewNow592 + historyReviewCooldown609',
    '.putLong("completedAtWall602", System.currentTimeMillis())',
    '}, historyReviewWindow609)',
    'TouchTestService.advanceDemoClosedHistoryNavigation(true)',
    'returnToChartAfterReview458(true, true)'
  ]) assert.ok(monitor.includes(proof),proof);
  assert.match(monitor,/afterExpiry592 && !reviewCompleted600 &&/);
  assert.match(monitor,/QT REAL DETECTAT • ROBOT OPRIT/);
});
test('602 protects one-position / broker receipt / MG position gate',()=>{
  const proof=service.split('private fun inspectPassiveDemoProof463(')[1]
    .split('private fun maybeRearmExpiredDemoPilot464(')[0];
  for (const x of ['verifiedClosedDetail437','closed.positionId',
      'closed.stakeCents != stake','closed.payoutPercent != payout',
      'demoEmptyReviewReads','martingaleResultDurable581',
      '.putBoolean("attempted", false)']) assert.ok(proof.includes(x),x);
  assert.ok(proof.indexOf('onVerifiedClosed(')<proof.indexOf('.putBoolean("attempted", false)'));
});
test('602 current signed release and regressions',()=>{
  assert.match(flow,/versionCode'\]=610/);
  assert.match(flow,/ScalpAtlas-610-OVERLAY-QT-DEMO-G24\.apk/);
  assert.match(flow,/test_602_bounded_old_history\.mjs/);
});
