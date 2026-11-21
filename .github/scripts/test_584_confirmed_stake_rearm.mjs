import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const service=readFileSync('.github/native-overlay/ScalpOverlayService.kt','utf8');
const plan=readFileSync('.github/native-overlay/DemoAutoStakePlan565.kt','utf8');
const flow=readFileSync('.github/workflows/build-native-robot-safe-preflight-379.yml','utf8');
test('584: consumed session rearms from already confirmed broker amount only after strict checks',()=>{
 const f=service.split('private fun maybeApplyVerifiedDemoStake565(')[1].split('private fun brokerHistoryClockSeconds582(')[0];
 assert.match(f,/tradePositionGate\.state\(\)!=TradePositionGate\.State\.READY/);
 assert.match(f,/getBoolean\("attempted",false\)/);
  assert.match(f,/val visiblePair587=try/);
  assert.match(f,/if\(visiblePair587!=pair\)/);
  assert.match(f,/val payout587=try/);
  assert.match(f,/if\(payout587!=92\)/);
 assert.match(f,/val confirmedQuote584=try\s*\{\s*TouchTestService\.readBrokerDemoOrder476\(pair\)/);
 assert.match(f,/demoAutoStakePlan565\.permitsFreshDemoOrder\(key,pair,currentAmount584\)/);
 assert.match(f,/if\(!autoDemoSessionRequested \|\| autoDemoSessionConsumed\)/);
 assert.match(f,/autoDemoSessionRequested=true/);
 assert.match(f,/autoDemoSessionConsumed=false/);
 assert.match(f,/autoDemoLockedAt=lockedAt/);
 assert.match(f,/autoDemoEntryCycleStartedAt=System\.currentTimeMillis\(\)/);
 const branch=f.split('val confirmedQuote584=try')[1].split('var proposal=demoAutoStakePlan565.pending')[0];
 assert.doesNotMatch(branch,/submit|tapVerified|clickBuy|clickSell|sendDemoOrder/i);
});
test('584: verified recovering stake follows pair but never mutates loss count or pending amount',()=>{
 const f=plan.split('fun rebindConfirmedRecoveryPair584(')[1].split('fun preflightReason583(')[0];
 assert.match(f,/losses !in 1 until STOP_AFTER_LOSSES/);
 assert.match(f,/brokerStakeCents!=expected/);
 assert.match(f,/prefs\.getLong\("pendingStake",-1L\)!=0L/);
 assert.match(f,/prefs\.getLong\("confirmedStake",-1L\)!=expected/);
 assert.match(f,/putString\("pair",newPair\)/);
 assert.doesNotMatch(f,/putInt\("losses"|putLong\("pendingStake"|putLong\("confirmedStake"/);
});
test('584: prior trade receipt and 92pct guards still required',()=>{
 assert.match(service,/verifiedClosedDetail437/);
 assert.match(service,/alreadySettledClosedReceipt444/);
 assert.match(service,/brokerHistoryClockSeconds582/);
 assert.match(service,/readBrokerDemoOrder476\(pair\)/);
 assert.match(plan,/fun onVerifiedClosed\(/);
 assert.match(service,/private const val CHART_ONLY_DEMO_462 = true/);
});
test('584: new Motorola build uses correct package and new regression',()=>{
 assert.match(flow,/versionCode'\]=587/);
 assert.match(flow,/ScalpAtlas-587-PREFLIGHT-DIAG-G24\.apk/);
 assert.match(flow,/test_584_confirmed_stake_rearm\.mjs/);
});