import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';

const ui=readFileSync(new URL('../native-overlay/ScalpOverlayService.kt',import.meta.url),'utf8');
const workflow=readFileSync(new URL('../workflows/build-native-robot-safe-preflight-379.yml',import.meta.url),'utf8');
const head=ui.slice(ui.indexOf('val header = LinearLayout(this)'),ui.indexOf('root.addView(header)'));
test('visible high-contrast + is pinned beside X, not after shock text',()=>{
 const close=head.indexOf('header.addView(close,');
 const plus=head.indexOf('header.addView(minimizeToggle, 1,');
 const brain=head.indexOf('header.addView(brainEclipse,');
 const status=head.indexOf('header.addView(compactStatus,');
 assert.ok(close>=0 && brain>close && status>brain && plus>status);
 assert.ok(head.includes('header.addView(minimizeToggle, 1, LinearLayout.LayoutParams(dp(28), dp(28)))'));
 assert.ok(head.includes('setTextColor(Color.WHITE)'));
 assert.ok(head.includes('setStroke(dp(1), Color.rgb(105, 196, 236))'));
});
test('compact window has guaranteed extra width for x, +, brain and status',()=>{
 assert.ok(ui.includes('window.width = dp(if (minimized) 156 else 174)'));
 assert.ok(ui.includes('val params = WindowManager.LayoutParams(\n      dp(156),'));
 assert.ok(ui.includes('minimizeToggle.visibility = View.VISIBLE'));
 assert.ok(ui.includes('minimizeToggle.text = if (minimized) "+" else "−"'));
});
test('expand control reveals opt-in stake; no trading action is tied to the plus',()=>{
 const begin=ui.indexOf('minimizeToggle.setOnClickListener {');
 const end=ui.indexOf('applyCompactMode()',begin);
 assert.ok(begin>=0 && end>begin);
 const click=ui.slice(begin,end);
 assert.ok(click.includes('minimized = !minimized'));
 assert.ok(!click.includes('pressVerifiedDemoStakeOnce429'));
 assert.ok(!click.includes('autoDemoSessionRequested=true'));
 assert.ok(ui.includes('stakeAutoRow565.visibility = View.VISIBLE'));
 assert.ok(ui.includes('MIZĂ AUTO DEMO • OFF'));
 assert.ok(ui.includes('MIZĂ AUTO DEMO • ON'));
});
test('old risk and 1.09 DEMO stake guards remain in place',()=>{
 const plan=readFileSync(new URL('../native-overlay/DemoAutoStakePlan565.kt',import.meta.url),'utf8');
 assert.ok(plan.includes('PLANNED_BUDGET_CENTS = 157244L'));
 assert.ok(plan.includes('STOP_AFTER_LOSSES = 10'));
 assert.ok(plan.includes('private val LADDER = longArrayOf(109L,228L'));
 assert.ok(ui.includes('demoAutoStakePlan565.permitsFreshDemoOrder('));
 assert.ok(ui.includes('BLOCAT: START 1,09 USD NECONFIRMAT'));
});
test('APK workflow targets Motorola version 569',()=>{
 assert.ok(workflow.includes("expo['android']['versionCode']=611"));
 assert.ok(workflow.includes('ScalpAtlas-611-OVERLAY-QT-DEMO-G24.apk'));
 assert.ok(workflow.includes('node --test .github/scripts/test_569_header_always_visible.mjs'));
 assert.ok(workflow.includes('apksigner'));
});
