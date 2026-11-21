import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';

const overlay=readFileSync(new URL('../native-overlay/ScalpOverlayService.kt',import.meta.url),'utf8');
const plan=readFileSync(new URL('../native-overlay/DemoAutoStakePlan565.kt',import.meta.url),'utf8');
const broker=readFileSync(new URL('../native-overlay/DemoStakeEditor.kt',import.meta.url),'utf8');
const workflow=readFileSync(new URL('../workflows/build-native-robot-safe-preflight-379.yml',import.meta.url),'utf8');

test('the first screen remains compact, but visible + button can expand',()=>{
 assert.ok(overlay.includes('var minimized = true'));
 assert.ok(overlay.includes('minimizeToggle.text = if (minimized) "+" else "−"'));
 assert.ok(overlay.includes('minimizeToggle.visibility = View.VISIBLE'));
 assert.ok(!overlay.includes('minimizeToggle.visibility = View.GONE'));
 assert.ok(overlay.includes('minimizeToggle.setOnClickListener {'));
 assert.ok(overlay.includes('minimized = !minimized'));
 assert.ok(overlay.includes('applyCompactMode()'));
});
test('button is in header, with accessible description and real click target',()=>{
 assert.ok(overlay.includes('header.addView(minimizeToggle, 1, LinearLayout.LayoutParams(dp(28), dp(28)))'));
 assert.ok(overlay.includes('isClickable = true'));
 assert.ok(overlay.includes('isFocusable = true'));
 assert.ok(overlay.includes('Extinde panoul Scalp Atlas pentru MIZĂ AUTO DEMO'));
});
test('expanded UI reveals real MIZĂ AUTO DEMO opt-in row, which is hidden compact',()=>{
 assert.ok(overlay.includes('stakeAutoRow565.visibility = if(minimized) View.GONE else View.VISIBLE'));
 assert.ok(overlay.includes('stakeAutoRow565.addView(stakeButton565'));
 assert.ok(overlay.includes('MIZĂ AUTO DEMO • OFF'));
 assert.ok(overlay.includes('MIZĂ AUTO DEMO • ON'));
});
test('only separate stake button enables/disables, +/- never changes broker or session',()=>{
 const begin=overlay.indexOf('minimizeToggle.setOnClickListener {');
 const end=overlay.indexOf('    applyCompactMode()',begin);
 assert.ok(begin>=0 && end>begin);
 const block=overlay.slice(begin,end);
 assert.ok(block.includes('minimized = !minimized'));
 assert.ok(!block.includes('pressVerifiedDemoStakeOnce429'));
 assert.ok(!block.includes('demoAutoStakePlan565.enableFromVerifiedDemo'));
 assert.ok(!block.includes('autoDemoSessionRequested'));
});
test('startup always requires 1.09 and strict broker account, payout and readback',()=>{
 assert.ok(plan.includes('private val LADDER = longArrayOf(109L,228L,475L,992L'));
 assert.ok(plan.includes('PLANNED_BUDGET_CENTS = 157244L'));
 assert.ok(plan.includes('STOP_AFTER_LOSSES = 10'));
 assert.ok(overlay.includes('BLOCAT: START 1,09 USD NECONFIRMAT'));
 assert.ok(overlay.includes('demoAutoStakePlan565.permitsFreshDemoOrder('));
 assert.ok(broker.includes('buyPayout != 92'));
 assert.ok(broker.includes('centsOf(after.input.value) != stakeCents'));
});
test('the fixed broker balance parser accepts US-formatted 1,572.68 as full amount',()=>{
 assert.ok(broker.includes('private fun brokerBalanceCents567('));
 assert.ok(broker.includes('brokerBalanceToken567.findAll(item.value)'));
 assert.ok(!broker.includes('Regex("""(?<!\\d)(\\d{1,5}[.,]\\d{2})(?!\\d)""").find(it.value)'));
});
test('Android release pipeline includes 569 layout fix and signing',()=>{
 assert.ok(workflow.includes('versionCode\']=569'));
 assert.ok(workflow.includes('ScalpAtlas-569-LEFT-PLUS-MIZA-DEMO-G24.apk'));
 assert.ok(workflow.includes('node --test .github/scripts/test_568_expand_miza.mjs'));
 assert.ok(workflow.includes('apksigner'));
});
