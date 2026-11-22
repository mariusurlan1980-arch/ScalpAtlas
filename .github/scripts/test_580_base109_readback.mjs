import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';

const overlay=readFileSync(new URL('../native-overlay/ScalpOverlayService.kt',import.meta.url),'utf8');
const touch=readFileSync(new URL('../native-overlay/TouchTestService.kt',import.meta.url),'utf8');
const plan=readFileSync(new URL('../native-overlay/DemoAutoStakePlan565.kt',import.meta.url),'utf8');
const wf=readFileSync(new URL('../workflows/build-native-robot-safe-preflight-379.yml',import.meta.url),'utf8');
const stake=overlay.slice(
  overlay.indexOf('private fun maybeApplyVerifiedDemoStake565('),
  overlay.indexOf('private fun brokerOpenTimeMatchesAttempt437(')
);
const rotation=overlay.slice(
  overlay.indexOf('fun verifyChart(pair: String, checks: Int)'),
  overlay.indexOf('fun dwell(pair: String, deadline: Long, retries: Int)')
);
const quote=touch.slice(
  touch.indexOf('private fun readBrokerDemoOrder488('),
  touch.indexOf('fun preflightOneDollarDemoOrder(')
);
const uiQuote=touch.slice(
  touch.indexOf('private fun checkOneDollarDemoTarget('),
  touch.indexOf('fun readVerifiedDemoPayoutForStake429(')
);

test('580 base 1.09 pending stake is accepted only after strict broker quote',()=>{
 assert.ok(stake.includes('val alreadyVerified577=try {'));
 assert.ok(stake.includes('val quote580=TouchTestService.readBrokerDemoOrder476(pair)'));
 assert.ok(stake.includes('quote580 == (amount to 92)'));
 assert.ok(stake.includes('amount == 109L ||'));
 assert.ok(stake.includes('TouchTestService.verifiedExactDemoStakeReadOnly577(pair,amount)'));
 assert.ok(stake.includes('val result=if(alreadyVerified577)'));
 assert.ok(stake.includes('val readBack577=try {'));
 const second=stake.slice(stake.indexOf('val readBack577=try {'));
 assert.ok(second.includes('quote580 == (amount to 92)'));
 assert.ok(second.includes('amount == 109L ||'));
 assert.ok(second.includes('TouchTestService.verifiedExactDemoStakeReadOnly577(pair,amount)'));
 assert.ok(second.indexOf('demoAutoStakePlan565.confirmEdited(key,pair,amount,true)') >
   second.indexOf('val readBack577=try {'));
 assert.ok(stake.includes('autoDemoSessionRequested=true'));
 assert.ok(stake.includes('autoDemoSessionConsumed=false'));
 assert.ok(stake.includes('lockedAt'));
 assert.ok(stake.includes('demoAutoStakePlan565.permitsFreshDemoOrder(key,pair,amount)'));
});

test('580 quote is from full current Qt Demo, visible pair, both broker buttons, expiry, balance',()=>{
 for(const piece of [
  'priorDemoGestureCooldownComplete()',
  'readVisibleDemoPair()',
  'confirmedFiveMinuteDemoExpiry465()',
  'checkOneDollarDemoTarget("BUY", true, null)',
  'checkOneDollarDemoTarget("SELL", true, null)',
  'sell.stakeCents != stake',
  'sell.payoutPercent != payout',
  'buyTarget.activePackage != sellTarget.activePackage',
  '(stake to payout) to "PREGĂTIT AUTO DEMO"'
 ]) assert.ok(quote.includes(piece),piece);
 for(const piece of [
  'if (real) return DemoOrderCheck(reason = "BLOCAT: QT REAL PE ECRAN")',
  'if (!demo) return DemoOrderCheck(reason = "BLOCAT: QT DEMO NECONFIRMAT")',
  'val observedStakeCents =',
  'val balanceValues497 =',
  'DemoStakeEditor.demoBalanceFromVerifiedHeader579(label.value)',
  'balanceValues497.size != 1',
  'balanceValues497.single() < verifiedStakeCents',
  'if (payoutValues.size != 1 || payoutValues[0] != 92)',
  'if (candidates.size != 1)'
 ]) assert.ok(uiQuote.includes(piece),piece);
});

test('580 rotating base pair requires exact 1.09 quote + independent 92 and no pending order',()=>{
 const start=rotation.indexOf('val verifiedQuote585=try {');
 const end=rotation.indexOf('demoAutoStakePlan565.rebindVerifiedBasePair(',start);
 const part=rotation.slice(start,end);
 assert.ok(part.includes('TouchTestService.readBrokerDemoOrder476(pair)'));
 assert.ok(part.includes('TouchTestService.readVerifiedDemoPayoutForPair(pair)==92'));
 assert.ok(part.includes('verifiedQuote585.first==109L'));
 const pre=rotation.slice(rotation.indexOf('lastFxRotationMismatch548 = "PERECHE + PAYOUT'),end);
 for(const piece of [
  '!realAccountSafetyStop517','!accountRecheckPending',
  'tradePositionGate.state() == TradePositionGate.State.READY',
  'demoRecoveryLedger.verifiedOpenPositionId429() == null',
  'getBoolean("attempted",false)','TouchTestService.demoFxAccountInForeground()',
  '!TouchTestService.realFxAccountVisible()'
 ])assert.ok(pre.includes(piece),piece);
});

test('580 never weakens Martingale amount editing, verified CLOSED or one-position lock',()=>{
 assert.ok(uiQuote.includes('val hasDynamicStake = verifiedStakeCents > 100L'));
 assert.ok(uiQuote.includes('editableValues.size == 1'));
 assert.ok(uiQuote.includes('DemoStakeEditor.verifiedExactDemoStakeReadOnly(svc, verifiedStakeCents)'));
 assert.ok(touch.includes('if (stakeCents > 100L && !DemoStakeEditor.verifiedExactDemoStakeReadOnly(svc, stakeCents))'));
 assert.ok(overlay.includes('tradePositionGate.beginAttempt()'));
 assert.ok(overlay.includes('val closed = verifiedClosedDetail437'));
 assert.ok(plan.includes('PAYOUT_EXACT = 92'));
 assert.ok(plan.includes('STOP_AFTER_LOSSES = 10'));
 assert.ok(plan.includes('PLANNED_BUDGET_CENTS = 157244L'));
 const base=plan.slice(plan.indexOf('fun rebindVerifiedBasePair('),plan.indexOf('fun permitsFreshDemoOrder('));
 assert.ok(base.includes('prefs.getInt("losses",-1) != 0'));
 assert.ok(base.includes('prefs.getLong("pendingStake",-1L) == 109L'));
 assert.ok(base.includes('prefs.getLong("confirmedStake",-1L) == 109L'));
});

test('580 signed G24 release includes new base-stake verification regression',()=>{
 assert.ok(wf.includes("expo['android']['versionCode']=591"));
 assert.ok(wf.includes('node --test .github/scripts/test_580_base109_readback.mjs'));
 assert.ok(wf.includes('ScalpAtlas-591-PERSPECTIVES-RETURN-G24.apk'));
 assert.ok(wf.includes('apksigner'));
});
