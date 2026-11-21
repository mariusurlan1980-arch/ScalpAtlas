import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
const src=readFileSync(new URL('../native-overlay/ScalpOverlayService.kt', import.meta.url),'utf8');
const workflow=readFileSync(new URL('../workflows/build-native-robot-safe-preflight-379.yml',import.meta.url),'utf8');
const start=src.indexOf('private fun maybeFinishStakeOptIn571(');
const end=src.indexOf('private fun maybeApplyVerifiedDemoStake565(',start);
const guard=src.slice(start,end);
const toggleStart=src.indexOf('val stakeButton565 = localButton(');
const toggleEnd=src.indexOf('stakeAutoRow565.addView',toggleStart);
const toggle=src.slice(toggleStart,toggleEnd);
test('only the explicit user ON button creates a one-time pending request',()=>{
  assert.ok(toggle.includes('pendingStakeOptIn571 = true'));
  assert.ok(toggle.includes('pendingStakeOptInAt571 = android.os.SystemClock.elapsedRealtime()'));
  assert.ok(toggle.includes('pendingStakeOptIn571 = false'));
  assert.ok(toggle.includes('MIZĂ AUTO DEMO • VERIFIC'));
  assert.ok(toggle.includes('!TouchTestService.demoFxAccountInForeground()'));
});
test('queued opt-in expires and rejects REAL or persistent risk stop',()=>{
  assert.ok(guard.includes('nowElapsed - pendingStakeOptInAt571 !in 0L..90_000L'));
  assert.ok(guard.includes('TouchTestService.realFxAccountVisible()'));
  assert.ok(guard.includes('demoAutoStakePlan565.isRiskStopped()'));
  assert.ok(guard.includes('cancel("571 • STOP RISC / QT REAL • FĂRĂ ORDIN")'));
});
test('selector and trade/history blockers remain intact until verified chart',()=>{
  for(const phrase of [
    'fxRotationNavigating', 'fxRotationTradePaused516',
    'closedHistoryInspectionInProgress','historyPageVisible433',
    'tradePositionGate.state() != TradePositionGate.State.READY',
    'TouchTestService.ready()', 'TouchTestService.demoFxAccountInForeground()',
    'lastBrokerAccountStatus.contains("QT DEMO IDENTIFICAT")',
    'getBoolean("attempted", false)','pairReady(nowPair572)',
    'TouchTestService.readVerifiedDemoPayoutForPair(pair) != 92',
    'demoAutoStakePlan565.enableFromVerifiedDemo("QT_DEMO:" + pkg, pair)'
  ]) assert.ok(guard.includes(phrase),phrase);
});
test('only verified opt-in retires the old session and attempts amount edit, never BUY/SELL',()=>{
  const index=guard.indexOf('if (!demoAutoStakePlan565.enableFromVerifiedDemo(');
  const after=guard.slice(index);
  assert.ok(after.includes('autoDemoSessionRequested = false'));
  assert.ok(after.includes('autoDemoSessionConsumed = true'));
  assert.ok(after.includes('autoDemoArmed = false'));
  assert.ok(after.includes('maybeApplyVerifiedDemoStake565(nowElapsed)'));
  assert.ok(!guard.includes('pressVerifiedDemoStakeOnce429'));
  assert.ok(!guard.includes('pressVerifiedDemoSell'));
  assert.ok(src.includes('demoAutoStakePlan565.permitsFreshDemoOrder('));
});
test('monitor processes queued request after independent account check, before amount edit',()=>{
  const position=src.indexOf('val diagnostic = try {',src.indexOf('private fun startBrokerAccountMonitor()'));
  const tail=src.slice(position,position+5300);
  const identity=tail.indexOf('lastBrokerAccountStatus = diagnostic');
  const finish=tail.indexOf('maybeFinishStakeOptIn571(proofNow463)');
  const edit=tail.indexOf('maybeApplyVerifiedDemoStake565(proofNow463)');
  assert.ok(identity>0 && finish>identity && edit>finish);
});
test('workflow builds version 571 and includes the new safety test',()=>{
  assert.ok(workflow.includes("expo['android']['versionCode']=587"));
  assert.ok(workflow.includes('node --test .github/scripts/test_571_queued_stake_optin.mjs'));
  assert.ok(workflow.includes('ScalpAtlas-587-PREFLIGHT-DIAG-G24.apk'));
  assert.ok(workflow.includes('apksigner'));
});
