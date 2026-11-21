import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../native-overlay/ScalpOverlayService.kt',import.meta.url),'utf8');
const workflow=readFileSync(new URL('../workflows/build-native-robot-safe-preflight-379.yml',import.meta.url),'utf8');
const start=source.indexOf('private fun maybeFinishStakeOptIn571(');
const end=source.indexOf('private fun maybeApplyVerifiedDemoStake565(',start);
const gate=source.slice(start,end);
const clickStart=source.indexOf('val stakeButton565 =');
const clickEnd=source.indexOf('stakeAutoRow565.addView(',clickStart);
const click=source.slice(clickStart,clickEnd);
test('572 explains every original fail-closed preflight gate without granting an order',()=>{
 for(const check of [
  'accountRecheckPending',
  'fxRotationNavigating',
  'fxRotationTradePaused516',
  'closedHistoryInspectionInProgress',
  'historyPageVisible433',
  '!TouchTestService.ready()',
  '!TouchTestService.demoFxAccountInForeground()',
  '!lastBrokerAccountStatus.contains("QT DEMO IDENTIFICAT")',
  'tradePositionGate.state() != TradePositionGate.State.READY',
  'getBoolean("attempted", false)',
  'pairReady(nowPair572)',
  'TouchTestService.readVerifiedDemoPayoutForPair(pair) != 92',
  'demoAutoStakePlan565.enableFromVerifiedDemo("QT_DEMO:" + pkg, pair)',
 ])assert.ok(gate.includes(check), check);
 assert.ok(gate.includes('stakeOptInReason572 = "572 • " + waiting572'));
 assert.ok(!gate.includes('pressVerifiedDemoStakeOnce429('));
 assert.ok(!gate.includes('dispatchGesture('));
});
test('572 independent timeout only cancels the SAME pending user opt-in',()=>{
 assert.ok(click.includes('val requestAt572 = pendingStakeOptInAt571'));
 assert.ok(click.includes('pendingStakeOptIn571 && pendingStakeOptInAt571 == requestAt572'));
 assert.ok(click.includes('}, 90_500L)'));
 assert.ok(click.includes('text = "MIZĂ AUTO DEMO • OFF"'));
 assert.ok(click.includes('probeStatus.text = stakeOptInReason572 + " • FĂRĂ ORDIN"'));
});
test('572 new status visible in preflight without overriding risk stop or permission',()=>{
 assert.ok(source.includes('if (pendingStakeOptIn571) stakeOptInReason572'));
 assert.ok(source.includes('demoAutoStakePlan565.isRiskStopped()'));
 assert.ok(source.includes('demoAutoStakePlan565.permitsFreshDemoOrder('));
 const plan=readFileSync(new URL('../native-overlay/DemoAutoStakePlan565.kt',import.meta.url),'utf8');
 assert.ok(plan.includes('PLANNED_BUDGET_CENTS = 157244L'));
 assert.ok(plan.includes('STOP_AFTER_LOSSES = 10'));
 assert.ok(plan.includes('private val LADDER = longArrayOf(109L,228L'));
});
test('572 builds signed APK and runs 572 test',()=>{
 assert.ok(workflow.includes("expo['android']['versionCode']=575"));
 assert.ok(workflow.includes('ScalpAtlas-575-MINI-CHENAR-DEMO-G24.apk'));
 assert.ok(workflow.includes('node --test .github/scripts/test_572_optin_diag.mjs'));
 assert.ok(workflow.includes('apksigner'));
});
