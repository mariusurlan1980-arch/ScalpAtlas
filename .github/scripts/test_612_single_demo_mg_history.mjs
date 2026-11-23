import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const svc = readFileSync(new URL('../native-overlay/ScalpOverlayService.kt', import.meta.url),'utf8');
const stake = readFileSync(new URL('../native-overlay/DemoAutoStakePlan565.kt', import.meta.url),'utf8');
const wf = readFileSync(new URL('../workflows/build-native-robot-safe-preflight-379.yml', import.meta.url),'utf8');

test('612 permits one initial exact 1.09/92 QT Demo pilot without activating Martingale',()=>{
 const start=svc.indexOf('private fun firstBaseDemoWithoutMg612(');
 const end=svc.indexOf('private fun maybeFinishStakeOptIn571(',start);
 assert.ok(start>0 && end>start);
 const check=svc.slice(start,end);
 for (const phrase of [
   'brokerOrder != (109L to 92)',
   'demoAutoStakePlan565.isEnabled()',
   'demoAutoStakePlan565.isRiskStopped()',
   '!autoDemoSessionRequested || autoDemoSessionConsumed',
   'mediaProjection == null',
   'realAccountSafetyStop517',
   'tradePositionGate.state() != TradePositionGate.State.READY',
   'demoRecoveryLedger.verifiedOpenPositionId429() != null',
   'demoRecoveryLedger.isRecovering429()',
   'demoRecoveryLedger.needsBaseStakeReset()',
   'getBoolean("attempted", false)',
   'TouchTestService.priorDemoGestureCooldownComplete()',
   'TouchTestService.realFxAccountVisible()'
 ]) assert.ok(check.includes(phrase),phrase);
 assert.ok(!check.includes('pressVerifiedDemoStakeOnce429('));
 assert.ok(!check.includes('putBoolean("attempted", false)'));
});

test('616 confirms pending 1.09 first base only from current verified QT Demo 92 percent broker quote, with all old order gates',()=>{
  const from=svc.indexOf('private fun synchronizeVerifiedDemoPair613(');
  const to=svc.indexOf('private fun firstBaseDemoWithoutMg612(',from);
  assert.ok(from>0 && to>from);
  const fn=svc.slice(from,to);
  const checked=[
    'demoAutoStakePlan565.isEnabled()', 'demoAutoStakePlan565.isRiskStopped()',
    'brokerOrder.second != 92', 'brokerOrder.first <= 0L',
    'tradePositionGate.state() != TradePositionGate.State.READY',
    'demoRecoveryLedger.verifiedOpenPositionId429() != null',
    'getBoolean("attempted", false)', 'TouchTestService.priorDemoGestureCooldownComplete()',
    'TouchTestService.readVisibleDemoPair() != pair',
    'TouchTestService.readBrokerDemoOrder476(pair) != brokerOrder',
    'TouchTestService.readVerifiedDemoPayoutForPair(pair) != 92',
    'demoAutoStakePlan565.rebindVerifiedBasePair(key613, pair)',
    'brokerOrder.first == 109L', '!demoAutoStakePlan565.permitsFreshDemoOrder(',
    'TouchTestService.confirmedFiveMinuteDemoExpiry465()',
    'demoAutoStakePlan565.confirmEdited(key613, pair, 109L, true)',
    'demoAutoStakePlan565.permitsFreshDemoOrder('
  ];
  for(const rule of checked) assert.ok(fn.includes(rule),rule);
  assert.ok(fn.indexOf('TouchTestService.readBrokerDemoOrder476(pair) != brokerOrder')<
    fn.indexOf('demoAutoStakePlan565.confirmEdited(key613, pair, 109L, true)'));
  assert.ok(!fn.includes('pressVerifiedDemoStakeOnce429('));
  assert.ok(!fn.includes('onVerifiedClosed('));
  assert.ok(!fn.includes('putBoolean("attempted", false)'));
});

test('612 connects exact first-base pilot to preflight, arming and final dispatch; MG stays locked until CLOSED',()=>{
 assert.ok(svc.includes('firstBaseDemoWithoutMg612(pair,order565,pkg565)'));
 assert.ok(svc.includes('firstBaseDemoWithoutMg612(tradePair429,manualOrder,package429)'));
 assert.ok(svc.includes('firstBaseDemoWithoutMg612('));
 assert.ok(svc.includes('if (!latestPreflight.startsWith("PREGĂTIT AUTO DEMO"))'));
 assert.ok(svc.includes('tradePositionGate.beginAttempt()'));
 assert.ok(svc.includes('TouchTestService.pressVerifiedDemoStakeOnce429('));
 for(const rule of [
   'fun onVerifiedClosed(',
   'matchingOpenClosedAndZeroOpen: Boolean',
   'if(netProfitCents<0L)',
   'if(netProfitCents>0L',
   'putInt("losses",0)',
   'putLong("pendingStake",LADDER[0])',
   'val next=LADDER[nextLosses]',
   'prefs.getLong("pendingStake",0L)',
   'fun confirmEdited('
 ]) assert.ok(stake.includes(rule),rule);
 assert.ok(svc.includes('demoAutoStakePlan565.onVerifiedClosed('));
});

