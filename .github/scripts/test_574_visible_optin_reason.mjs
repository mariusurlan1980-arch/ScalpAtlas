import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
const s=readFileSync(new URL('../native-overlay/ScalpOverlayService.kt',import.meta.url),'utf8');
const w=readFileSync(new URL('../workflows/build-native-robot-safe-preflight-379.yml',import.meta.url),'utf8');
const start=s.indexOf('private fun maybeFinishStakeOptIn571(');
const end=s.indexOf('private fun maybeApplyVerifiedDemoStake565(',start);
const gate=s.slice(start,end);
const updateStart=s.indexOf('private fun updateOverlay(');
const updater=s.slice(updateStart,s.indexOf('override fun onDestroy()', updateStart));
test('574 preserves real account/risk/position/payout gates without allowing unverified ON',()=>{
 for(const term of [
  'realAccountSafetyStop517', 'TouchTestService.realFxAccountVisible()',
  'demoAutoStakePlan565.isRiskStopped()', 'fxRotationNavigating',
  '!TouchTestService.demoFxAccountInForeground()',
  'tradePositionGate.state() != TradePositionGate.State.READY',
  'priorShock572 || priorSell572','pairReady(nowPair572)',
  'TouchTestService.readVerifiedDemoPayoutForPair(pair) != 92',
  'demoAutoStakePlan565.enableFromVerifiedDemo("QT_DEMO:" + pkg, pair)',
 ]) assert.ok(gate.includes(term),term);
 assert.ok(!gate.includes('pressVerifiedDemoStakeOnce429('));
});
test('574 exact failure reason survives return to OFF for 30 seconds',()=>{
 assert.ok(s.includes('private var stakeOptInLastFailureAt574 = 0L'));
 assert.ok(gate.includes('stakeOptInLastFailureAt574 = nowElapsed'));
 assert.ok(s.includes('stakeOptInLastFailureAt574 = android.os.SystemClock.elapsedRealtime()'));
 assert.ok(updater.includes('stakeOptInLastFailureAt574 in 0L..30_000L'));
 assert.ok(updater.includes('status574 + "\\n" + stakeOptInReason572.take(95)'));
 assert.ok(updater.includes('pendingStakeOptIn571 || optInFailureRecent574'));
});
test('574 pending reason takes priority over stale preflight text and remains compact',()=>{
 const p=updater.indexOf('pendingStakeOptIn571 -> "🤖 MIZĂ VERIFIC • "');
 const generic=updater.indexOf('!demoAccountIdentified -> "🤖 CONT NECONFIRMAT');
 assert.ok(p>0 && generic>p);
 const prev=updater.indexOf('touchProbeStatus?.text = state546 +');
 const last=updater.indexOf('touchProbeStatus?.text = status574 +');
 assert.ok(prev>0 && last>prev);
 assert.ok(updater.includes('!realAccountSafetyStop517'));
 assert.ok(updater.includes('!demoAutoStakePlan565.isRiskStopped()'));
 const compact=s.slice(s.indexOf('fun applyCompactMode()'),s.indexOf('minimizeToggle.setOnClickListener {'));
 assert.ok(compact.includes('tapTestRow552.visibility = View.GONE'));
 assert.ok(compact.includes('windowManager.updateViewLayout(root, window)'));
});
test('574 signed Android workflow with dedicated regression test',()=>{
 assert.ok(w.includes("expo['android']['versionCode']=589"));
 assert.ok(w.includes('ScalpAtlas-589-MANUAL-POS-G24.apk'));
 assert.ok(w.includes('node --test .github/scripts/test_574_visible_optin_reason.mjs'));
 assert.ok(w.includes('apksigner'));
});
