import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const service=readFileSync(new URL('../native-overlay/ScalpOverlayService.kt', import.meta.url),'utf8');
const touch=readFileSync(new URL('../native-overlay/TouchTestService.kt', import.meta.url),'utf8');
const flow=readFileSync(new URL('../workflows/build-native-robot-safe-preflight-379.yml', import.meta.url),'utf8');

test('591 no broker Perspective click as a chart-return target',()=>{
 assert.doesNotMatch(service,/TouchTestService\.tapVerifiedDemoPerspectiveFooter457\(/);
 const back=service.split('private fun returnToChartAfterReview458(')[1].split('private fun navigateVerifiedDemoHistory431(')[0];
 assert.match(back,/tapVerifiedDemoMoreFooter595\(/);
 assert.match(back,/historyPageVisible433/);
 assert.match(back,/!cachedDemoVerifiedOnChart/);
 assert.match(back,/!ocrVerifiedHistoryPage/);
});

test('591 exactly identifies copy feed, QT Demo and bottom-right Trading footer',()=>{
 const fn=touch.split('fun returnFromDemoPerspectivesToTrading591(')[1].split('fun tapVerifiedDemoPerspectiveFooter457(')[0];
 for (const name of ['activeDemoHistoryNodes(cachedDemoVerifiedOnChart)',
 'BrokerAdapterRegistry.hasDemoExecutor(pkg)',
 'activeDemoHistoryNodes(false, realAccount = true)',
 'val isPerspectives', 'if (!isPerspectives) return null',
 'val tradingName591', 'rect.centerX() in (w * .58f)',
 'rect.centerY() in (h * .86f)',
 'node.performAction(AccessibilityNodeInfo.ACTION_CLICK)',
 'overlayBounds.contains(chosen.second.centerX(), chosen.second.centerY())',
 'clickExactDemoNavigationLabel'])assert.ok(fn.includes(name),name);
 assert.doesNotMatch(fn,/pressVerifiedDemoStakeOnce429|pressAutoOneDollarDemoOrderOnce|onVerifiedClosed|putBoolean\("attempted", false\)/);
});

test('591 safe remediation only for persisted order, no forced rearm',()=>{
 const monitor=service.split('private fun startBrokerAccountMonitor()')[1].split('private fun startDemoClickMonitor()')[0];
 assert.match(monitor,/val socialFresh595=/);
 assert.match(monitor,/\.getBoolean\("attempted", false\)/);
 assert.match(monitor,/!realAccountSafetyStop517/);
 assert.match(monitor,/tapVerifiedDemoMoreFooter595\(/);
 assert.match(monitor,/recoveryNow595-moreNavAttemptAt595 !in 0L\.\.10_000L/);
 assert.match(service,/VERIFIC ORDIN ANTERIOR • FĂRĂ ORDIN NOU/);
 assert.doesNotMatch(service,/"ARMAT · TRADE ACTIV"/);
 assert.match(service,/private const val CHART_ONLY_DEMO_462 = true/);
 assert.match(service,/tradePositionGate\.beginAttempt\(/);
});

test('591 Android release retains prior 590 tests and signs a distinct G24 build',()=>{
 assert.match(flow,/test_590_pending_order_history_priority\.mjs/);
 assert.match(flow,/test_591_perspectives_safe_return\.mjs/);
 assert.match(flow,/versionCode'\]=607/);
 assert.match(flow,/ScalpAtlas-607-OVERLAY-QT-DEMO-G24\.apk/);
 assert.match(flow,/apksigner/);
});
