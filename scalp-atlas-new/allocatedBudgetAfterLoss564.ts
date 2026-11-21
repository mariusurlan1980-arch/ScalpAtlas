/**
 * Scalp Atlas 564: planned DEMO budget of $1,570.44 and next Martingale quote.
 *
 * Read-only planning; USER_PLANNED amount is never treated as a broker balance.
 * The existing Android editor and order executor are NOT connected here.
 */
import {
  buildMartingaleLadder562,
  MARTINGALE_PAYOUT_562,
  MARTINGALE_TARGET_CENTS_562,
  type MartingaleLevel562,
} from './martingaleTenDemo562.ts';

export const USER_PLANNED_DEMO_BUDGET_CENTS_564 = 157044;
export const BROKER_EDITOR_MAX_STAKE_CENTS_564 = 3964;
export const RISK_PAUSE_AFTER_LOSSES_564 = 3;

export type NextDemoStakeDecision564 = {
  state:
    | 'FIRST_STAKE'
    | 'NEXT_AFTER_CONFIRMED_LOSS'
    | 'PAUSED_RISK'
    | 'NO_PROOF'
    | 'BUDGET_INSUFFICIENT'
    | 'ANDROID_STAKE_LIMIT';
  level: number | null;
  nextStakeCents: number | null;
  projectedCumulativeLossCents: number;
  budgetRemainingAfterLossesCents: number;
  shortageCents: number;
  accountBalanceVerified: false;
  mayChangeBrokerAmount: false;
  mayPlaceBrokerOrder: false;
  reason: string;
};

export type PlanningInputs564 = {
  /** Number of consecutive uniquely verified LOSS receipts in the series. */
  verifiedLosses: number;
  /** All receipts from a matching QT DEMO position, not a timer or BIP. */
  closedLossReceiptsVerified: boolean;
  /** The user can set a risk budget, but this is NOT the broker balance. */
  allocatedDemoBudgetCents: number;
  /** Existing risk policy; never remove or silently bypass it. */
  riskPauseActive: boolean;
};

const ladder:MartingaleLevel562[] = buildMartingaleLadder562();
function decision(
  state:NextDemoStakeDecision564['state'],
  level:number|null,
  nextStakeCents:number|null,
  lost:number,
  budget:number,
  reason:string,
):NextDemoStakeDecision564 {
  const cumulativeIfLoses=lost+(nextStakeCents??0);
  return {
    state,level,nextStakeCents,
    projectedCumulativeLossCents:cumulativeIfLoses,
    budgetRemainingAfterLossesCents:Math.max(0,budget-lost),
    shortageCents:Math.max(0,cumulativeIfLoses-budget),
    accountBalanceVerified:false,mayChangeBrokerAmount:false,mayPlaceBrokerOrder:false,
    reason,
  };
}

/**
 * Proposes an amount only. A separate broker-bound proof gate must read
 * actual QT DEMO balance, payout 92%, correct pair, unique CLOSED LOSS
 * receipt, no open position, and the editor's exact read-back BEFORE editing.
 */
export function planStakeAfterDemoLoss564(input:PlanningInputs564):NextDemoStakeDecision564 {
  if(!input || !Number.isSafeInteger(input.allocatedDemoBudgetCents) ||
    input.allocatedDemoBudgetCents<0 ||
    !Number.isSafeInteger(input.verifiedLosses) ||
    input.verifiedLosses<0 || input.verifiedLosses>10)
    return decision('NO_PROOF',null,null,0,0,'Parametri de risc invalizi');
  const budget=input.allocatedDemoBudgetCents;
  const losses=input.verifiedLosses;
  const lost=losses?ladder[losses-1].totalLossesIfThisFailsCents:0;
  if(input.riskPauseActive || losses>=RISK_PAUSE_AFTER_LOSSES_564)
    return decision('PAUSED_RISK',null,null,lost,budget,'STOP după 3 LOSS; limita existentă rămâne activă');
  if(losses>0 && !input.closedLossReceiptsVerified)
    return decision('NO_PROOF',null,null,lost,budget,'Lipsește dovada verificată a LOSS și a ordinului închis');
  if(losses===10)
    return decision('PAUSED_RISK',null,null,lost,budget,'Zece LOSS: serie oprită');
  const level=ladder[losses];
  if(level.totalLossesIfThisFailsCents>budget)
    return decision('BUDGET_INSUFFICIENT',level.attempt,level.stakeCents,lost,budget,
      'Soldul planificat nu acoperă întreaga miză necesară');
  if(level.stakeCents>BROKER_EDITOR_MAX_STAKE_CENTS_564)
    return decision('ANDROID_STAKE_LIMIT',level.attempt,level.stakeCents,lost,budget,
      'Editorul brokerului este limitat la 39,64 USD în versiunea actuală');
  return decision(losses===0?'FIRST_STAKE':'NEXT_AFTER_CONFIRMED_LOSS',
    level.attempt,level.stakeCents,lost,budget,
    losses===0?'Miză inițială propusă, fără modificare automată':
      'Miză după LOSS confirmat, numai propunere până la validarea brokerului');
}

export type DemoBudgetComparison564 = {
  plannedBudgetCents:number;
  fullTenLevelsCents:number;
  differenceCents:number;
  fullyCoveredLevels:number;
  afterNineLossesCents:number;
  tenthRequiredStakeCents:number;
  remainingForTenthCents:number;
  cannotGuaranteeOneDollarOnTenth:boolean;
};

export function comparePlannedBudget564(
  plannedBudgetCents:number=USER_PLANNED_DEMO_BUDGET_CENTS_564
):DemoBudgetComparison564 {
  if(!Number.isSafeInteger(plannedBudgetCents)||plannedBudgetCents<0)
    throw new RangeError('Buget în cenți invalid');
  const total=ladder[9].totalLossesIfThisFailsCents;
  const afterNine=ladder[8].totalLossesIfThisFailsCents;
  return {
    plannedBudgetCents,fullTenLevelsCents:total,differenceCents:total-plannedBudgetCents,
    fullyCoveredLevels:ladder.filter(x=>x.totalLossesIfThisFailsCents<=plannedBudgetCents).length,
    afterNineLossesCents:afterNine,tenthRequiredStakeCents:ladder[9].stakeCents,
    remainingForTenthCents:Math.max(0,plannedBudgetCents-afterNine),
    cannotGuaranteeOneDollarOnTenth:plannedBudgetCents<total,
  };
}
export const DEMO_PAYOUT_564=MARTINGALE_PAYOUT_562;
export const TARGET_PER_WINNING_SERIES_CENTS_564=MARTINGALE_TARGET_CENTS_562;
