import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const service=readFileSync(new URL('../native-overlay/ScalpOverlayService.kt',import.meta.url),'utf8');
const workflow=readFileSync(new URL('../workflows/build-native-robot-safe-preflight-379.yml',import.meta.url),'utf8');
const monitor=service.split('private fun startBrokerAccountMonitor()')[1].split('private fun startDemoClickMonitor()')[0];
const ocr=service.split('private fun recordExplicitEmptyOpenOcr(')[1].split('private fun scheduleTimeframeOcr(')[0];
const chartExit=service.split('private fun returnToChartAfterReview458(')[1].split('private fun navigateVerifiedDemoHistory431(')[0];

test('610 chart-first default, with explicit short-lived user-authorized history exception',()=>{
  assert.match(monitor,/val userReview610 = historyReviewRequestedAt610 > 0L &&/);
  assert.match(monitor,/val pendingAutoHistory589 = CHART_ONLY_DEMO_462 &&[\s\S]*?\(historyFresh592 \|\| brokerChartReturnProven604 \|\| userReview610 \|\| verifiedExpiredReview624\) &&/);
  assert.match(monitor,/nowElapsed592 - historyReviewRequestedAt610 in 0L\.\.90_000L/);
  assert.match(monitor,/pendingStakeOptIn571 &&/);
  assert.match(monitor,/if \(CHART_ONLY_DEMO_462 && !pendingAutoHistory589\) \{/);
  assert.match(ocr,/if\(chartProofSamples595>=2\)\{/);
  assert.match(ocr,/quickNavAttemptAt595 > 0L/);
  assert.match(ocr,/pkg == verifiedDemoAccountPackage/);
  assert.match(ocr,/brokerChartReturnProven604=true/);
});
test('604 only one More navigation attempt per history visit, no unverified route orders',()=>{
  assert.match(chartExit,/moreNavAttemptAt595 >= historyPageFirstSeenAt603/);
  assert.match(chartExit,/MAI MULTE DEJA VERIFICAT/);
  assert.match(chartExit,/TouchTestService\.tapVerifiedDemoMoreFooter595\(/);
  assert.match(monitor,/TouchTestService\.tapVerifiedDemoQuickTradingEntry595\(/);
  assert.match(ocr,/moreNavAttemptAt595 = 0L/);
  assert.doesNotMatch(chartExit,/onVerifiedClosed|\.putBoolean\("attempted", false\)/);
});
test('604 keeps exact QT Demo and Martingale proof before subsequent order',()=>{
  assert.match(service,/private const val CHART_ONLY_DEMO_462 = true/);
  assert.match(service,/tradePositionGate\.brokerVerifiedEmptyDemoReview\(true\)/);
  assert.match(service,/demoAutoStakePlan565\.onVerifiedClosed\(/);
  assert.match(service,/QT REAL DETECTAT • ROBOT OPRIT/);
  assert.match(service,/val historyReturnDue603 = historyFresh592 &&/);
});
test('604 distinct signed Motorola APK',()=>{
  assert.match(workflow,/versionCode'\]=612/);
  assert.match(workflow,/ScalpAtlas-612-OVERLAY-QT-DEMO-G24\.apk/);
  assert.match(workflow,/test_604_protect_chart_from_history\.mjs/);
});

test('624 autonomous history request only follows an exact expired Demo attempt and fresh verified chart',()=>{
 const gate=monitor.split('val verifiedExpiredReview624 =')[1].split('val pendingAutoHistory589 =')[0];
 for(const x of ['afterExpiry592','expiredDemoPackage624 == attemptPrefs592.getString("expectedPackage429", null)','expectedPair429','expectedStakeCents429','expectedPayout429','chartProofSamples595 >= 2','!nonChartSafety595','!fxRotationNavigating','!realAccountSafetyStop517','TouchTestService.demoFxAccountInForeground()','!TouchTestService.realFxAccountVisible()','!TouchTestService.fxListVisible(false)','TouchTestService.priorDemoGestureCooldownComplete()']) assert.ok(gate.includes(x),x);
 assert.doesNotMatch(gate,/putBoolean|dispatchGesture|performAction/);
});
test('624 unsigned broker profit is accepted only for exact zero with other receipt proofs intact',()=>{
 const detail=service.split('private fun recordClosedDetailOcr437(')[1].split('private fun recordClosedListRowOcr438(')[0];
 for(const x of ['net != 0L && !netRaw.trim().startsWith("+")','!netRaw.trim().startsWith("-")','val stake = paid - net','paid != stake + net','ids.size != 1','candidate == firstClosedDetail437']) assert.ok(detail.includes(x),x);
});

test('631 chart-first observation precedes history fallback and cannot settle an order',()=>{
 const observation=service.split('private fun observeChartResult631(')[1].split('private fun scheduleTimeframeOcr(')[0];
 for(const x of ['chartResultAttempt631() ?: return','TouchTestService.demoFxAccountInForeground()','TouchTestService.realFxAccountVisible()','TouchTestService.readVisibleFxPair(false) != pair','statedStake.singleOrNull() != stake','blockPairs.singleOrNull() != pair','chartHintReads631']) assert.ok(observation.includes(x),x);
 assert.doesNotMatch(observation,/onVerifiedClosed|putBoolean|pressVerifiedDemoStake|dispatchGesture|brokerConfirmedClosed/);
 assert.ok(monitor.includes('(historyFresh592 || chartResultAttempt631() == null) &&'));
 const scheduler=service.split('private fun scheduleTimeframeOcr(')[1].split('private fun startProjection(')[0];
 assert.ok(scheduler.includes('chartResultAttempt631() != null) 900L'));
 assert.ok(scheduler.includes('observeChartResult631(result, copy, observedAt)'));
 assert.match(service,/val historyReviewWindow609 = 3_000L/);
});
