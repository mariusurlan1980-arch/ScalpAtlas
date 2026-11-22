import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const service=readFileSync(new URL('../native-overlay/ScalpOverlayService.kt',import.meta.url),'utf8');
const touch=readFileSync(new URL('../native-overlay/TouchTestService.kt',import.meta.url),'utf8');
const flow=readFileSync(new URL('../workflows/build-native-robot-safe-preflight-379.yml',import.meta.url),'utf8');

test('593 briefly uncovers Trading footer and restores the manual pinned overlay',()=>{
 const monitor=service.split('private fun startBrokerAccountMonitor()')[1]
   .split('private fun startDemoClickMonitor()')[0];
 for (const x of [
   'historyPeekStartedAt592 = nowElapsed592', 'val oldVisibility593',
   'overlayDuringHistory593.visibility = View.INVISIBLE',
   'oldVisibility593 == View.VISIBLE',
   'overlayDuringHistory593?.visibility = oldVisibility593',
   'overlayView === overlayDuringHistory593',
   'returnToChartAfterReview458(true, true)', '}, 3_000L)',
   'historyPeekRetryAfter592 = reviewNow592 + 297_000L'
 ]) assert.ok(monitor.includes(x),x);
 assert.match(monitor,/!TouchTestService\.realFxAccountVisible\(\)/);
 assert.match(monitor,/reviewPkg592 != null/);
 const navigationOnly=monitor.split('val overlayDuringHistory593 =')[1]
   .split('}, 3_000L)')[0];
 assert.ok(navigationOnly);
 assert.doesNotMatch(navigationOnly,/putBoolean\("attempted", false\)/);
});

test('593 OCR 2/2 exact Trading footer navigation never targets account or trade buttons',()=>{
 const fn=touch.split('fun tapVerifiedDemoTradingFooterOcr593(')[1]
   .split('fun inspectExplicitEmptyOpenDemoTabReadOnly(')[0];
 for (const x of [
   'ocrVerifiedHistoryPage', 'cachedDemoVerifiedOnChart',
   'centerXFraction !in 0.58f..0.98f','centerYFraction !in 0.86f..0.985f',
   'realFxAccountVisible()',
   'BrokerAdapterRegistry.hasDemoExecutor(expectedBrokerPackage)',
   'overlayBounds.contains', 'svc.dispatchGesture('
 ]) assert.ok(fn.includes(x),x);
 assert.doesNotMatch(fn,/ACTION_GLOBAL_BACK|GLOBAL_ACTION_BACK|performGlobalAction\(/);
 assert.doesNotMatch(fn,/pressVerifiedDemoStakeOnce429|pressAutoOneDollarDemoOrderOnce|putBoolean\("attempted", false\)/);
});

test('593 history OCR cadence allows independent samples before bounded return',()=>{
 const ocr=service.split('private fun scheduleTimeframeOcr(')[1]
   .split('private fun ',1)[0];
 assert.match(ocr,/val historyOcrPeriod593 = if \(historyPageVisible433/);
 assert.match(ocr,/900L\s+else OCR_INTERVAL_MS/);
 assert.match(ocr,/now - lastOcrAttemptAt < historyOcrPeriod593/);
 const sampling=service.split('private fun recordExplicitEmptyOpenOcr(')[1]
   .split('private fun scheduleTimeframeOcr(')[0];
 for(const x of ['val tradingRegex593','tradingFooterSamples593',
   'tradingFooterPackage593 == pkg',
   'observedAt - tradingFooterAt593 in 750L..6_000L',
   'tradingCandidates593.size == 1']) assert.ok(sampling.includes(x),x);
 const returnFn=service.split('private fun returnToChartAfterReview458(')[1]
   .split('private fun navigateVerifiedDemoHistory431(')[0];
 assert.match(returnFn,/moreFooterSamples595 < 2/);
 assert.match(returnFn,/tapVerifiedDemoMoreFooter595\(/);
 assert.match(returnFn,/historyPageVisible433/);
});

test('593 retains verified CLOSED 2/2, EMPTY OPEN 2/2, and no Real account orders',()=>{
 const proof=service.split('private fun inspectPassiveDemoProof463(')[1]
   .split('private fun maybeRearmExpiredDemoPilot464(')[0];
 for(const x of ['verifiedClosedDetail437','closed.positionId',
    'closed.stakeCents != stake','closed.payoutPercent != payout',
    'demoEmptyReviewReads','martingaleResultDurable581',
    '.putBoolean("attempted", false)']) assert.ok(proof.includes(x),x);
 assert.match(service,/private const val CHART_ONLY_DEMO_462 = true/);
 assert.match(service,/QT REAL DETECTAT • ROBOT OPRIT/);
});

test('593 release maintains prior tests with distinct Motorola APK',()=>{
 assert.match(flow,/test_592_demo_history_no_real\.mjs/);
 assert.match(flow,/test_593_history_return_panel\.mjs/);
 assert.match(flow,/versionCode'\]=608/);
 assert.match(flow,/ScalpAtlas-608-OVERLAY-QT-DEMO-G24\.apk/);
 assert.match(flow,/apksigner/);
});
