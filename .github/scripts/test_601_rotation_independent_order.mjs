import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const service=readFileSync(new URL('../native-overlay/ScalpOverlayService.kt',import.meta.url),'utf8');
const template=readFileSync(new URL('../templates/ScalpAtlasOneButtonOverlayApp.tsx',import.meta.url),'utf8');
const monitor=service.split('private fun startBrokerAccountMonitor()')[1]
  .split('private fun startDemoClickMonitor()')[0];
const rotation=service.split('fun pauseForTrade516(): Boolean {')[1].split('fun stopOnReal517(',1)[0];

test('601 old attempt never freezes scanning beyond active-trade interval',()=>{
 assert.match(rotation,/val pendingFiveMinuteOrder = persistedAttempt601 &&/);
 assert.match(rotation,/DEMO_TEST_EXPIRY_MS_465 \+ 15_000L/);
 assert.match(rotation,/val orderMayBeActive = pendingFiveMinuteOrder \|\| visuallyActive \|\| verifiedOpen/);
 assert.doesNotMatch(rotation,/if \(prefs\.getBoolean\("attempted", false\)\)\s*\{[\s\S]*?return true/);
 assert.match(rotation,/val wasPaused = fxRotationTradePaused516/);
 assert.match(rotation,/if \(wasPaused\) \{/);
 assert.match(rotation,/openList\(pair, false\)/);
});
test('601 maintains 30 second chart cycle and 3 second CLOSED-only window',()=>{
 assert.match(service,/dwell\(pair, android\.os\.SystemClock\.elapsedRealtime\(\) \+ 30_000L, 12\)/);
 assert.match(monitor,/historyPeekStartedAt592 > 0L/);
 assert.match(monitor,/nowElapsed592 - historyPeekStartedAt592 in 0L\.\.3_000L/);
 assert.match(monitor,/TouchTestService\.advanceDemoClosedHistoryNavigation\(true\)/);
 assert.match(monitor,/returnToChartAfterReview458\(true, true\)/);
 assert.match(monitor,/!reviewCompleted600/);
});
test('601 only navigation freed, not order, account or money safety',()=>{
 assert.match(service,/tradePositionGate\.beginAttempt\(\)/);
 assert.match(service,/demoRecoveryLedger\.onVerifiedDemoClosed\(/);
 assert.match(service,/CHART_ONLY_DEMO_462 = true/);
 assert.match(service,/QT REAL DETECTAT • ROBOT OPRIT/);
 assert.match(service,/chartProofSamples595>=2/);
 assert.doesNotMatch(template,/await Linking\.openURL\(POCKET_OPTION_QT_DEMO_URL\)/);
});
