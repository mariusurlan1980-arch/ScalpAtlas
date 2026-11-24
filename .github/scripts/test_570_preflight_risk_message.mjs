import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const overlay=readFileSync(new URL('../native-overlay/ScalpOverlayService.kt',import.meta.url),'utf8');

test('570 compact preflight explains how to reach the explicit QT Demo stake opt-in',()=>{
  assert.ok(overlay.includes('BLOCAT: PRIMUL DEMO 1,09 / 92% SAU ORDIN VECHI NECONFIRMAT'));
  assert.ok(overlay.includes('header.addView(minimizeToggle, 1, LinearLayout.LayoutParams(dp(28), dp(28)))'));
  assert.ok(overlay.includes('stakeAutoRow565.visibility = View.VISIBLE'));
  assert.ok(overlay.includes('MIZĂ AUTO DEMO • OFF'));
});

test('570 persistent risk stop has higher priority than disabled opt-in at all three entry diagnostics',()=>{
  const fragments=[
    overlay.slice(overlay.indexOf('val rejection552 = when {'),overlay.indexOf('val rejection552 = when {')+550),
    overlay.slice(overlay.indexOf('val condition = when {',overlay.indexOf('val rejection552 = when {')),overlay.indexOf('val condition = when {',overlay.indexOf('val rejection552 = when {'))+550),
    overlay.slice(overlay.indexOf('val diagnostic = when {',overlay.indexOf('val eligibleSignal547 =')),overlay.indexOf('val diagnostic = when {',overlay.indexOf('val eligibleSignal547 ='))+550),
  ];
  for(const fragment of fragments) {
    const risk=fragment.indexOf('demoAutoStakePlan565.isRiskStopped()');
    const off=fragment.indexOf('!demoAutoStakePlan565.isEnabled()');
    assert.ok(risk>=0 && off>risk,'STOP RISC must win over OFF');
  }
});

test('570 must keep hard order gates, planned DEMO budget and first stake unchanged',()=>{
  const plan=readFileSync(new URL('../native-overlay/DemoAutoStakePlan565.kt',import.meta.url),'utf8');
  assert.ok(plan.includes('PLANNED_BUDGET_CENTS = 157244L'));
  assert.ok(plan.includes('STOP_AFTER_LOSSES = 10'));
  assert.ok(plan.includes('private val LADDER = longArrayOf(109L,228L'));
  assert.ok(overlay.includes('demoAutoStakePlan565.permitsFreshDemoOrder('));
  assert.ok(overlay.includes('TouchTestService.readVerifiedDemoPayoutForPair(pair) != 92'));
  assert.ok(overlay.includes('!realAccountSafetyStop517 && !ambiguousAccountHold629 && !accountRecheckPending'));
});
