import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const service=readFileSync(new URL('../native-overlay/ScalpOverlayService.kt',import.meta.url),'utf8');
const plan=readFileSync(new URL('../native-overlay/DemoAutoStakePlan565.kt',import.meta.url),'utf8');
const flow=readFileSync(new URL('../workflows/build-native-robot-safe-preflight-379.yml',import.meta.url),'utf8');

test('590 unresolved persisted DEMO order preempts 5-minute rotation timeout',()=>{
 const fn=service.split('fun pauseForTrade516(): Boolean {')[1].split('fun stopOnReal517(',1)[0];
 const old=fn.indexOf('val attemptedAt = prefs.getLong("attemptedAt429", 0L)');
 const pending=fn.indexOf('if (prefs.getBoolean("attempted", false))');
 assert.ok(pending>=0 && old>pending);
 for(const a of ['fxRotationTradePaused516 = true','fxRotationNavigating = false',
  'pendingHistoryRetryScheduled590', 'after(3_000L)', 'pauseForTrade516()',
  'fxRotationTradePaused516 = false','seekChart()'])assert.ok(fn.includes(a),a);
 assert.doesNotMatch(fn,/\.putBoolean\("attempted", false\)/);
 assert.doesNotMatch(fn,/pressVerifiedDemoStakeOnce429\(/);
});
test('590 all asynchronous FX navigation paths defer to history review',()=>{
 for(const name of ['beginNavigation','verifyChart','recoverNavigation',
   'awaitList','confirmSelection','searchUnvisited506']) {
    const found=service.indexOf('fun '+name+'(');
    assert.ok(found>=0,name);
    const opening=service.slice(found,found+330);
    assert.ok(opening.includes('pauseForTrade516()'),name);
 }
});
test('590 does not infer settled order from elapsed time or override proof',()=>{
 const start=service.indexOf('private fun inspectPassiveDemoProof463(');
 const end=service.indexOf('private fun maybeRearmExpiredDemoPilot464(');
 const proof=service.slice(start,end);
 for(const a of ['verifiedClosedDetail437','closed.positionId','closed.pair != expectedPair',
   'closed.stakeCents != stake','closed.payoutPercent != payout',
   'brokerOpenTimeMatchesAttempt437','demoEmptyReviewReads','martingaleResultDurable581',
   '.putBoolean("attempted", false)'])assert.ok(proof.includes(a),a);
 assert.ok(proof.indexOf('onVerifiedClosed(')<proof.indexOf('.putBoolean("attempted", false)'));
 assert.ok(service.includes('private const val CHART_ONLY_DEMO_462 = true'));
 assert.ok(plan.includes('PAYOUT_EXACT = 92'));
});
test('590 build includes this regression and new signed Motorola APK',()=>{
 assert.ok(flow.includes('test_590_pending_order_history_priority.mjs'));
 assert.ok(flow.includes("expo['android']['versionCode']=594"));
 assert.ok(flow.includes('ScalpAtlas-594-SAFE-RETURN-G24.apk'));
});
