import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';

const plan=readFileSync(new URL('../native-overlay/DemoAutoStakePlan565.kt',import.meta.url),'utf8');
const service=readFileSync(new URL('../native-overlay/ScalpOverlayService.kt',import.meta.url),'utf8');
const editor=readFileSync(new URL('../native-overlay/DemoStakeEditor.kt',import.meta.url),'utf8');
const workflow=readFileSync(new URL('../workflows/build-native-robot-safe-preflight-379.yml',import.meta.url),'utf8');
const values=plan.match(/private val LADDER = longArrayOf\(([\s\S]+?)\)/);
assert.ok(values,'missing 565 ledger');
const ladder=[...values[1].matchAll(/(\d+)L/g)].map(m=>Number(m[1]));

test('565 begins at 1.09 and covers exactly two recovery steps',()=>{
  assert.deepEqual(ladder,[109,228,475,992,2070,4320,9016,18816,39268,81950]);
  assert.match(plan,/const val STOP_AFTER_LOSSES = 3/);
});
test('never claims entire 10-loss plan fits the planned 1570.44 budget',()=>{
  assert.match(plan,/const val PLANNED_BUDGET_CENTS = 157044L/);
  assert.equal(ladder.reduce((a,b)=>a+b,0),157244);
  assert.equal(ladder.reduce((a,b)=>a+b,0)-157044,200);
  assert.match(plan,/cumLoss\+next>PLANNED_BUDGET_CENTS/);
});
test('all payouts must match 92 percent exactly',()=>{
  assert.match(plan,/payoutPercent!=PAYOUT_EXACT/);
  assert.match(editor,/buyPayout != 92/);
  assert.match(service,/TouchTestService.readVerifiedDemoPayoutForPair\(pair\)!=92/);
});
test('CLOSED and two EMPTY OPEN proof are matched before incrementing',()=>{
  const start=service.indexOf('private fun inspectPassiveDemoProof463(');
  const end=service.indexOf('private fun startBrokerAccountMonitor()',start);
  const block=service.slice(start,end);
  assert.ok(start>=0 && end>start);
  for(const token of ['closed.stakeCents != stake','closed.payoutPercent != payout',
    'brokerOpenTimeMatchesAttempt437','demoRecoveryLedger.onVerifiedDemoClosed(',
    'val nextStakeStatus565 = if (gateReady',
    'matchingOpenClosedAndZeroOpen=true','demoAutoStakePlan565.onVerifiedClosed('])
    assert.ok(block.includes(token),token);
  assert.ok(block.indexOf('val nextStakeStatus565')>block.indexOf('val cleared = prefs.edit()'));
});
test('editor call occurs only on fresh DEMO chart and before any subsequent order',()=>{
  const a=service.indexOf('private fun maybeApplyVerifiedDemoStake565(');
  const b=service.indexOf('private fun brokerOpenTimeMatchesAttempt437(',a);
  const s=service.slice(a,b);
  for(const tok of ['!CHART_ONLY_DEMO_462','realAccountSafetyStop517',
    'closedHistoryInspectionInProgress','historyPageVisible433','fxRotationTradePaused516',
    'tradePositionGate.state()!=TradePositionGate.State.READY','mediaProjection==null',
    'TouchTestService.readVerifiedDemoPayoutForPair(pair)!=92',
    'autoDemoSessionRequested=false','autoDemoSessionConsumed=true',
    'TouchTestService.setVerifiedDemoRecoveryStakeOnBroker(pair,amount)',
    'demoAutoStakePlan565.confirmEdited('])
    assert.ok(s.includes(tok),tok);
  assert.ok(s.indexOf('autoDemoSessionRequested=false') <
    s.indexOf('TouchTestService.setVerifiedDemoRecoveryStakeOnBroker'));
  assert.doesNotMatch(s,/pressVerifiedDemoStakeOnce429|pressAutoOneDollarDemoOrderOnce/);
});
test('new risk STOP is persistent and checked in every automatic preflight',()=>{
  assert.match(plan,/putBoolean\("riskStopped",true\)/);
  assert.match(service,/demoAutoStakePlan565.isRiskStopped\(\)/);
  assert.match(service,/STOP RISC 565/);
  assert.match(service,/!demoAutoStakePlan565.permitsFreshDemoOrder\(/);
});
test('manual two-press BUY pilot also checks the new safety stop and quote',()=>{
  const a=service.indexOf('val tapTestButton552 =');
  const b=service.indexOf('val brokerAutoRow =',a);
  const p=service.slice(a,b);
  assert.ok(p.includes('demoAutoStakePlan565.isRiskStopped()'));
  assert.ok(p.includes('val allowedStake565'));
  assert.ok(p.includes('!allowedStake565'));
});
test('plan has explicit ON/OFF, but NEVER authorizes an order itself',()=>{
  assert.ok(service.includes('MIZĂ AUTO DEMO • OFF'));
  assert.ok(service.includes('demoAutoStakePlan565.enableFromVerifiedDemo('));
  assert.ok(service.includes('demoAutoStakePlan565.disable()'));
  assert.doesNotMatch(plan,/dispatchGesture|performAction|pressVerifiedDemoStakeOnce429|pressAutoOneDollarDemoOrderOnce/);
});
test('same broker account and same pair required at every stage',()=>{
  for(const tok of ['accountKey!=prefs.getString("accountKey",null)',
    'pair!=prefs.getString("pair",null)','seenClosedIds','stakeCents!=LADDER[losses]',
    'netProfitCents != -stakeCents'])
    assert.ok(plan.includes(tok),tok);
});
test('no legacy core order/rotation guard weakened in 565',()=>{
  assert.ok(service.includes('private const val CHART_ONLY_DEMO_462 = true'));
  assert.ok(service.includes('lastCapturedImageAt'));
  assert.ok(service.includes('tradePositionGate.beginAttempt()'));
  assert.ok(service.includes('!previousDemoUnresolved453'));
  assert.ok(service.includes('!fxRotationNavigating'));
});
test('build pipeline packages native module and signs arm64 Android APK',()=>{
  assert.ok(workflow.includes('cp .github/native-overlay/DemoAutoStakePlan565.kt'));
  assert.ok(workflow.includes('node --test .github/scripts/test_565_after_loss.mjs'));
  assert.ok(workflow.includes('versionCode\']=565'));
  assert.ok(workflow.includes('apksigner'));
});
