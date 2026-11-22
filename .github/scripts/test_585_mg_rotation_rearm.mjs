import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const service=readFileSync('.github/native-overlay/ScalpOverlayService.kt','utf8');
const plan=readFileSync('.github/native-overlay/DemoAutoStakePlan565.kt','utf8');
const flow=readFileSync('.github/workflows/build-native-robot-safe-preflight-379.yml','utf8');

test('585: verified base and already-confirmed MG stake may follow newly verified DEMO chart',()=>{
  const chart=service.split('fun verifyChart(pair: String, checks: Int) {')[1].split('fun dwell(pair: String,')[0];
  assert.match(chart,/chartPair548 != pair/);
  assert.match(chart,/readFxChartPayout\(pair, realAccount\)/);
  assert.match(chart,/TouchTestService\.demoFxAccountInForeground\(\)/);
  assert.match(chart,/TouchTestService\.realFxAccountVisible\(\)/);
  assert.match(chart,/tradePositionGate\.state\(\) == TradePositionGate\.State\.READY/);
  assert.match(chart,/val verifiedQuote585=try\s*\{\s*TouchTestService\.readBrokerDemoOrder476\(pair\)/);
  assert.match(chart,/readVerifiedDemoPayoutForPair\(pair\)==92/);
  assert.match(chart,/rebindVerifiedBasePair\(account585,pair\)/);
  assert.match(chart,/verifiedExactDemoStakeReadOnly577\(/);
  assert.match(chart,/rebindConfirmedRecoveryPair584\(/);
  assert.doesNotMatch(chart,/onVerifiedClosed\(|confirmEdited\(|sendDemoOrder|submitBrokerOrder/i);
});

test('585: rearm retry requires same settled chart; does not bypass stake or order guards',()=>{
  const chart=service.split('fun verifyChart(pair: String, checks: Int) {')[1].split('fun dwell(pair: String,')[0];
  assert.match(chart,/after\(7_000L\)/);
  assert.match(chart,/!fxRotationNavigating && currentDwellPair549==pair/);
  assert.match(chart,/maybeApplyVerifiedDemoStake565\(/);
  const main=service.split('private fun maybeApplyVerifiedDemoStake565(')[1].split('private fun brokerHistoryClockSeconds582(')[0];
  assert.match(main,/tradePositionGate\.state\(\)!=TradePositionGate\.State\.READY/);
  assert.match(main,/getBoolean\("attempted",false\)/);
  assert.match(main,/demoAutoStakePlan565\.permitsFreshDemoOrder\(key,pair,currentAmount584\)/);
  assert.match(main,/val visiblePair587=try/);
  assert.match(main,/if\(visiblePair587!=pair\)/);
  assert.match(main,/val payout587=try/);
  assert.match(main,/if\(payout587!=92\)/);
  assert.match(plan,/prefs\.getLong\("pendingStake",-1L\)!=0L/);
  assert.match(plan,/prefs\.getLong\("confirmedStake",-1L\)!=expected/);
});

test('585: rotation status does not erase unresolved-order protections',()=>{
  assert.match(service,/MIZĂ ON • ROTAȚIE • AȘTEPT CONFIRMAREA PERECHII/);
  assert.match(service,/previousShock578 \|\| previousSell578/);
  assert.match(service,/gate578==TradePositionGate\.State\.OPEN/);
  assert.match(service,/tradePositionGate\.state\(\) == TradePositionGate\.State\.READY/);
  assert.match(service,/private const val CHART_ONLY_DEMO_462 = true/);
});

test('585: Android pipeline uses correct version and regression test',()=>{
  assert.match(flow,/expo\['android'\]\['versionCode'\]=598/);
  assert.match(flow,/ScalpAtlas-598-OVERLAY-QT-DEMO-G24\.apk/);
  assert.match(flow,/test_585_mg_rotation_rearm\.mjs/);
});
