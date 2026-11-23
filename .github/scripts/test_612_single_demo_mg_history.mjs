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
