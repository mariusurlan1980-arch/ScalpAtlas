import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../native-overlay/ScalpOverlayService.kt',import.meta.url),'utf8');
const touch=readFileSync(new URL('../native-overlay/TouchTestService.kt',import.meta.url),'utf8');
const flow=readFileSync(new URL('../workflows/build-native-robot-safe-preflight-379.yml',import.meta.url),'utf8');
const rotate=src.split('fun pauseForTrade516(): Boolean {')[1].split('private fun updateOverlay(',1)[0];
test('605 inaccessible payout skips unverified pair without opening an order',()=>{
  assert.match(rotate,/PAYOUT NECITIT • SAR/);
  assert.match(rotate,/if \(checks > 20\) after\(750L\)/);
  assert.match(rotate,/if \(!TouchTestService\.isPreferredFxPair517\(pair\) \|\|/);
  assert.match(rotate,/\(payout != null && payout != 92\)/);
  assert.match(rotate,/val payout = TouchTestService\.readFxChartPayout\(pair, realAccount\)/);
});
test('605 visible Demo pair can safely rotate while payout is inaccessible',()=>{
  assert.match(rotate,/val safeFxSelector605 = current != null && !realAccount &&/);
  assert.match(rotate,/TouchTestService\.demoFxAccountInForeground\(\)/);
  assert.match(rotate,/!TouchTestService\.realFxAccountVisible\(\)/);
  assert.match(rotate,/else if \(TouchTestService\.readFxChartPayout\(current, false\) == null\)/);
  assert.match(rotate,/val chartVisible = visiblePair != null && !realAccount &&/);
  assert.match(rotate,/!historyPageVisible433/);
});
test('605 does not change the SELL button or bypass proof and MG safety',()=>{
  assert.match(src,/private const val CHART_ONLY_DEMO_462 = true/);
  assert.match(src,/tradePositionGate\.brokerVerifiedEmptyDemoReview\(true\)/);
  assert.match(src,/demoAutoStakePlan565\.onVerifiedClosed\(/);
  assert.match(src,/QT REAL DETECTAT • ROBOT OPRIT/);
  assert.match(touch,/fun readFxChartPayout\(/);
});
test('605 unique Android APK release',()=>{
  assert.match(flow,/versionCode'\]=610/);
  assert.match(flow,/ScalpAtlas-610-OVERLAY-QT-DEMO-G24\.apk/);
  assert.match(flow,/test_605_skip_unreadable_payout\.mjs/);
});
