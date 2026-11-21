import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';

const src=readFileSync(new URL('../native-overlay/ScalpOverlayService.kt',import.meta.url),'utf8');
const plan=readFileSync(new URL('../native-overlay/DemoAutoStakePlan565.kt',import.meta.url),'utf8');
const workflow=readFileSync(new URL('../workflows/build-native-robot-safe-preflight-379.yml',import.meta.url),'utf8');
const passive=src.slice(src.indexOf('private fun inspectPassiveDemoProof463('),
  src.indexOf('private fun maybeRearmExpiredDemoPilot464('));
const active=src.slice(src.indexOf('val mgWasEnabled581='),
  src.indexOf('val unknownBaseEligible454',src.indexOf('val mgWasEnabled581=')));
const editor=src.slice(src.indexOf('private fun maybeApplyVerifiedDemoStake565('),
  src.indexOf('private fun brokerOpenTimeMatchesAttempt437('));
const early=src.slice(src.indexOf('val ledgerUpdated429 ='),
  src.indexOf('mainHandler.postDelayed({',src.indexOf('val ledgerUpdated429 =')));
const bind=plan.slice(plan.indexOf('fun rebindPendingRecoveryPair581('),
  plan.indexOf('fun permitsFreshDemoOrder('));

test('581 Martingale uses planned fixed 10-level ladder and verified payoff',()=>{
  const match=plan.match(/private val LADDER = longArrayOf\(([^)]+)\)/);
  assert.ok(match,'fixed ladder absent');
  const ladder=[...match[1].matchAll(/(\d+)L/g)].map(x=>Number(x[1]));
  assert.deepEqual(ladder,[109,228,475,992,2070,4320,9016,18816,39268,81950]);
  assert.equal(ladder.reduce((a,b)=>a+b,0),157244);
  assert.ok(plan.includes('STOP_AFTER_LOSSES = 10'));
  assert.ok(plan.includes('PAYOUT_EXACT = 92'));
  assert.ok(plan.includes('netProfitCents != -stakeCents'));
  assert.ok(plan.includes('netProfitCents !in ((stakeCents*92L)/100L)..'));
  assert.ok(plan.includes('if(nextLosses>=STOP_AFTER_LOSSES)'));
  assert.ok(plan.includes('putBoolean("riskStopped",true)'));
  assert.ok(plan.includes('edit.putInt("losses",0).putLong("cumulativeLoss",0L)'));
  assert.ok(plan.includes('if(positionId in ids)return "DUPLICAT CLOSED'));
});

test('581 passive exact CLOSED 2/2 + 0 OPEN 2/2 persists MG BEFORE clearing attempt',()=>{
  for(const proof of [
    'val closed = verifiedClosedDetail437',
    'freshOcr','selectedOpen','demoEmptyReviewReads',
    'closed.pair != expectedPair','closed.stakeCents != stake',
    'closed.payoutPercent != payout','brokerOpenTimeMatchesAttempt437',
    'demoRecoveryLedger.alreadySettledClosedReceipt444',
    'val gateReady = when (tradePositionGate.state())',
    'demoAutoStakePlan565.onVerifiedClosed(',
    'martingaleResultDurable581(nextStakeStatus565)',
  ])assert.ok(passive.includes(proof),proof);
  const settle=passive.indexOf('demoAutoStakePlan565.onVerifiedClosed(');
  const clear=passive.indexOf('val cleared = prefs.edit().putBoolean("attempted", false)');
  assert.ok(settle>0 && clear>settle);
  assert.ok(passive.includes('MIZĂ MG NESALVATE • ORDIN RĂMÂNE BLOCAT'));
  assert.ok(passive.includes('!martingaleActive581'));
  assert.ok(passive.includes('autoDemoSessionConsumed = !canRearmBase'));
});

test('581 active broker CLOSED + zero-OPEN reconciles and advances MG exactly once',()=>{
  const settle=active.indexOf('demoAutoStakePlan565.onVerifiedClosed(');
  const clear=active.indexOf('putBoolean("attempted", false)');
  assert.ok(settle>0 && clear>settle);
  assert.ok(active.includes('reconciled437 && matchingAttempt437'));
  assert.ok(active.includes('martingaleResultDurable581(mgOutcome581)'));
  assert.ok(active.includes('val savedReconciled437 = reconciled437 && mgSaved581'));
  assert.ok(active.includes('mgWasEnabled581'));
  const review=src.slice(src.indexOf('val ocrCurrent ='),src.indexOf('val mgWasEnabled581='));
  assert.ok(review.includes('demoEmptyReviewReads >= 2'));
  assert.ok(review.includes('verifiedClosedDetail437'));
  assert.ok(review.includes('closedProof437.positionId'));
  assert.ok(review.includes('closedProof437.stakeCents == expectedStake429'));
  assert.ok(review.includes('brokerOpenTimeMatchesAttempt437'));
});

