import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const service=readFileSync(new URL('../native-overlay/ScalpOverlayService.kt',import.meta.url),'utf8');
const plan=readFileSync(new URL('../native-overlay/DemoAutoStakePlan565.kt',import.meta.url),'utf8');
const flow=readFileSync(new URL('../workflows/build-native-robot-safe-preflight-379.yml',import.meta.url),'utf8');

test('601 old pending order blocks submissions, not an expired M5 chart rotation',()=>{
 const fn=service.split('fun pauseForTrade516(): Boolean {')[1].split('fun stopOnReal517(',1)[0];
 for (const item of [
   'val persistedAttempt601 = prefs.getBoolean("attempted", false)',
   'val attemptedAt = prefs.getLong("attemptedAt429", -1L)',
   'val attemptedWall601 = prefs.getLong("attemptedWallAt454", -1L)',
   'val pendingFiveMinuteOrder = persistedAttempt601 &&',
   'elapsedAge601 in 0L..(DEMO_TEST_EXPIRY_MS_465 + 15_000L)',
   'wallAge601 in 0L..(DEMO_TEST_EXPIRY_MS_465 + 15_000L)',
   'val orderMayBeActive = pendingFiveMinuteOrder || visuallyActive || verifiedOpen',
   'if (nonChartSafety595)',
   'return false'
 ]) assert.ok(fn.includes(item),item);
 assert.doesNotMatch(fn,/if \(prefs.getBoolean\("attempted", false\)\)\s*\{/);
 assert.doesNotMatch(fn,/\.putBoolean\("attempted", false\)|pressVerifiedDemoStakeOnce429\(/);
});

test('601 every FX navigation checks chart safety instead of prior-order marker',()=>{
 for (const name of ['beginNavigation','verifyChart','recoverNavigation',
   'awaitList','confirmSelection','searchUnvisited506']){
   const at=service.indexOf('fun '+name+'(');
   assert.ok(at>=0,name);
   assert.ok(service.slice(at,at+350).includes('pauseForTrade516()'),name);
 }
});
test('601 settlement and Martingale locks retain strict broker proof',()=>{
 const proof=service.split('private fun inspectPassiveDemoProof463(')[1]
   .split('private fun maybeRearmExpiredDemoPilot464(')[0];
 for(const item of ['verifiedClosedDetail437','closed.positionId',
   'closed.stakeCents != stake','closed.payoutPercent != payout',
   'brokerOpenTimeMatchesAttempt437','demoEmptyReviewReads',
   'martingaleResultDurable581','.putBoolean("attempted", false)'])
   assert.ok(proof.includes(item),item);
 assert.ok(proof.indexOf('onVerifiedClosed(')<proof.indexOf('.putBoolean("attempted", false)'));
 assert.match(service,/private const val CHART_ONLY_DEMO_462 = true/);
 assert.match(plan,/PAYOUT_EXACT = 92/);
});
test('601 signed Android build retains 3-second history regression',()=>{
 assert.match(flow,/versionCode'\]=612/);
 assert.match(flow,/ScalpAtlas-612-OVERLAY-QT-DEMO-G24\.apk/);
 assert.match(flow,/test_600_chart_first_3s\.mjs/);
 assert.match(flow,/test_601_rotation_independent_order\.mjs/);
});
