import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const service=readFileSync(new URL('../native-overlay/ScalpOverlayService.kt',import.meta.url),'utf8');
const flow=readFileSync(new URL('../workflows/build-native-robot-safe-preflight-379.yml',import.meta.url),'utf8');
const template=readFileSync(new URL('../templates/ScalpAtlasOneButtonOverlayApp.tsx',import.meta.url),'utf8');
const monitor=service.split('private fun startBrokerAccountMonitor()')[1]
  .split('private fun startDemoClickMonitor()')[0];

test('609 retains three-second default while allowing verified base EMPTY OPEN review',()=>{
  for(const proof of ['val attemptKey600 =','completedAttempt',
    '!reviewCompleted600','historyPeekStartedAt592 > 0L',
    'nowElapsed592 - historyPeekStartedAt592 in 0L..3_000L',
    'val reviewKey600 = attemptKey600',
    'putString("completedAttempt", reviewKey600)',
    '297_000L','}, historyReviewWindow609)'])
    assert.ok(monitor.includes(proof),proof);
  assert.match(monitor,/afterExpiry592 && !reviewCompleted600 &&/);
});
test('600 use only completed trades during the short visit, never Social',()=>{
  assert.match(monitor,/historyPageTab433 == "DESCHIS"/);
  assert.match(monitor,/TouchTestService\.advanceDemoClosedHistoryNavigation\(true\)/);
  assert.match(monitor,/returnToChartAfterReview458\(true, true\)/);
  assert.match(monitor,/tapVerifiedDemoQuickTradingEntry595/);
  assert.doesNotMatch(monitor,/returnFromDemoPerspectivesToTrading591\(/);
});
test('600 preserve old-order settlement proof, demo-only guard and strict chart verification',()=>{
  assert.match(service,/private const val CHART_ONLY_DEMO_462 = true/);
  assert.match(service,/tradePositionGate\.brokerVerifiedEmptyDemoReview\(true\)/);
  assert.match(service,/demoRecoveryLedger\.onVerifiedDemoClosed\(/);
  assert.match(monitor,/QT REAL DETECTAT • ROBOT OPRIT/);
  assert.match(service,/chartProofSamples595>=2/);
  assert.match(template,/Suprapunere pornită\. Revino manual pe graficul QT Demo M5/);
  assert.doesNotMatch(template,/await Linking\.openURL\(POCKET_OPTION_QT_DEMO_URL\)/);
});
test('600 Android version and artifact match',()=>{
  assert.match(flow,/versionCode'\]=610/);
  assert.match(flow,/ScalpAtlas-610-OVERLAY-QT-DEMO-G24\.apk/);
  assert.match(flow,/test_600_chart_first_3s\.mjs/);
});
