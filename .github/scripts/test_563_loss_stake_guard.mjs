import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
const kotlin=readFileSync(new URL('../native-overlay/DemoLossStakeEditor563.kt',import.meta.url),'utf8');
const editor=readFileSync(new URL('../native-overlay/DemoStakeEditor.kt',import.meta.url),'utf8');
const overlay=readFileSync(new URL('../native-overlay/ScalpOverlayService.kt',import.meta.url),'utf8');
const values=kotlin.match(/private val theoreticalStakeCents = longArrayOf\(([\s\S]*?)\)/)?.[1];
assert.ok(values,'562 stake schedule absent from Kotlin');
const ladder=[...values.matchAll(/(\d+)L/g)].map(m=>Number(m[1]));
const losses=[109,337,812,1804,3874,8194,17210,36026,75294,157244];
test('same theoretical ten-level schedule as calculator 562',()=>{
 assert.deepEqual(ladder,[109,228,475,992,2070,4320,9016,18816,39268,81950]);
 assert.deepEqual(ladder.reduce((a,x)=>{a.push((a.at(-1)||0)+x);return a;},[]),losses);
});
test('exact 92 percent payout yields a dollar net after any WIN',()=>{
 ladder.forEach((stake,i)=>{
  const earlier=i?losses[i-1]:0;
  assert.ok(Math.floor(stake*.92)-earlier>=100);
 });
});
test('no automatic ten-level live trading; the native editor has a $39.64 ceiling',()=>{
 assert.match(kotlin,/MAX_STAKE_CENTS_SAFE = 3964L/);
 assert.match(editor,/stakeCents !in 100L\.\.3964L/);
 assert.ok(ladder[5]>3964);
});
test('real account and unverifiable proof conditions remain blocked in native source',()=>{
 for(const token of ['QT_DEMO:','openedProofVerified','closedProofReadTwice',
  'zeroOpenReadTwice','riskPause561','MAX_PROOF_AGE_MS','payoutPercent != 92',
  'r.netCents != -r.stakeCents','r.expiryMinutes != 5'])
  assert.ok(kotlin.includes(token),`guard missing ${token}`);
});
test('three consecutive verified losses are blocked by the 561 risk stop',()=>{
 assert.match(kotlin,/MAX_LOSSES_BEFORE_RISK_STOP = 3/);
 assert.match(kotlin,/losses\.size >= MAX_LOSSES_BEFORE_RISK_STOP/);
});
test('the new helper edits a DEMO amount only, never BUY/SELL',()=>{
 assert.match(kotlin,/DemoStakeEditor\.setExactDemoStake\(svc/);
 assert.doesNotMatch(kotlin,/pressVerifiedDemoStakeOnce429|pressAutoOneDollarDemoOrderOnce|dispatchGesture/);
});
test('editor verifies account header, payout, field and balance again',()=>{
 for(const token of ['hasDemoExecutor','QT\\s*Demo','QT\\s*Real',
  'ACTION_SET_TEXT','buyPayout != 92','SOLD DEMO INSUFICIENT',
  'SUMĂ QT DEMO CONFIRMATĂ'])
  assert.ok(editor.includes(token),`broker guard missing: ${token}`);
});
test('current installed CHART ONLY flow does not auto-escalate stake',()=>{
 assert.ok(overlay.includes('private const val CHART_ONLY_DEMO_462 = true'));
 assert.ok(overlay.includes('if (!CHART_ONLY_DEMO_462)'));
 assert.ok(!overlay.includes('DemoLossStakeEditor563.editAfterVerifiedLossOnly('));
});
