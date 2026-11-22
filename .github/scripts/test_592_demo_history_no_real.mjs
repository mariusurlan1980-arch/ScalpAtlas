import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const service=readFileSync(new URL('../native-overlay/ScalpOverlayService.kt',import.meta.url),'utf8');
const touch=readFileSync(new URL('../native-overlay/TouchTestService.kt',import.meta.url),'utf8');
const workflow=readFileSync(new URL('../workflows/build-native-robot-safe-preflight-379.yml',import.meta.url),'utf8');

test('592 history review returns via Trading tab, never global Android Back',()=>{
 const nav=touch.split('fun returnToDemoChartAfterVerifiedEmptyReview(')[1]
   .split('fun inspectExplicitEmptyOpenDemoTabReadOnly(')[0];
 for(const x of ['if (!ocrVerifiedHistoryPage)','activeDemoHistoryNodes(cachedDemoVerifiedOnChart)',
  'realFxAccountVisible()', 'val footerName = Regex','Tranzacționare',
  'overlayBounds.contains','clickExactDemoNavigationLabel(']) assert.ok(nav.includes(x),x);
 assert.doesNotMatch(nav,/performGlobalAction\(/);
 assert.doesNotMatch(nav,/GLOBAL_ACTION_BACK/);
 assert.doesNotMatch(nav,/press.*DemoOrder|onVerifiedClosed|putBoolean\("attempted", false\)/);
});

test('592 waits until 5-minute expiry and keeps the review to 3 seconds',()=>{
 const monitor=service.split('private fun startBrokerAccountMonitor()')[1]
   .split('private fun startDemoClickMonitor()')[0];
 for(const x of ['val afterExpiry592 = attempted592','DEMO_TEST_EXPIRY_MS_465 + 3_000L',
  'val historyFresh592 = historyPageVisible433',
  'historyPeekStartedAt592 = nowElapsed592', 'historyPeekRetryAfter592 = reviewNow592 + 297_000L',
  '}, 3_000L)', 'afterExpiry592 && !reviewCompleted600 &&'])
   assert.ok(monitor.includes(x),x);
 const one=monitor.indexOf('afterExpiry592 && !reviewCompleted600 &&');
 const nav=monitor.indexOf('if (CHART_ONLY_DEMO_462 && !pendingAutoHistory589)');
 assert.ok(one>0&&one<nav);
});

test('592 QT Real detection halts robot instead of switching accounts',()=>{
 const monitor=service.split('private fun startBrokerAccountMonitor()')[1]
   .split('private fun startDemoClickMonitor()')[0];
 assert.match(monitor,/diagnostic\.contains\("QT REAL IDENTIFICAT"\)/);
 assert.match(monitor,/realAccountSafetyStop517 = true/);
 assert.match(monitor,/autoDemoArmed = false/);
 assert.match(monitor,/QT REAL DETECTAT • ROBOT OPRIT/);
 const returnFn=service.split('private fun returnToChartAfterReview458(')[1]
   .split('private fun navigateVerifiedDemoHistory431(')[0];
 assert.match(returnFn,/val bounds595 = if \(overlayView\?\.visibility == View\.INVISIBLE\)/);
 assert.match(returnFn,/Rect\(\) else currentOverlayBounds488\(\)/);
 assert.match(returnFn,/bounds595/);
 assert.doesNotMatch(returnFn,/tapVerifiedDemoPerspectiveFooter457/);
});

test('592 old uncertain order can never rearm from elapsed time or skip broker proof',()=>{
 const pilot=service.split('private fun maybeRearmExpiredDemoPilot464(')[1]
   .split('private fun demoOrderVerificationStatus()')[0];
 assert.match(pilot,/if \(prefs\.getBoolean\("attempted", false\)\)/);
 assert.match(pilot,/ORDIN ANTERIOR NECONFIRMAT • FĂRĂ REARMARE/);
 const proof=service.split('private fun inspectPassiveDemoProof463(')[1]
   .split('private fun maybeRearmExpiredDemoPilot464(')[0];
 for(const x of ['verifiedClosedDetail437','closed.positionId','closed.stakeCents != stake',
  'closed.payoutPercent != payout','demoEmptyReviewReads','martingaleResultDurable581',
  '.putBoolean("attempted", false)'])assert.ok(proof.includes(x),x);
 assert.match(service,/private const val CHART_ONLY_DEMO_462 = true/);
});

test('592 new signed Motorola artifact and regression checks',()=>{
 assert.match(workflow,/test_592_demo_history_no_real\.mjs/);
 assert.match(workflow,/versionCode'\]=602/);
 assert.match(workflow,/ScalpAtlas-602-OVERLAY-QT-DEMO-G24\.apk/);
 assert.match(workflow,/apksigner/);
});
