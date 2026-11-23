import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const service=readFileSync(new URL('../native-overlay/ScalpOverlayService.kt',import.meta.url),'utf8');
const flow=readFileSync(new URL('../workflows/build-native-robot-safe-preflight-379.yml',import.meta.url),'utf8');
const queued=service.split('private fun maybeFinishStakeOptIn571(')[1].split('private fun maybeApplyVerifiedDemoStake565(')[0];
const start=service.split('val stakeButton565 = localButton(')[1].split('stakeAutoRow565.addView(',1)[0];
test('608 one explicit MG ON is remembered for one hour, not reset at 90 sec',()=>{
 assert.match(service,/private val stakeOptInWindow608 = 60L \* 60_000L/);
 assert.match(queued,/nowElapsed - pendingStakeOptInAt571 !in 0L\.\.stakeOptInWindow608/);
 assert.match(start,/\}, stakeOptInWindow608 \+ 500L\)/);
 assert.doesNotMatch(queued,/nowElapsed - pendingStakeOptInAt571 !in 0L\.\.90_000L/);
 assert.match(queued,/nowElapsed - historyReviewRequestedAt610 in 0L\.\.90_000L/);
 assert.doesNotMatch(start,/90_500L/);
 assert.match(start,/pendingStakeOptIn571 = true/);
 assert.match(start,/if \(pendingStakeOptIn571\) \{/);
});
test('608 old order remains strictly blocked while MG intent is pending',()=>{
 for(const x of [
  'getSharedPreferences(autoShockAttemptPrefs, Context.MODE_PRIVATE)',
  'getSharedPreferences(sell404TestPrefs, Context.MODE_PRIVATE)',
  'tradePositionGate.state() != TradePositionGate.State.READY',
  'priorShock572 || priorSell572 -> "ORDIN ANTERIOR NECONFIRMAT"',
  'MG • AȘTEPT ÎNCHIDERE',
  '!TouchTestService.ready()',
  '!TouchTestService.demoFxAccountInForeground()',
  'TouchTestService.readVerifiedDemoPayoutForPair(pair) != 92',
  'demoAutoStakePlan565.enableFromVerifiedDemo("QT_DEMO:" + pkg, pair)',
  'realAccountSafetyStop517 || TouchTestService.realFxAccountVisible()',
  'demoAutoStakePlan565.isRiskStopped()'
 ])assert.ok(queued.includes(x),x);
 assert.doesNotMatch(queued,/pressVerifiedDemoStakeOnce429\(|dispatchGesture\(/);
 assert.match(service,/private const val CHART_ONLY_DEMO_462 = true/);
});
test('608 retain original strict dealer settlement and stake readback',()=>{
 assert.match(service,/tradePositionGate\.brokerVerifiedEmptyDemoReview\(true\)/);
 assert.match(service,/demoAutoStakePlan565\.onVerifiedClosed\(/);
 assert.match(service,/demoAutoStakePlan565\.permitsFreshDemoOrder\(/);
 assert.match(service,/brokerOpenTimeMatchesAttempt437\(/);
});
test('608 signed Motorola release identity',()=>{
 assert.match(flow,/versionCode'\]=612/);
 assert.match(flow,/ScalpAtlas-612-OVERLAY-QT-DEMO-G24\.apk/);
 assert.match(flow,/test_608_deferred_mg_optin\.mjs/);
});
