import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../native-overlay/ScalpOverlayService.kt',import.meta.url),'utf8');
const flow=readFileSync(new URL('../workflows/build-native-robot-safe-preflight-379.yml',import.meta.url),'utf8');
const monitor=src.split('private fun startBrokerAccountMonitor()')[1].split('private fun startDemoClickMonitor()')[0];
test('603 short chart-return watchdog independent of previous order status',()=>{
 for(const x of ['historyPageFirstSeenAt603 = android.os.SystemClock.elapsedRealtime()',
 'historyPageFirstSeenAt603 = 0L','val historyReturnDue603 = historyFresh592 &&',
 'recoveryNow595 - historyPageFirstSeenAt603 >= 3_000L',
 '(reviewCompleted600 || historyReturnDue603) && historyFresh592',
 'returnToChartAfterReview458(true, true)'])
   assert.ok(src.includes(x),x);
 assert.match(monitor,/TouchTestService\.tapExactDemoMoreAccessibility596\(/);
 assert.match(monitor,/TouchTestService\.tapVerifiedDemoQuickTradingEntry595\(/);
});
test('603 display MG block truthfully without changing trade settlement',()=>{
 for(const label of ['MG • STOP RISC','MG • OFF','MG • BLOCAT · ISTORIC',
   'MG • CONFIGURAT · VERIFIC','MG • SEMNAL · AȘTEPT'])
   assert.ok(src.includes(label),label);
 assert.match(monitor,/if \(!pendingStakeOptIn571\)/);
 assert.match(src,/private const val CHART_ONLY_DEMO_462 = true/);
 assert.match(src,/demoAutoStakePlan565\.onVerifiedClosed\(/);
 assert.match(src,/tradePositionGate\.brokerVerifiedEmptyDemoReview\(true\)/);
});
test('603 signed APK identity',()=>{
 assert.match(flow,/versionCode'\]=604/);
 assert.match(flow,/ScalpAtlas-604-OVERLAY-QT-DEMO-G24\.apk/);
 assert.match(flow,/test_603_simple_chart_mg\.mjs/);
});