test('581 no MG order rearm directly on settlement, no inferred LOSS from empty OPEN',()=>{
  assert.ok(src.includes('!mgWasEnabled581 && !demoAutoStakePlan565.isEnabled()'));
  assert.ok(src.includes('val normalRearm581 = !pendingReceipt429 &&'));
  assert.ok(src.includes('val unknownBaseEligible454 = !savedReconciled437 &&'));
  assert.ok(src.includes('!demoAutoStakePlan565.isEnabled() &&\n                  !demoAutoStakePlan565.isRiskStopped()'));
  assert.ok(early.includes('AȘTEPT 0 DESCHISE 2/2 • MG ÎN PAUZĂ'));
  assert.ok(early.includes('autoDemoSessionRequested = false'));
  assert.ok(early.indexOf('demoAutoStakePlan565.isEnabled()') <
    early.indexOf('val cleared429 = pendingPrefs429.edit()'));
  assert.ok(src.includes('martingaleResultDurable581(status:String?)'));
  const fn=src.slice(src.indexOf('private fun martingaleResultDurable581('),
    src.indexOf('private fun inspectPassiveDemoProof463('));
  assert.ok(fn.includes('status.startsWith("DUPLICAT CLOSED")'));
  assert.ok(fn.includes('demoAutoStakePlan565.isRiskStopped()'));
});

test('581 dynamic MG stake can follow independently verified 92% pair but never change risk ladder',()=>{
  for(const gate of [
    '!isEnabled()','isRiskStopped()','accountKey!=prefs.getString("accountKey",null)',
    'losses !in 1 until STOP_AFTER_LOSSES',
    'prefs.getLong("pendingStake",-1L)!=expected',
    'spent+expected>PLANNED_BUDGET_CENTS',
    '.putString("pair",newPair)'
  ])assert.ok(bind.includes(gate),gate);
  assert.ok(!bind.includes('putInt("losses"'));
  assert.ok(!bind.includes('putLong("confirmedStake"'));
  assert.ok(!bind.includes('putLong("pendingStake"'));
  assert.ok(!bind.includes('pressVerified'));
  assert.ok(editor.includes('TouchTestService.readVisibleDemoPair()!=pair'));
  assert.ok(editor.includes('TouchTestService.readVerifiedDemoPayoutForPair(pair)!=92'));
  assert.ok(editor.includes('demoAutoStakePlan565.rebindPendingRecoveryPair581(key,pair)'));
  assert.ok(editor.includes('TouchTestService.setVerifiedDemoRecoveryStakeOnBroker(pair,amount)'));
  assert.ok(editor.includes('TouchTestService.verifiedExactDemoStakeReadOnly577(pair,amount)'));
  assert.ok(editor.includes('demoAutoStakePlan565.confirmEdited(key,pair,amount,true)'));
  assert.ok(editor.includes('demoAutoStakePlan565.permitsFreshDemoOrder(key,pair,amount)'));
  assert.ok(editor.includes('autoDemoEntryCycleStartedAt=System.currentTimeMillis()'));
});

test('581 one-position and broker receipt constraints remain',()=>{
  assert.ok(src.includes('tradePositionGate.beginAttempt()'));
  assert.ok(src.includes('TouchTestService.inspectBrokerDemoOrder488('));
  assert.ok(src.includes('getBoolean("attempted", false)'));
  assert.ok(src.includes('!realAccountSafetyStop517'));
  assert.ok(src.includes('if (CHART_ONLY_DEMO_462 && stake429 != 100L)'));
  assert.ok(src.includes('TouchTestService.pressVerifiedDemoStakeOnce429('));
  assert.ok(src.includes('pendingReceipt429'));
  assert.ok(src.includes('!pendingStakeOptIn571'));
  assert.ok(plan.includes('if(!isEnabled() || isRiskStopped() ||'));
});

test('581 signed G24 release runs 581 MG regression',()=>{
  assert.ok(workflow.includes("expo['android']['versionCode']=583"));
  assert.ok(workflow.includes('ScalpAtlas-583-BASE-REARM-DEMO-G24.apk'));
  assert.ok(workflow.includes('node --test .github/scripts/test_581_martingale_settlement.mjs'));
  assert.ok(workflow.includes('apksigner'));
});