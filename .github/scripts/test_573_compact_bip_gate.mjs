import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../native-overlay/ScalpOverlayService.kt',import.meta.url),'utf8');
const flow=readFileSync(new URL('../workflows/build-native-robot-safe-preflight-379.yml',import.meta.url),'utf8');
const modeStart=source.indexOf('fun applyCompactMode()');
const modeEnd=source.indexOf('minimizeToggle.setOnClickListener {', modeStart);
const mode=source.slice(modeStart,modeEnd);
const lock=source.indexOf('val tradeAudioReady573 =');
const signalEnd=source.indexOf('updateOverlay(',lock);
const signal=source.slice(lock,signalEnd);
test('573 compact hides large BUY test and keeps normal plus to expand',()=>{
 assert.ok(source.includes('var minimized = true'));
 assert.ok(mode.includes('tapTestRow552.visibility = View.GONE'));
 assert.ok(mode.includes('stakeAutoRow565.visibility = View.VISIBLE'));
 assert.ok(mode.includes('probeStatus.maxLines = if (minimized) 2 else 3'));
 assert.ok(mode.includes('window.width = dp(if (minimized) 156 else 174)'));
 assert.ok(mode.includes('windowManager.updateViewLayout(root, window)'));
 assert.ok(mode.includes('root.post { positionSavedCorner498() }'));
 assert.ok(source.includes('minimizeToggle.text = if (minimized) "+" else "−"'));
 assert.ok(source.includes('header.addView(minimizeToggle, 1, LinearLayout.LayoutParams(dp(28), dp(28)))'));
});
test('573 BIP is allowed only for ready same Demo session and not for OFF/VERIFIC',()=>{
 for(const phrase of [
  'autoDemoSessionRequested','!autoDemoSessionConsumed','autoDemoArmed',
  'demoAutoStakePlan565.isEnabled()', '!demoAutoStakePlan565.isRiskStopped()',
  '!pendingStakeOptIn571','!realAccountSafetyStop517',
  '!accountRecheckPending','!fxRotationNavigating',
  '!fxRotationTradePaused516','lastBrokerAccountStatus.contains("QT DEMO IDENTIFICAT")',
  'tradePositionGate.state() == TradePositionGate.State.READY'
 ]) assert.ok(signal.includes(phrase),phrase);
 assert.ok(signal.includes('if (tradeAudioReady573) {'));
 assert.ok(signal.includes('liveTest.onBeep('));
 assert.ok(signal.includes('playBip(confirmedSignal)'));
 assert.ok(signal.includes('FĂRĂ BIP/ORDIN'));
 const start=source.indexOf('val tradeAudioReady573 =');
 const end=source.indexOf('lastConfirmedSide556 = confirmedSignal', start);
 assert.ok(start>=0 && end>start);
 assert.ok(!source.slice(end,source.indexOf('updateOverlay(',end)).includes('playBip('));
});
test('573 chart signal remains available visually, with unchanged trading gate',()=>{
 const part=source.slice(source.indexOf('lockedUntil = now + lockMinutes'),source.indexOf('private fun formatSeconds('));
 assert.ok(part.includes('lockedDir = confirmedSignal'));
 assert.ok(part.includes('updateOverlay('));
 assert.ok(part.includes('journal.record('));
 assert.ok(source.includes('demoAutoStakePlan565.permitsFreshDemoOrder('));
 assert.ok(source.includes('TouchTestService.readVerifiedDemoPayoutForPair(pair) != 92'));
 assert.ok(source.includes('BLOCAT: MIZĂ AUTO OFF • APASĂ +'));
});
test('573 signed APK pipeline includes new tests',()=>{
 assert.ok(flow.includes("expo['android']['versionCode']=604"));
 assert.ok(flow.includes('node --test .github/scripts/test_573_compact_bip_gate.mjs'));
 assert.ok(flow.includes('ScalpAtlas-604-OVERLAY-QT-DEMO-G24.apk'));
 assert.ok(flow.includes('apksigner'));
});
