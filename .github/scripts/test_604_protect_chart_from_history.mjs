import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const service=readFileSync(new URL('../native-overlay/ScalpOverlayService.kt',import.meta.url),'utf8');
const workflow=readFileSync(new URL('../workflows/build-native-robot-safe-preflight-379.yml',import.meta.url),'utf8');
const monitor=service.split('private fun startBrokerAccountMonitor()')[1].split('private fun startDemoClickMonitor()')[0];
const ocr=service.split('private fun recordExplicitEmptyOpenOcr(')[1].split('private fun scheduleTimeframeOcr(')[0];
const chartExit=service.split('private fun returnToChartAfterReview458(')[1].split('private fun navigateVerifiedDemoHistory431(')[0];

test('610 chart-first default, with explicit short-lived user-authorized history exception',()=>{
  assert.match(monitor,/val userReview610 = historyReviewRequestedAt610 > 0L &&/);
  assert.match(monitor,/val pendingAutoHistory589 = CHART_ONLY_DEMO_462 &&[\s\S]*?\(historyFresh592 \|\| brokerChartReturnProven604 \|\| userReview610\) &&/);
  assert.match(monitor,/nowElapsed592 - historyReviewRequestedAt610 in 0L\.\.90_000L/);
  assert.match(monitor,/pendingStakeOptIn571 &&/);
  assert.match(monitor,/if \(CHART_ONLY_DEMO_462 && !pendingAutoHistory589\) \{/);
  assert.match(ocr,/if\(chartProofSamples595>=2\)\{/);
  assert.match(ocr,/quickNavAttemptAt595 > 0L/);
  assert.match(ocr,/pkg == verifiedDemoAccountPackage/);
  assert.match(ocr,/brokerChartReturnProven604=true/);
});
test('604 only one More navigation attempt per history visit, no unverified route orders',()=>{
  assert.match(chartExit,/moreNavAttemptAt595 >= historyPageFirstSeenAt603/);
  assert.match(chartExit,/MAI MULTE DEJA VERIFICAT/);
  assert.match(chartExit,/TouchTestService\.tapVerifiedDemoMoreFooter595\(/);
  assert.match(monitor,/TouchTestService\.tapVerifiedDemoQuickTradingEntry595\(/);
  assert.match(ocr,/moreNavAttemptAt595 = 0L/);
  assert.doesNotMatch(chartExit,/onVerifiedClosed|\.putBoolean\("attempted", false\)/);
});
test('604 keeps exact QT Demo and Martingale proof before subsequent order',()=>{
  assert.match(service,/private const val CHART_ONLY_DEMO_462 = true/);
  assert.match(service,/tradePositionGate\.brokerVerifiedEmptyDemoReview\(true\)/);
  assert.match(service,/demoAutoStakePlan565\.onVerifiedClosed\(/);
  assert.match(service,/QT REAL DETECTAT • ROBOT OPRIT/);
  assert.match(service,/val historyReturnDue603 = historyFresh592 &&/);
});
test('604 distinct signed Motorola APK',()=>{
  assert.match(workflow,/versionCode'\]=611/);
  assert.match(workflow,/ScalpAtlas-611-OVERLAY-QT-DEMO-G24\.apk/);
  assert.match(workflow,/test_604_protect_chart_from_history\.mjs/);
});
