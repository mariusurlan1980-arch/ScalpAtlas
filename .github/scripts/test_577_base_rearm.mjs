import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
const service=readFileSync(new URL('../native-overlay/ScalpOverlayService.kt',import.meta.url),'utf8');
const touch=readFileSync(new URL('../native-overlay/TouchTestService.kt',import.meta.url),'utf8');
const plan=readFileSync(new URL('../native-overlay/DemoAutoStakePlan565.kt',import.meta.url),'utf8');
const workflow=readFileSync(new URL('../workflows/build-native-robot-safe-preflight-379.yml',import.meta.url),'utf8');
const stake=service.slice(service.indexOf('private fun maybeApplyVerifiedDemoStake565('),service.indexOf('private fun brokerOpenTimeMatchesAttempt437('));
const fx=service.slice(service.indexOf('fun verifyChart(pair: String, checks: Int)'),service.indexOf('fun select(previous:',service.indexOf('fun verifyChart(pair: String, checks: Int)')));
const pairFn=plan.slice(plan.indexOf('fun rebindVerifiedBasePair('),plan.indexOf('fun permitsFreshDemoOrder('));

test('577 ON confirmation reads the existing broker 1.09 before any optional SET_TEXT',()=>{
  assert.ok(stake.includes('val alreadyVerified577=try {'));
  assert.ok(stake.includes('TouchTestService.verifiedExactDemoStakeReadOnly577(pair,amount)'));
  assert.ok(stake.includes('quote580 == (amount to 92)'));
  const pre=stake.indexOf('val alreadyVerified577=try {');
  const edit=stake.indexOf('TouchTestService.setVerifiedDemoRecoveryStakeOnBroker(pair,amount)');
  assert.ok(pre>=0 && edit>pre);
  assert.ok(stake.includes('val result=if(alreadyVerified577)'));
  assert.ok(stake.includes('val readBack577=try {'));
  assert.ok(stake.includes('amount == 109L ||'));
  assert.ok(stake.includes('TouchTestService.verifiedExactDemoStakeReadOnly577(pair,amount)'));
  assert.ok(stake.includes('quote580 == (amount to 92)'));

  assert.ok(stake.indexOf('demoAutoStakePlan565.confirmEdited(key,pair,amount,true)') > stake.indexOf('readBack577'));
  assert.ok(stake.includes('autoDemoSessionRequested=true'));
  assert.ok(stake.includes('autoDemoSessionConsumed=false'));
  assert.ok(stake.includes('autoDemoLockedAt=lockedAt'));
  assert.ok(stake.includes('autoDemoEntryCycleStartedAt=System.currentTimeMillis()'));
});

test('577 exact amount read uses live QT Demo, independently rechecks FX pair and does not write or tap',()=>{
 const section=touch.slice(touch.indexOf('fun verifiedExactDemoStakeReadOnly577('),touch.indexOf('fun setVerifiedDemoRecoveryStakeOnBroker('));
 assert.ok(section.includes('readVisibleDemoPair() != expectedPair'));
 assert.ok(section.includes('DemoStakeEditor.verifiedExactDemoStakeReadOnly(svc, cents)'));
 assert.ok(section.includes('connected === svc'));
 assert.ok(!section.includes('performAction('));
 assert.ok(!section.includes('dispatchGesture('));
});

test('577 base pair switching is allowed ONLY on account-matched 1.09 and no loss recovery',()=>{
 for(const token of [
  '!isEnabled()','isRiskStopped()','!accountKey.startsWith("QT_DEMO:")',
  'accountKey != prefs.getString("accountKey",null)',
  'prefs.getInt("losses",-1) != 0',
  'prefs.getLong("pendingStake",-1L) == 109L',
  'prefs.getLong("confirmedStake",-1L) == 109L',
  '.putString("pair",newPair)'
 ])assert.ok(pairFn.includes(token),token);
 assert.ok(!pairFn.includes('.putLong("confirmedStake"'));
 assert.ok(!pairFn.includes('.putLong("pendingStake"'));
 assert.ok(!pairFn.includes('.putInt("losses"'));
 assert.ok(!pairFn.includes('pressVerified'));
 const orderFn=plan.slice(plan.indexOf('fun permitsFreshDemoOrder('));
 assert.ok(orderFn.includes('pair!=prefs.getString("pair",null)'));
 assert.ok(orderFn.includes('prefs.getLong("pendingStake",-1L)!=0L'));
});

test('577 FX rotation cannot rebind a pair while there is an attempt, open order or unverified quote',()=>{
 const i=fx.indexOf('demoAutoStakePlan565.rebindVerifiedBasePair(');
 assert.ok(i>0);
 const context=fx.slice(fx.indexOf('lastFxRotationMismatch548 = "PERECHE + PAYOUT'),i+140);
 for(const token of [
  '!realAccountSafetyStop517','!accountRecheckPending',
  '!closedHistoryInspectionInProgress','TouchTestService.demoFxAccountInForeground()',
  '!TouchTestService.realFxAccountVisible()',
  'tradePositionGate.state() == TradePositionGate.State.READY',
  'demoRecoveryLedger.verifiedOpenPositionId429() == null',
  'getBoolean("attempted",false)',
  'TouchTestService.readVerifiedDemoPayoutForPair(pair)==92',
  'TouchTestService.readBrokerDemoOrder476(pair)',
  'verifiedQuote585.first==109L',
  'activeDemoExecutorPackageForReview()'
 ])assert.ok(context.includes(token),token);
 assert.ok(!context.includes('pressVerifiedDemoStakeOnce429'));
});

test('577 empty Open tab remains insufficient proof to clear previous attempted order',()=>{
 const proof=service.slice(service.indexOf('private fun inspectPassiveDemoProof463('),service.indexOf('private fun maybeRearmExpiredDemoPilot464('));
 assert.ok(proof.includes('prefs.getBoolean("attempted", false)'));
 assert.ok(proof.includes('val closed = verifiedClosedDetail437'));
 assert.ok(proof.includes('LIPSEȘTE ID ÎNCHIS'));
 assert.ok(proof.includes('!brokerOpenTimeMatchesAttempt437(closed.openedSecondsOfDay, attemptedAt)'));
 assert.ok(proof.indexOf('val closed = verifiedClosedDetail437') <
   proof.indexOf('.putBoolean("attempted", false)'));
});

test('577 Android signed release ships rearm and strict pair tests',()=>{
 assert.ok(workflow.includes("expo['android']['versionCode']=606"));
 assert.ok(workflow.includes('ScalpAtlas-606-OVERLAY-QT-DEMO-G24.apk'));
 assert.ok(workflow.includes('node --test .github/scripts/test_577_base_rearm.mjs'));
 assert.ok(workflow.includes('apksigner'));
});
