import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const service=readFileSync(new URL('../native-overlay/ScalpOverlayService.kt',import.meta.url),'utf8');
const workflow=readFileSync(new URL('../workflows/build-native-robot-safe-preflight-379.yml',import.meta.url),'utf8');
const start=service.indexOf('private fun demoOrderVerificationStatus(): String');
const end=service.indexOf('private fun startBrokerAccountMonitor()',start);
const status=service.slice(start,end);
const verify=service.slice(service.indexOf('fun verifyChart(pair: String, checks: Int)'),
  service.indexOf('fun dwell(pair: String, deadline: Long, retries: Int)'));

test('578 never says generic VERIFIC ORDINUL for a real blocked trade gate',()=>{
 assert.ok(!status.includes('ARMAT · VERIFIC ORDINUL'));
 for(const code of [
   'previousShock578 || previousSell578',
   'TradePositionGate.State.OPEN',
   'TradePositionGate.State.SUBMITTING',
   'TradePositionGate.State.UNKNOWN',
   'demoAutoStakePlan565.isRiskStopped()',
   '!demoAutoStakePlan565.isEnabled()',
   'autoDemoSessionConsumed && stakeStatus578.contains("AȘTEAPTĂ CONFIRMARE")',
   'autoDemoSessionConsumed',
   '!autoDemoSessionRequested',
   '!autoDemoArmed'
 ]) assert.ok(status.includes(code),code);
 assert.ok(status.includes('demoOrderVerificationReason'));
 assert.ok(status.includes('autoDemoLastPreflightReason'));
 assert.ok(status.includes('BLOCAT • ORDIN ANTERIOR FĂRĂ ÎNCHIDERE CONFIRMATĂ'));
 assert.ok(status.includes('BLOCAT • STARE POZIȚIE NECUNOSCUTĂ'));
});

test('578 status function never modifies risk, trade flags or broker',()=>{
 for(const forbidden of [
   'putBoolean(','beginAttempt(','pressVerifiedDemo',
   'dispatchGesture(','brokerConfirmedClosed(',
   'brokerVerifiedEmptyDemoReview(','rebindVerifiedBasePair(',
   'autoDemoSessionRequested=true','autoDemoSessionConsumed=false'
 ]) assert.ok(!status.includes(forbidden),forbidden);
});

test('578 show requested versus visible instrument while rotation is still verifying',()=>{
 assert.ok(verify.includes('if (chartPair548 != pair) {'));
 assert.ok(verify.includes('fxButton.text = pair.removeSuffix(" OTC").take(8) + " ≠ " +'));
 assert.ok(verify.includes('chartPair548?.removeSuffix(" OTC")?.take(8) ?: "?"'));
 assert.ok(verify.includes('recoverNavigation(pair, "PERECHE NECONFIRMATĂ")'));
 assert.ok(verify.includes('TouchTestService.readFxChartPayout(pair, realAccount)'));
});

test('578 preserves independent position and broker validators',()=>{
 assert.ok(service.includes('tradePositionGate.state() == TradePositionGate.State.READY'));
 assert.ok(service.includes('demoAutoStakePlan565.permitsFreshDemoOrder('));
 assert.ok(service.includes('TouchTestService.readBrokerDemoOrder476(tradePair429)'));
 assert.ok(service.includes('TouchTestService.inspectBrokerDemoOrder488(tradePair429, currentOverlayBounds488())'));
 const proof=service.slice(service.indexOf('private fun inspectPassiveDemoProof463('),
   service.indexOf('private fun maybeRearmExpiredDemoPilot464('));
 assert.ok(proof.includes('val closed = verifiedClosedDetail437'));
 assert.ok(proof.includes('LIPSEȘTE ID ÎNCHIS'));
 assert.ok(proof.includes('!brokerOpenTimeMatchesAttempt437(closed.openedSecondsOfDay, attemptedAt)'));
});

test('578 android APK workflow retains signed release and regression',()=>{
 assert.ok(workflow.includes("expo['android']['versionCode']=586"));
 assert.ok(workflow.includes('ScalpAtlas-586-QUOTE-DIAG-G24.apk'));
 assert.ok(workflow.includes('node --test .github/scripts/test_578_order_gate_diagnostics.mjs'));
 assert.ok(workflow.includes('apksigner'));
});
