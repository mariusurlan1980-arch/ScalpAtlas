import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { buildMartingaleLadder562, simulateMartingaleSeries562 } from '../../scalp-atlas-new/martingaleTenDemo562.ts';
const kotlin=readFileSync(new URL('../native-overlay/DemoAutoStakePlan565.kt',import.meta.url),'utf8');
const editor=readFileSync(new URL('../native-overlay/DemoStakeEditor.kt',import.meta.url),'utf8');
const touch=readFileSync(new URL('../native-overlay/TouchTestService.kt',import.meta.url),'utf8');
const service=readFileSync(new URL('../native-overlay/ScalpOverlayService.kt',import.meta.url),'utf8');
const workflow=readFileSync(new URL('../workflows/build-native-robot-safe-preflight-379.yml',import.meta.url),'utf8');
const ladder=buildMartingaleLadder562();
const S=ladder.map(x=>x.stakeCents), totals=ladder.map(x=>x.totalLossesIfThisFailsCents);
const material=kotlin.match(/private val LADDER = longArrayOf\(([\s\S]*?)\)/)?.[1];
assert.ok(material,'Kotlin ladder missing');
const nativeS=[...material.matchAll(/(\d+)L/g)].map(m=>Number(m[1]));
test('same ten-stage USD stakes in TS and native Android',()=>{
 assert.deepEqual(nativeS,S);
 assert.deepEqual(S,[109,228,475,992,2070,4320,9016,18816,39268,81950]);
});
test('1500 USD covers nine theoretical stages, never the tenth',()=>{
 assert.equal(totals[8],75294);
 assert.equal(totals[9],157244);
 assert.equal(150000-totals[8],74706);
 assert.equal(S[9]-(150000-totals[8]),7244);
 assert.equal(ladder.filter(x=>x.totalLossesIfThisFailsCents<=150000).length,9);
});
test('no +$1 objective is possible on level ten with only $1500 reserved',()=>{
 const available=150000-totals[8];
 const net=Math.floor(available*92/100)-totals[8];
 assert.equal(net,-6564);
});
test('each winning level exactly returns at least +$1 after losses',()=>{
 for (let k=0;k<10;k++) {
  const series=[...Array(k).fill('LOSS'),'WIN'];
  const r=simulateMartingaleSeries562(series);
  assert.equal(r.state,'TARGET_REACHED');assert.ok(r.netCents>=100);
 }
});
test('ten full losses stop at 1572.44 USD, cannot be funded on $1500',()=>{
 const r=simulateMartingaleSeries562(Array(10).fill('LOSS'));
 assert.equal(r.state,'FAILED_TEN_LOSSES');
 assert.equal(r.netCents,-157244);
});
test('no three-loss lock remains in the 566 active QT DEMO stake plan',()=>{
 assert.match(kotlin,/const val STOP_AFTER_LOSSES = 10/);
 assert.match(kotlin,/const val PLANNED_BUDGET_CENTS = 150000L/);
 assert.doesNotMatch(kotlin,/STOP • 3 LOSS/);
 assert.match(kotlin,/nextLosses>=STOP_AFTER_LOSSES/);
});
test('budget and account are independently verified before editing',()=>{
 for(const token of ['cumLoss+next>PLANNED_BUDGET_CENTS',
  'cumLoss+stake>PLANNED_BUDGET_CENTS','cumLoss+stakeCents>PLANNED_BUDGET_CENTS',
  'accountKey!=prefs.getString("accountKey",null)','stakeCents!=LADDER[losses]'])
  assert.ok(kotlin.includes(token),token);
 assert.match(editor,/before.balanceCents < stakeCents/);
 assert.match(editor,/before.payout != 92/);
});
test('Android stake editor can inspect 819.50 DEMO with fail-closed readback',()=>{
 assert.ok(editor.includes('100L..81950L'));
 assert.ok(editor.includes('after.payout != before.payout'));
 assert.ok(editor.includes('centsOf(after.input.value) != stakeCents'));
 assert.ok(editor.includes('SOLD DEMO INSUFICIENT'));
 assert.ok(editor.includes('QT\\s*Real'));
});
test('verified broker OPEN/CLOSED detail supports ten-level amounts',()=>{
 assert.match(touch,/private const val DEMO_MAX_STAKE_566 = 81950L/);
 assert.match(touch,/stakeValue !in 100L\.\.DEMO_MAX_STAKE_566/);
 assert.match(touch,/stake in 100L\.\.DEMO_MAX_STAKE_566/);
 assert.match(touch,/verifiedExactDemoStakeReadOnly/);
});
test('no REAL or stale history can move miza',()=>{
 assert.ok(service.includes('realAccountSafetyStop517'));
 assert.ok(service.includes('historyPageVisible433'));
 assert.ok(service.includes('tradePositionGate.state()!=TradePositionGate.State.READY'));
 assert.ok(service.includes('verifiedClosedDetail437'));
 assert.ok(service.includes('matchingOpenClosedAndZeroOpen=true'));
 assert.ok(service.includes('closed.stakeCents != stake'));
});
test('fresh broker readback and a new signal are mandatory before rearm',()=>{
 const a=service.indexOf('private fun maybeApplyVerifiedDemoStake565(');
 const b=service.indexOf('private fun brokerOpenTimeMatchesAttempt437(',a);
 const block=service.slice(a,b);
 for(const token of ['demoAutoStakePlan565.confirmEdited(key,pair,amount,true)',
  'robotArmedContinuously513','autoDemoSessionEndAt > nowElapsed',
  'autoDemoLockedAt=lockedAt','autoDemoEntryCycleStartedAt=System.currentTimeMillis()',
  'demoAutoStakePlan565.permitsFreshDemoOrder(key,pair,amount)'])
  assert.ok(block.includes(token),token);
 assert.ok(block.indexOf('autoDemoSessionConsumed=true')<block.indexOf('TouchTestService.setVerifiedDemoRecoveryStakeOnBroker'));
});
test('manual and automatic QT DEMO order paths respect persisted risk stop',()=>{
 assert.ok(service.includes('demoAutoStakePlan565.isRiskStopped()'));
 assert.ok(service.includes('!demoAutoStakePlan565.permitsFreshDemoOrder('));
 assert.ok(service.includes('val allowedStake565='));
 assert.ok(service.includes('MIZĂ AUTO DEMO • ON'));
});
test('disable is explicit and does not authorize a broker action',()=>{
 assert.match(kotlin,/fun disable\(\): Boolean/);
 assert.doesNotMatch(kotlin,/dispatchGesture|performAction|pressVerifiedDemoStakeOnce429/);
});
test('new isolated 566 prefs prevent accidental reuse of old three-loss STOP',()=>{
 assert.ok(service.includes('scalp_atlas_demo_auto_stake_566'));
 assert.ok(!service.includes('scalp_atlas_demo_auto_stake_565'));
});
test('release pipeline packages 566 and retains apk signer',()=>{
 assert.ok(workflow.includes('DemoAutoStakePlan565.kt'));
 assert.ok(workflow.includes('node --experimental-strip-types --test .github/scripts/test_566_balance_risk.mjs'));
 assert.ok(workflow.includes("expo['android']['versionCode']=566"));
 assert.ok(workflow.includes('apksigner'));
});
