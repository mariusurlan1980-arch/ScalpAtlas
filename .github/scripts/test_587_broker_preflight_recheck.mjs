import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const service=readFileSync('.github/native-overlay/ScalpOverlayService.kt','utf8');
const plan=readFileSync('.github/native-overlay/DemoAutoStakePlan565.kt','utf8');
const workflow=readFileSync('.github/workflows/build-native-robot-safe-preflight-379.yml','utf8');
const prepare=service.split('private fun maybeApplyVerifiedDemoStake565(')[1].split('private fun brokerHistoryClockSeconds582(')[0];

test('587: automatic post-move retry is scoped to the same chart and re-enters all safety checks',()=>{
 const block=prepare.split('if(liftOverlayOffDemoOrderButtons557()) {')[1].split('val visiblePair587=try')[0];
 assert.match(block,/mainHandler\.postDelayed\(\{/);
 assert.match(block,/\}, 1_500L\)/);
 assert.doesNotMatch(block,/\bafter\(1_500L\)/);
 assert.match(block,/!shuttingDown && !fxRotationNavigating && mediaProjection!=null/);
 assert.match(block,/currentPair\(System\.currentTimeMillis\(\)\)==pair/);
 assert.match(block,/maybeApplyVerifiedDemoStake565\(/);
 assert.doesNotMatch(block,/beginAttempt\(|pressVerifiedDemoStakeOnce429\(|onVerifiedClosed\(|confirmEdited\(/);
});
test('587: exact pair, 92 payout and broker amount remain independent read-only gates',()=>{
 assert.match(prepare,/tradePositionGate\.state\(\)!=TradePositionGate\.State\.READY/);
 assert.match(prepare,/getBoolean\("attempted",false\)/);
 assert.match(prepare,/val visiblePair587=try/);
 assert.match(prepare,/if\(visiblePair587!=pair\)/);
 assert.match(prepare,/val payout587=try/);
 assert.match(prepare,/if\(payout587!=92\)/);
 assert.match(prepare,/val confirmedQuote584=try/);
 assert.match(prepare,/TouchTestService\.inspectBrokerDemoOrder488\(/);
 assert.match(prepare,/demoAutoStakePlan565\.preflightReason583\(/);
});
test('587: rearm and Martingale cannot bypass confirmed stake or unresolved order',()=>{
 assert.match(prepare,/demoAutoStakePlan565\.permitsFreshDemoOrder\(key,pair,currentAmount584\)/);
 assert.match(prepare,/tradePositionGate\.state\(\)==TradePositionGate\.State\.READY/);
 assert.match(prepare,/demoAutoStakePlan565\.confirmEdited\(key,pair,amount,true\)/);
 assert.match(plan,/if\(!isEnabled\(\) \|\| isRiskStopped\(\)/);
 assert.match(plan,/prefs\.getLong\("pendingStake",-1L\)!=0L/);
 assert.match(plan,/prefs\.getLong\("confirmedStake",-1L\)!=expected/);
});
test('587: Android build and regression file',()=>{
 assert.match(workflow,/versionCode'\]=594/);
 assert.match(workflow,/ScalpAtlas-594-SAFE-RETURN-G24\.apk/);
 assert.match(workflow,/test_587_broker_preflight_recheck\.mjs/);
});
