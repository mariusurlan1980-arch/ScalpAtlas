import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
const source=readFileSync(new URL('../native-overlay/ScalpOverlayService.kt',import.meta.url),'utf8');
const workflow=readFileSync(new URL('../workflows/build-native-robot-safe-preflight-379.yml',import.meta.url),'utf8');
const mode=source.slice(source.indexOf('fun applyCompactMode()'),source.indexOf('minimizeToggle.setOnClickListener {'));
test('575 MINI default, no giant candle/chart trend or broker-overlapping BUY test',()=>{
 assert.ok(source.includes('var minimized = true'));
 for(const x of ['body.visibility = View.GONE','trendRow.visibility = View.GONE','note.visibility = View.GONE','tapTestRow552.visibility = View.GONE','martingaleStatusText?.visibility = View.GONE'])assert.ok(mode.includes(x),x);
 assert.ok(mode.includes('root.setPadding(dp(5), dp(3), dp(5), dp(4))'));
 assert.ok(mode.includes('rotationParams499.height = dp(23)'));
 assert.ok(mode.includes('window.width = dp(if (minimized) 156 else 174)'));
 assert.ok(mode.includes('windowManager.updateViewLayout(root, window)'));
});
test('575 essential MIZA AUTO button is actionable even in MINI mode, not forced ON',()=>{
 assert.ok(mode.includes('stakeAutoRow565.visibility = View.VISIBLE'));
 assert.ok(source.includes('stakeAutoRow565.addView(stakeButton565, LinearLayout.LayoutParams(-1, dp(28)))'));
 assert.ok(source.includes('val stakeButton565 = localButton('));
 assert.ok(source.includes('setOnClickListener {'));
 assert.ok(source.includes('pendingStakeOptIn571 = true'));
 assert.ok(source.includes('maybeFinishStakeOptIn571(requestAt572)'));
 assert.ok(source.includes('demoAutoStakePlan565.enableFromVerifiedDemo('));
 assert.ok(source.includes('if (TouchTestService.readVerifiedDemoPayoutForPair(pair) != 92)'));
 assert.ok(source.includes('demoAutoStakePlan565.isRiskStopped()'));
 assert.ok(source.includes('TouchTestService.demoFxAccountInForeground()'));
});
test('575 compact diagnostics remain visible and separate from broker order permissions',()=>{
 assert.ok(mode.includes('probeStatus.visibility = View.VISIBLE'));
 assert.ok(mode.includes('probeStatus.maxLines = if (minimized) 2 else 3'));
 assert.ok(mode.includes('compactStatus.visibility = View.VISIBLE'));
 assert.ok(mode.includes('minimizeToggle.text = if (minimized) "+" else "−"'));
 assert.ok(source.includes('stakeOptInReason572.take(95)'));
 assert.ok(source.includes('demoAutoStakePlan565.permitsFreshDemoOrder('));
 assert.ok(source.includes('tradePositionGate.state() == TradePositionGate.State.READY'));
 const plan=readFileSync(new URL('../native-overlay/DemoAutoStakePlan565.kt',import.meta.url),'utf8');
 assert.ok(plan.includes('STOP_AFTER_LOSSES = 10'));
});
test('575 APK uses signed publishing pipeline',()=>{
 assert.ok(workflow.includes("expo['android']['versionCode']=584"));
 assert.ok(workflow.includes('ScalpAtlas-584-CONFIRMED-STAKE-G24.apk'));
 assert.ok(workflow.includes('node --test .github/scripts/test_575_mini_overlay.mjs'));
 assert.ok(workflow.includes('apksigner'));
});
