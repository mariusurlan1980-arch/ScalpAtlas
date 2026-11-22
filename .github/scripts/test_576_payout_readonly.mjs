import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';

const editor=readFileSync(new URL('../native-overlay/DemoStakeEditor.kt',import.meta.url),'utf8');
const touch=readFileSync(new URL('../native-overlay/TouchTestService.kt',import.meta.url),'utf8');
const overlay=readFileSync(new URL('../native-overlay/ScalpOverlayService.kt',import.meta.url),'utf8');
const workflow=readFileSync(new URL('../workflows/build-native-robot-safe-preflight-379.yml',import.meta.url),'utf8');
const payoutStart=editor.indexOf('fun verifiedDemoPayoutReadOnly(');
const payoutEnd=editor.indexOf('fun verifiedExactDemoStakeReadOnly(',payoutStart);
const payout=editor.slice(payoutStart,payoutEnd);
const optIn=overlay.slice(overlay.indexOf('private fun maybeFinishStakeOptIn571('),overlay.indexOf('private fun maybeApplyVerifiedDemoStake565('));

test('576 reads QT Demo payout without requiring balance or editable stake',()=>{
  assert.ok(payout.includes('readChart(svc)'));
  assert.ok(payout.includes('readChartPayout(chart)'));
  assert.ok(payout.includes('payout != 92'));
  assert.ok(payout.includes('svc.rootInActiveWindow?.packageName?.toString() != chart.pkg'));
  assert.ok(!payout.includes('inspect(svc)'));
  assert.ok(!payout.includes('ACTION_SET_TEXT'));
  assert.ok(!payout.includes('performAction('));
});

test('576 still requires independent displayed BUY and SELL 92%, QT Demo not Real',()=>{
  const chart=editor.slice(editor.indexOf('private fun readChart('),editor.indexOf('private fun inspect('));
  assert.ok(chart.includes('Regex("""(?i)\\bQT\\s*Demo\\b""")'));
  assert.ok(chart.includes('Regex("""(?i)\\bQT\\s*Real\\b""")'));
  assert.ok(chart.includes('!demo || real'));
  assert.ok(chart.includes('actionLabels.any { it.rect.centerX() < w * .49f }'));
  assert.ok(chart.includes('actionLabels.any { it.rect.centerX() > w * .51f }'));
  assert.ok(chart.includes('buyPayout == null || buyPayout != sellPayout'));
  assert.ok(touch.includes('if (readVisibleDemoPair() != expectedPair) return null'));
  assert.ok(touch.includes('DemoStakeEditor.verifiedDemoPayoutReadOnly(svc)'));
});

test('576 read-only panel relocation happens BEFORE payout and never authorizes ON blindly',()=>{
  const relocation=optIn.indexOf('if (liftOverlayOffDemoOrderButtons557())');
  const read=optIn.indexOf('if (TouchTestService.readVerifiedDemoPayoutForPair(pair) != 92)');
  const actualEnable=optIn.indexOf('demoAutoStakePlan565.enableFromVerifiedDemo("QT_DEMO:" + pkg, pair)');
  assert.ok(relocation>0 && read>relocation && actualEnable>read);
  assert.ok(optIn.includes('stakeOptInReason572 = "576 • PANOU MUTAT DE PE BUY/SELL • REVERIFIC"'));
  assert.ok(optIn.includes('stakeOptInReason572 = "576 • PAYOUT BUY/SELL 92% NECITIT"'));
  assert.ok(optIn.includes('return\n    }\n    if (TouchTestService.readVerifiedDemoPayoutForPair'));
  assert.ok(optIn.includes('demoAutoStakePlan565.isRiskStopped()'));
  assert.ok(optIn.includes('tradePositionGate.state() != TradePositionGate.State.READY'));
  assert.ok(!optIn.includes('pressVerifiedDemoSell'));
  assert.ok(!optIn.includes('dispatchGesture('));
  assert.ok(overlay.includes('demoAutoStakePlan565.permitsFreshDemoOrder('));
});

test('576 keeps strict stake editing even with a separate payout-only read',()=>{
  const inspect=editor.slice(editor.indexOf('private fun inspect('),editor.indexOf('fun verifiedDemoPayoutReadOnly('));
  assert.ok(inspect.includes('CÂMP SUMĂ EDITABIL NEIDENTIFICAT'));
  assert.ok(inspect.includes('BLOCAT: SOLD QT DEMO NECONFIRMAT'));
  assert.ok(inspect.includes('if (buyPayout != 92)'));
  const exact=editor.slice(editor.indexOf('fun verifiedExactDemoStakeReadOnly('));
  assert.ok(exact.includes('inspect(svc)'));
  assert.ok(exact.includes('screen.payout == 92'));
  const auto=overlay.slice(overlay.indexOf('private fun maybeApplyVerifiedDemoStake565('),overlay.indexOf('private fun brokerOpenTimeMatchesAttempt437('));
  assert.ok(auto.includes('TouchTestService.setVerifiedDemoRecoveryStakeOnBroker(pair,amount)'));
});

test('576 signed Android build includes strict payout regression checks',()=>{
  assert.ok(workflow.includes("expo['android']['versionCode']=589"));
  assert.ok(workflow.includes('node --test .github/scripts/test_576_payout_readonly.mjs'));
  assert.ok(workflow.includes('ScalpAtlas-589-AUTO-HISTORY-G24.apk'));
  assert.ok(workflow.includes('apksigner'));
});
