import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const service=readFileSync('.github/native-overlay/ScalpOverlayService.kt','utf8');
const plan=readFileSync('.github/native-overlay/DemoAutoStakePlan565.kt','utf8');
const workflow=readFileSync('.github/workflows/build-native-robot-safe-preflight-379.yml','utf8');
const drag=service.split('val dragListener = View.OnTouchListener')[1]
  .split('root.setOnTouchListener(dragListener)')[0];
const relocation=service.split('private fun liftOverlayOffDemoOrderButtons557()')[1]
  .split('private fun updateOverlay(')[0];

test('588: a manual drag stays pinned rather than jumping above 70% screen height',()=>{
  assert.match(service,/@Volatile private var overlayDragActive588 = false/);
  assert.match(drag,/MotionEvent.ACTION_DOWN -> \{\s*overlayDragActive588 = true/);
  assert.match(drag,/\.putBoolean\("freePosition500", true\)/);
  assert.match(drag,/MotionEvent.ACTION_UP ->/);
  assert.match(drag,/overlayDragActive588 = false/);
  assert.match(relocation,/if \(overlayDragActive588 \|\|/);
  assert.match(relocation,/getBoolean\("freePosition500", false\)\) return false/);
});

test('588: manual position never bypasses order check if it covers BUY or SELL',()=>{
  const code=service.split('private fun maybeApplyVerifiedDemoStake565(')[1]
    .split('private fun brokerHistoryClockSeconds582(')[0];
  assert.match(code,/tradePositionGate\.state\(\)!=TradePositionGate\.State\.READY/);
  assert.match(code,/TouchTestService\.inspectBrokerDemoOrder488\(/);
  assert.match(service,/TouchTestService\.inspectBrokerDemoOrder488\(tradePair429, currentOverlayBounds488\(\)\)/);
  assert.match(service,/if \(!latestPreflight\.startsWith\("PREGĂTIT AUTO DEMO"\)\)/);
  assert.match(service,/tradePositionGate\.beginAttempt\(\)/);
  assert.match(service,/TouchTestService\.confirmedFiveMinuteDemoExpiry465\(\)/);
  assert.doesNotMatch(relocation,/pressVerifiedDemoStakeOnce429|onVerifiedClosed|beginAttempt/);
});

test('588: Martingale only follows a broker verified result and retains risk cap',()=>{
  assert.match(plan,/fun onVerifiedClosed\(/);
  assert.match(plan,/netProfitCents != -stakeCents/);
  assert.match(plan,/STOP_AFTER_LOSSES = 10/);
  assert.match(plan,/PAYOUT_EXACT = 92/);
  assert.match(plan,/fun permitsFreshDemoOrder\(/);
});

test('588: release workflow builds the new Motorola package and runs this test',()=>{
  assert.match(workflow,/versionCode'\]=595/);
  assert.match(workflow,/ScalpAtlas-595-REAL-CHART-G24\.apk/);
  assert.match(workflow,/test_588_manual_overlay_lock\.mjs/);
});