test('612 ends each history evidence visit at three seconds, without assuming settlement',()=>{
 assert.ok(svc.includes('val historyReviewWindow609 = 3_000L'));
 assert.ok(!svc.includes('val historyReviewWindow609 = if (legacyBaseReview609) 12_000L else 3_000L'));
 assert.ok(svc.includes('}, historyReviewWindow609)'));
 assert.ok(svc.includes('recoveryNow595 - historyPageFirstSeenAt603 >= historyReviewWindow609'));
 assert.ok(svc.includes('returnToChartAfterReview458(true, true)'));
 assert.ok(svc.includes('val historyReviewCooldown609 = if (legacyBaseReview609) 30_000L else 297_000L'));
 assert.ok(svc.includes('demoEmptyReviewReads >= 2'));
 assert.ok(svc.includes('tick - demoEmptyReviewFirstAt >= 2_000L'));
 assert.ok(svc.includes('verifiedClosedDetail437'));
 assert.ok(!svc.includes('val historyReviewWindow609 = 12_000L'));
});

test('612 builds only a new signed G24 candidate, not an unvalidated order guarantee',()=>{
 assert.ok(wf.includes("expo['android']['versionCode']=612"));
 assert.ok(wf.includes('ScalpAtlas-612-OVERLAY-QT-DEMO-G24.apk'));
 assert.ok(wf.includes('node --test .github/scripts/test_612_single_demo_mg_history.mjs'));
 assert.ok(wf.includes('apksigner'));
});

test('617 audible signal persists G0 blocker across currency rotation without authorizing an order',()=>{
 const beepStart=svc.indexOf('val tradeAudioReady573 =');
 const beepEnd=svc.indexOf('private fun formatSeconds(',beepStart);
 const beep=svc.slice(beepStart,beepEnd);
 assert.ok(beep.includes('audibleSignalAt617 = now'));
 assert.ok(beep.includes('audibleSignalPair617 = currentPair(now)'));
 assert.ok(beep.indexOf('audibleSignalAt617 = now') < beep.indexOf('playBip(confirmedSignal)'));
 const rejected=svc.slice(svc.indexOf('} else if (!readyForDemo) {'),
   svc.indexOf('} else {\n          // 419:',svc.indexOf('} else if (!readyForDemo) {')));
 assert.ok(rejected.includes('val rejection617 = when'));
 assert.ok(rejected.includes('!pairReady(now) || pairMismatch || pairLostLong'));
 assert.ok(rejected.includes('!planPairReady613'));
 assert.ok(rejected.includes('audibleSignalGate617 = rejection617.take(85)'));
 assert.ok(!rejected.includes('pressVerifiedDemoStakeOnce429('));
 const marker=svc.indexOf('val postSignal556 = when {');
 const status=svc.slice(marker,svc.indexOf('val diagnostic556 =',marker));
 assert.ok(status.includes('audibleSignalAt617 == lastConfirmedAt556'));
 assert.ok(status.includes('BIP • G0 • '));
 assert.ok(status.includes('demoDiagGestureChecks546 > gestureChecksAtSignal556'));
 assert.ok(status.includes('ROTAȚIE / PERECHE SCHIMBATĂ'));
 assert.ok(svc.includes('val historyReviewWindow609 = 3_000L'));
 assert.ok(svc.includes('dwell(pair, android.os.SystemClock.elapsedRealtime() + 30_000L, 12)'));
});

test('618 recovers actual 92% QT Demo chart without guessing an instrument or ordering',()=>{
  const from=svc.indexOf('fun verifyChart(pair: String, checks: Int)');
  const end=svc.indexOf('fun dwell(pair: String, deadline:',from);
  assert.ok(from>0 && end>from);
  const scanner=svc.slice(from,end);
  for(const gate of [
    'chartPair548 != null', 'chartPair548 != pair',
    'chartPair548 !in visited', '!realAccount',
    'TouchTestService.isPreferredFxPair517(chartPair548)',
    'TouchTestService.demoFxAccountInForeground()',
    '!TouchTestService.realFxAccountVisible()',
    '!TouchTestService.fxListVisible(false)',
    'TouchTestService.readFxChartPayout(chartPair548, false) == 92',
    'after(900L)', 'actual618 == chartPair548',
    'verifyChart(chartPair548, 8)', 'recoverNavigation(pair,'
  ]) assert.ok(scanner.includes(gate),gate);
  const proof= scanner.indexOf('actual618 == chartPair548');
  const next = scanner.indexOf('verifyChart(chartPair548, 8)');
  assert.ok(proof >= 0 && next > proof);
  assert.ok(!scanner.includes('pressVerifiedDemoStakeOnce429('));
  assert.ok(svc.includes('dwell(pair, android.os.SystemClock.elapsedRealtime() + 30_000L, 12)'));
  assert.ok(svc.includes('val historyReviewWindow609 = 3_000L'));
});
