import assert from 'node:assert/strict';
import test from 'node:test';
import {
 USER_PLANNED_DEMO_BUDGET_CENTS_564,
 BROKER_EDITOR_MAX_STAKE_CENTS_564,
 planStakeAfterDemoLoss564,
 comparePlannedBudget564,
} from './allocatedBudgetAfterLoss564.ts';
const cfg=(verifiedLosses,extra={})=>({
 verifiedLosses,closedLossReceiptsVerified:true,
 allocatedDemoBudgetCents:USER_PLANNED_DEMO_BUDGET_CENTS_564,riskPauseActive:false,
 ...extra
});
test('the user-planned $1570.44 is exactly $2.00 short for 10 levels',()=>{
 const s=comparePlannedBudget564();
 assert.equal(s.plannedBudgetCents,157044);
 assert.equal(s.fullTenLevelsCents,157244);
 assert.equal(s.differenceCents,200);
 assert.equal(s.fullyCoveredLevels,9);
});
test('after 9 losses only $817.50 remains, but the tenth stake needs $819.50',()=>{
 const s=comparePlannedBudget564();
 assert.equal(s.afterNineLossesCents,75294);
 assert.equal(s.remainingForTenthCents,81750);
 assert.equal(s.tenthRequiredStakeCents,81950);
 assert.equal(s.cannotGuaranteeOneDollarOnTenth,true);
});
test('a full budget $1572.44 covers all ten math levels',()=>{
 const s=comparePlannedBudget564(157244);
 assert.equal(s.fullyCoveredLevels,10);
 assert.equal(s.differenceCents,0);
});
test('initial quote $1.09 is not broker order or verified balance',()=>{
 const s=planStakeAfterDemoLoss564(cfg(0));
 assert.equal(s.state,'FIRST_STAKE');
 assert.equal(s.nextStakeCents,109);
 assert.equal(s.mayChangeBrokerAmount,false);
 assert.equal(s.mayPlaceBrokerOrder,false);
 assert.equal(s.accountBalanceVerified,false);
});
test('after one independently confirmed $1.09 LOSS next proposed stake $2.28',()=>{
 const s=planStakeAfterDemoLoss564(cfg(1));
 assert.equal(s.state,'NEXT_AFTER_CONFIRMED_LOSS');
 assert.equal(s.nextStakeCents,228);
 assert.equal(s.budgetRemainingAfterLossesCents,156935);
});
test('after two independently confirmed losses next stake $4.75',()=>{
 const s=planStakeAfterDemoLoss564(cfg(2));
 assert.equal(s.nextStakeCents,475);
 assert.equal(s.projectedCumulativeLossCents,812);
});
test('no verified loss receipt means absolutely no stake change',()=>{
 const s=planStakeAfterDemoLoss564(cfg(1,{closedLossReceiptsVerified:false}));
 assert.equal(s.state,'NO_PROOF');
 assert.equal(s.nextStakeCents,null);
});
test('the earlier three LOSS safety pause remains in force',()=>{
 const s=planStakeAfterDemoLoss564(cfg(3));
 assert.equal(s.state,'PAUSED_RISK');
 assert.equal(s.nextStakeCents,null);
});
test('explicit risk pause blocks even after only one loss',()=>{
 const s=planStakeAfterDemoLoss564(cfg(1,{riskPauseActive:true}));
 assert.equal(s.state,'PAUSED_RISK');
});
test('insufficient planned budget blocks even the first quote',()=>{
 const s=planStakeAfterDemoLoss564(cfg(0,{allocatedDemoBudgetCents:100}));
 assert.equal(s.state,'BUDGET_INSUFFICIENT');
 assert.equal(s.shortageCents,9);
 assert.equal(s.mayChangeBrokerAmount,false);
});
test('the existing Android editor cap is below levels 6 to 10',()=>{
 assert.equal(BROKER_EDITOR_MAX_STAKE_CENTS_564,3964);
 assert.ok(comparePlannedBudget564().tenthRequiredStakeCents > BROKER_EDITOR_MAX_STAKE_CENTS_564);
});
test('invalid budgets, losses or missing input fail closed',()=>{
 assert.equal(planStakeAfterDemoLoss564(cfg(-1)).state,'NO_PROOF');
 assert.equal(planStakeAfterDemoLoss564(cfg(11)).state,'NO_PROOF');
 assert.equal(planStakeAfterDemoLoss564(cfg(0,{allocatedDemoBudgetCents:-1})).state,'NO_PROOF');
});
test('no profit guarantee regardless of planning budget',()=>{
 const s=planStakeAfterDemoLoss564(cfg(1));
 assert.equal(s.mayPlaceBrokerOrder,false);
 assert.equal(s.accountBalanceVerified,false);
});
