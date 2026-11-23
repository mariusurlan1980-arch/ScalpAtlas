import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const service=readFileSync(new URL('../native-overlay/ScalpOverlayService.kt',import.meta.url),'utf8');
const touch=readFileSync(new URL('../native-overlay/TouchTestService.kt',import.meta.url),'utf8');
const workflow=readFileSync(new URL('../workflows/build-native-robot-safe-preflight-379.yml',import.meta.url),'utf8');
const monitor=service.split('private fun startBrokerAccountMonitor()')[1]
  .split('private fun startDemoClickMonitor()')[0];
const ocr=service.split('private fun recordExplicitEmptyOpenOcr(')[1]
  .split('private fun scheduleTimeframeOcr(')[0];

test('596 only on OCR-confirmed selected Demo history tab, use exact More accessibility',()=>{
  for (const x of ['val historySelected596 = historyPageVisible433',
    'historyPageTab433 == "DESCHIS"', 'openTabVisualConsecutive429 >= 2',
    'historyPageTab433 == "ÎNCHIS"', 'closedTabVisualConsecutive >= 2',
    'lastOpenTabVisualAt429', 'lastClosedTabVisualAt',
    'navPkg595 != null && historySelected596',
    'moreFooterSamples595 < 2', 'tapExactDemoMoreAccessibility596(',
    'historyOcrTwoFramesVerified=true', 'lastMoreAccessFallback596',
    '15_000L'])
    assert.ok(monitor.includes(x),x);
});

test('596 exact accessible More footer is NOT the third Social tab or arbitrary point',()=>{
  const fn=touch.split('fun tapExactDemoMoreAccessibility596(')[1]
    .split('fun inspectExplicitEmptyOpenDemoTabReadOnly(')[0];
  for(const x of ['activeDemoHistoryNodes(cachedDemoVerifiedOnChart)',
    'historyOcrTwoFramesVerified','realFxAccountVisible()',
    'BrokerAdapterRegistry.hasDemoExecutor(pkg)',
    'svc.rootInActiveWindow','metrics.widthPixels*0.77f',
    'metrics.heightPixels*0.855f',
    'overlayBounds.contains','clickExactDemoNavigationLabel('])
    assert.ok(fn.includes(x),x);
  assert.doesNotMatch(fn,/GLOBAL_ACTION_BACK|performGlobalAction|pressAutoOneDollarDemoOrderOnce|pressVerifiedDemoStakeOnce429|onVerifiedClosed|\.putBoolean\("attempted", false\)/);
  assert.ok(fn.includes('val name=Regex("""(?i)^(?:Mai\\s+multe|More)$""")'));
});

test('596 history and social are both non-chart until TWO fresh asset/M5/BUY/SELL frames',()=>{
  assert.match(ocr,/historyPageVisible433 = true[\s\S]*?nonChartSafety595 = true/);
  assert.match(ocr,/chartProofSamples595>=2/);
  assert.match(ocr,/nonChartSafety595=false/);
  const pause=service.split('fun pauseForTrade516(): Boolean {')[1].split('fun stopOnReal517(')[0];
  assert.match(pause,/if \(nonChartSafety595\) \{/);
  assert.match(pause,/fxRotationTradePaused516 = true/);
  assert.match(service,/private const val CHART_ONLY_DEMO_462 = true/);
  assert.match(monitor,/QT REAL DETECTAT • ROBOT OPRIT/);
});
test('596 navigation remains diagnostically transparent and cannot settle order',()=>{
  assert.match(monitor,/MAI MULTE OCR\/ACCESIBILITATE 0\/2/);
  assert.match(monitor,/MAI MULTE OCR 1\/2/);
  assert.match(monitor,/MAI MULTE OCR 2\/2/);
  const fallback=monitor.split('// 596: WebView OCR may miss the tiny far-right')[1]
     .split('// Amount edits depend on broker-verified settled trade receipts')[0];
  assert.doesNotMatch(fallback,/putBoolean\("attempted", false\)|onVerifiedClosed|pressAutoOneDollarDemoOrderOnce/);
  const proof=service.split('private fun inspectPassiveDemoProof463(')[1]
    .split('private fun maybeRearmExpiredDemoPilot464(')[0];
  for(const required of ['verifiedClosedDetail437','closed.positionId',
    'closed.stakeCents != stake','closed.payoutPercent != payout',
    'demoEmptyReviewReads','martingaleResultDurable581'])
    assert.ok(proof.includes(required),required);
});
test('596 build produces different signed APK and runs regression',()=>{
 assert.match(workflow,/test_596_accessible_more_diagnostics\.mjs/);
 assert.match(workflow,/versionCode'\]=610/);
 assert.match(workflow,/ScalpAtlas-610-OVERLAY-QT-DEMO-G24\.apk/);
 assert.match(workflow,/apksigner/);
});
