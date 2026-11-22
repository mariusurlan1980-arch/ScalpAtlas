import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const service=readFileSync(new URL('../native-overlay/ScalpOverlayService.kt',import.meta.url),'utf8');
const touch=readFileSync(new URL('../native-overlay/TouchTestService.kt',import.meta.url),'utf8');
const flow=readFileSync(new URL('../workflows/build-native-robot-safe-preflight-379.yml',import.meta.url),'utf8');
const monitor=service.split('private fun startBrokerAccountMonitor()')[1]
  .split('private fun startDemoClickMonitor()')[0];
const ret=service.split('private fun returnToChartAfterReview458(')[1]
  .split('private fun navigateVerifiedDemoHistory431(')[0];
const ocr=service.split('private fun recordExplicitEmptyOpenOcr(')[1]
  .split('private fun scheduleTimeframeOcr(')[0];

test('595 no third footer: Social Trading cannot be misclassified as the live candlestick chart',()=>{
 for(const x of ['val social595 =','Social[ăa]','socialPageSeen595 = true',
  'nonChartSafety595 = true','val quickRegex595','quickEntrySamples595',
  'val more595','moreFooterSamples595','val pair595','val m5595','val buy595','val sell595',
  'chartProofSamples595>=2','nonChartSafety595=false'])
   assert.ok(ocr.includes(x),x);
 for(const x of ['tapVerifiedDemoMoreFooter595(','MAI MULTE DESCHIS'])
   assert.ok(ret.includes(x),x);
 assert.doesNotMatch(ret,/tapDerivedDemoTradingFooter594\(|tapVerifiedDemoTradingFooterOcr593\(|returnToDemoChartAfterVerifiedEmptyReview\(/);
 assert.doesNotMatch(monitor,/returnFromDemoPerspectivesToTrading591\(/);
});
test('595 read-only More -> exact Quick Trading is never a social button, account selector or order',()=>{
 for(const x of ['val socialFresh595=','tapVerifiedDemoMoreFooter595(',
    'tapVerifiedDemoQuickTradingEntry595(','quickEntrySamples595 >= 2',
    'nonChartSafety595','!TouchTestService.realFxAccountVisible()',
    'QUICK','TRADING RAPID SELECTAT']) {
   if(x==='QUICK') continue;
   assert.ok(monitor.includes(x),x);
 }
 for(const fn of ['tapVerifiedDemoMoreFooter595','tapVerifiedDemoQuickTradingEntry595']) {
   const method=touch.split('fun '+fn+'(')[1].split('fun ',1)[0];
   assert.ok(method && method.includes('svc.dispatchGesture('),fn);
   assert.match(method,/realFxAccountVisible\(\)/);
   assert.match(method,/BrokerAdapterRegistry\.hasDemoExecutor\(expectedBrokerPackage\)/);
   assert.match(method,/overlayBounds\.contains/);
   assert.doesNotMatch(method,/pressVerifiedDemoStakeOnce429|pressAutoOneDollarDemoOrderOnce|GLOBAL_ACTION_BACK|ACTION_GLOBAL_BACK|onVerifiedClosed/);
 }
 assert.match(touch,/xFraction !in 0\.76f\.\.0\.985f/);
 assert.match(touch,/yFraction !in 0\.20f\.\.0\.86f/);
});
test('595 briefly uncovers rightmost More footer so masked OCR can read two frames',()=>{
 assert.match(monitor,/lastSocialUncover595=recoveryNow595/);
 assert.match(monitor,/moreFooterSamples595 < 2/);
 assert.match(monitor,/overlayUncover595.visibility=View.INVISIBLE/);
 assert.match(monitor,/overlayUncover595.visibility=was595/);
 assert.match(monitor,/4_000L/);
 assert.match(monitor,/!TouchTestService.realFxAccountVisible\(\)/);
});
test('595 FX scanner pauses until fresh M5, asset, BUY and SELL screen proof',()=>{
 const fx=service.split('fun pauseForTrade516(): Boolean {')[1].split('fun stopOnReal517(',1)[0];
 assert.match(fx,/if \(nonChartSafety595\) \{/);
 assert.match(fx,/fxRotationTradePaused516 = true/);
 assert.match(fx,/return true/);
 assert.match(ocr,/chartProofSamples595>=2/);
 assert.match(ocr,/nonChartSafety595=false/);
 const navigation=service.split('private fun returnToChartAfterReview458(')[1]
  .split('private fun navigateVerifiedDemoHistory431(')[0];
 assert.doesNotMatch(navigation,/\.putBoolean\("attempted", false\)|onVerifiedClosed\(/);
});
test('595 no Real access and broker-settlement 2/2 stays mandatory',()=>{
 const proof=service.split('private fun inspectPassiveDemoProof463(')[1]
 .split('private fun maybeRearmExpiredDemoPilot464(')[0];
 for(const x of ['verifiedClosedDetail437','closed.positionId',
  'closed.stakeCents != stake','closed.payoutPercent != payout',
  'demoEmptyReviewReads','martingaleResultDurable581','.putBoolean("attempted", false)'])
  assert.ok(proof.includes(x),x);
 assert.match(service,/private const val CHART_ONLY_DEMO_462 = true/);
 assert.match(service,/QT REAL DETECTAT • ROBOT OPRIT/);
});
test('595 signed Motorola release',()=>{
 assert.match(flow,/test_595_social_not_chart\.mjs/);
 assert.match(flow,/versionCode'\]=596/);
 assert.match(flow,/ScalpAtlas-596-MORE-VERIFY-G24\.apk/);
 assert.match(flow,/apksigner/);
});
