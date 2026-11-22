import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const service = readFileSync(new URL('../native-overlay/ScalpOverlayService.kt',import.meta.url),'utf8');
const touch = readFileSync(new URL('../native-overlay/TouchTestService.kt',import.meta.url),'utf8');
const flow = readFileSync(new URL('../workflows/build-native-robot-safe-preflight-379.yml',import.meta.url),'utf8');

test('594 QT Demo history auto-return is independent of trade age but orders remain gated',()=>{
  const monitor=service.split('private fun startBrokerAccountMonitor()')[1]
    .split('private fun startDemoClickMonitor()')[0];
  const returnGate = monitor.slice(monitor.indexOf('// 594: Once the same-package QT Demo history'),
    monitor.indexOf('val socialFresh595='));
  assert.match(returnGate,/if \(historyFresh592 &&/);
  assert.doesNotMatch(returnGate,/if \(afterExpiry592 && historyFresh592/);
  for (const requirement of ['historyPeekStartedAt592 = nowElapsed592',
    'historyPeekRetryAfter592 = reviewNow592 + 297_000L',
    'overlayDuringHistory593.visibility = View.INVISIBLE',
    'overlayDuringHistory593?.visibility = oldVisibility593',
    'returnToChartAfterReview458(true, true)', '}, 3_000L)',
    'reviewPkg592 != null', '!TouchTestService.realFxAccountVisible()'])
    assert.ok(returnGate.includes(requirement),requirement);
  assert.match(monitor,/val afterExpiry592 = attempted592/);
  assert.match(monitor,/afterExpiry592 && !reviewCompleted600 &&/);
  assert.match(service,/private const val CHART_ONLY_DEMO_462 = true/);
});
test('594 infer Trading footer only from TWO independently read adjacent broker bottom labels',()=>{
  const fn=service.split('private fun recordExplicitEmptyOpenOcr(')[1]
     .split('private fun scheduleTimeframeOcr(')[0];
  for(const required of [
    'val leftFooter594 = if (trueHistoryPage433)',
    'val middleFooter594 = if (trueHistoryPage433)',
    'val deltaX594 = middleFooter594.first - leftFooter594.first',
    'val x594 = middleFooter594.first + deltaX594',
    'deltaX594 in 0.14f..0.32f',
    'x594 in 0.58f..0.80f',
    'derivedTradingPackage594 == pkg',
    'observedAt - derivedTradingAt594 in 750L..6_000L',
    'derivedTradingSamples594 = (derivedTradingSamples594 + 1)',
    'Regex("""(?i)^(?:Perspective'
  ]) assert.ok(fn.includes(required),required);
});
test('594 derived gesture never leaves bottom navigation or accesses Real, trade controls',()=>{
  const fn=touch.split('fun tapDerivedDemoTradingFooter594(')[1]
    .split('fun inspectExplicitEmptyOpenDemoTabReadOnly(')[0];
  for(const required of ['ocrVerifiedHistoryPage',
    'twoFooterAnchorsVerified',
    'centerXFraction !in 0.58f..0.80f',
    'centerYFraction !in 0.86f..0.985f',
    'realFxAccountVisible()',
    'BrokerAdapterRegistry.hasDemoExecutor(expectedBrokerPackage)',
    'overlayBounds.contains', 'svc.dispatchGesture('])
    assert.ok(fn.includes(required),required);
  assert.doesNotMatch(fn,/GLOBAL_ACTION_BACK|performGlobalAction|pressVerifiedDemoStakeOnce429|pressAutoOneDollarDemoOrderOnce/);
  const ret=service.split('private fun returnToChartAfterReview458(')[1]
    .split('private fun navigateVerifiedDemoHistory431(')[0];
  assert.match(ret,/moreFooterSamples595 < 2/);
  assert.match(ret,/tapVerifiedDemoMoreFooter595\(/);
  assert.match(ret,/moreFooterPkg595 != pkg595/);
});
test('594 no false WIN, LOSS or attempted-order reset from navigation',()=>{
  const fn=service.split('private fun returnToChartAfterReview458(')[1]
    .split('private fun navigateVerifiedDemoHistory431(')[0];
  assert.doesNotMatch(fn,/\.putBoolean\("attempted", false\)|onVerifiedClosed\(/);
  const proof=service.split('private fun inspectPassiveDemoProof463(')[1]
    .split('private fun maybeRearmExpiredDemoPilot464(')[0];
  for(const x of ['verifiedClosedDetail437','closed.positionId',
    'closed.stakeCents != stake','closed.payoutPercent != payout',
    'demoEmptyReviewReads', 'martingaleResultDurable581',
    '.putBoolean("attempted", false)']) assert.ok(proof.includes(x),x);
  assert.match(service,/QT REAL DETECTAT • ROBOT OPRIT/);
});
test('594 APK for Motorola keeps all prior tests and signature',()=>{
  assert.match(flow,/test_593_history_return_panel\.mjs/);
  assert.match(flow,/test_594_safe_history_footer\.mjs/);
  assert.match(flow,/versionCode'\]=603/);
  assert.match(flow,/ScalpAtlas-603-OVERLAY-QT-DEMO-G24\.apk/);
  assert.match(flow,/apksigner/);
});
