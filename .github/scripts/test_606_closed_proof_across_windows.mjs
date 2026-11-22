import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const service=readFileSync(new URL('../native-overlay/ScalpOverlayService.kt',import.meta.url),'utf8');
const flow=readFileSync(new URL('../workflows/build-native-robot-safe-preflight-379.yml',import.meta.url),'utf8');
const passive=service.split('private fun inspectPassiveDemoProof463(')[1].split('private fun maybeRearmExpiredDemoPilot464(')[0];
const monitor=service.split('private fun startBrokerAccountMonitor()')[1].split('private fun startDemoClickMonitor()')[0];
test('606 two independently verified CLOSED reads survive bounded five-minute revisit',()=>{
  assert.match(service,/private val closedProofHorizon606 = 12L \* 60_000L/);
  assert.match(passive,/verifiedClosedDetailAt437 in 0L\.\.closedProofHorizon606/);
  assert.match(passive,/verifiedClosedDetailAt437 !in 0L\.\.closedProofHorizon606/);
  assert.match(monitor,/verifiedClosedDetailAt437 in 0L\.\.closedProofHorizon606/);
  assert.match(service,/historyPeekRetryAfter592 = reviewNow592 \+ 297_000L/);
  assert.match(service,/\}, 3_000L\)/);
});
test('606 retaining CLOSE does not infer an order outcome or weaken missing OPEN guard',()=>{
  for(const v of ['closed.positionId','closed.stakeCents != stake','closed.payoutPercent != payout',
    'brokerOpenTimeMatchesAttempt437(closed.openedSecondsOfDay, attemptedAt)',
    'demoEmptyReviewReads','TouchTestService.inspectExplicitEmptyOpenDemoTabReadOnly(',
    'martingaleResultDurable581(nextStakeStatus565)',
    'tradePositionGate.brokerVerifiedEmptyDemoReview(true)',
    '.putBoolean("attempted", false)']) assert.ok(passive.includes(v),v);
  assert.match(monitor,/matchingAttempt437 &&/);
  assert.match(monitor,/closedProof437\.brokerPackage == expectedPackage429/);
  assert.match(monitor,/closedProof437\.pair == expectedPair429/);
  assert.match(monitor,/closedProof437\.stakeCents == expectedStake429/);
  assert.match(monitor,/closedProof437\.payoutPercent == expectedPayout429/);
  assert.match(monitor,/brokerOpenTimeMatchesAttempt437\(/);
});
test('606 preserves Demo and strict martingale checks and previous chart rules',()=>{
  assert.match(service,/private const val CHART_ONLY_DEMO_462 = true/);
  assert.match(service,/QT REAL DETECTAT • ROBOT OPRIT/);
  assert.match(service,/\(historyFresh592 \|\| brokerChartReturnProven604\) &&/);
  assert.match(service,/PAYOUT NECITIT • SAR/);
  assert.match(service,/demoAutoStakePlan565\.onVerifiedClosed\(/);
});
test('606 release has unique signed Motorola artifact',()=>{
  assert.match(flow,/versionCode'\]=607/);
  assert.match(flow,/ScalpAtlas-607-OVERLAY-QT-DEMO-G24\.apk/);
  assert.match(flow,/test_606_closed_proof_across_windows\.mjs/);
});
