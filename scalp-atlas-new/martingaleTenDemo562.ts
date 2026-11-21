/**
 * Scalp Atlas 562 — TEN-LEVEL Martingale risk SIMULATOR, QT DEMO ONLY.
 *
 * A WIN at any level would recover all previous losses in that sequence
 * and achieve a minimum net +$1.00 at a constant, exact 92% payout.
 * Ten losses = -$1,572.44. This is NOT a profitable-trade guarantee.
 *
 * Pure read-only math: no broker connection, stake edit, order dispatch,
 * Accessibility gesture, Bluetooth action, or override of 561 risk pauses.
 */
export type MartingaleLevel562 = {
  attempt: number;
  stakeCents: number;
  earlierLossesCents: number;
  totalLossesIfThisFailsCents: number;
  netProfitIfThisWinsCents: number;
};
export type MartingaleBalanceSnapshot562 = {
  /** Broker account exactly as verified; user-entered balances are NOT broker proof. */
  account: 'DEMO' | 'REAL';
  balanceCents: number;
  payoutPercent: number;
  verifiedAtMs: number;
  source: 'BROKER_READ_ONLY_VERIFIED' | 'USER_ENTERED';
};
export type MartingaleReview562 = {
  mode: 'SIMULATION_ONLY';
  levels: MartingaleLevel562[];
  targetNetProfitCents: number;
  requiredBalanceCents: number;
  maxLossAllTenCents: number;
  maxAffordableLevels: number;
  availableBalanceCents: number | null;
  shortfallCents: number | null;
  balanceStatus: 'NO_VERIFIED_BALANCE' | 'INVALID_OR_STALE' | 'INSUFFICIENT' | 'ENOUGH_FOR_TEN';
  /** Always FALSE: reviewing a plan never authorizes a real or DEMO trade. */
  mayPlaceBrokerOrder: false;
  riskWarning: string;
};
export const MARTINGALE_LEVELS_562 = 10;
export const MARTINGALE_PAYOUT_562 = 92;
export const MARTINGALE_TARGET_CENTS_562 = 100;
export const BALANCE_MAX_AGE_MS_562 = 15_000;

function isCents(v:number):boolean {return Number.isSafeInteger(v)&&v>=0;}
function ceilDivPositive(n:number,d:number):number {return Math.floor((n+d-1)/d);}

/** Constant payout, integer-cent arithmetic; does not change broker stake. */
export function buildMartingaleLadder562():MartingaleLevel562[] {
  const arr:MartingaleLevel562[]=[];
  let losses=0;
  for(let step=1;step<=MARTINGALE_LEVELS_562;step++){
    // Stake*0.92 >= $1.00 + accumulated prior losses.
    const stake=ceilDivPositive((losses+MARTINGALE_TARGET_CENTS_562)*100,MARTINGALE_PAYOUT_562);
    const netIfWin=Math.floor(stake*MARTINGALE_PAYOUT_562/100)-losses;
    losses+=stake;
    arr.push({
      attempt:step,stakeCents:stake,earlierLossesCents:losses-stake,
      totalLossesIfThisFailsCents:losses,netProfitIfThisWinsCents:netIfWin
    });
  }
  return arr;
}
export function reviewMartingaleTenDemo562(
  nowMs:number,
  balance:MartingaleBalanceSnapshot562 | null,
):MartingaleReview562 {
  const levels=buildMartingaleLadder562();
  const requiredBalanceCents=levels[levels.length-1].totalLossesIfThisFailsCents;
  const base={
    mode:'SIMULATION_ONLY' as const, levels,
    targetNetProfitCents:MARTINGALE_TARGET_CENTS_562,
    requiredBalanceCents,
    maxLossAllTenCents:requiredBalanceCents,
    maxAffordableLevels:0,availableBalanceCents:null as number|null,
    shortfallCents:null as number|null,
    balanceStatus:'NO_VERIFIED_BALANCE' as MartingaleReview562['balanceStatus'],
    mayPlaceBrokerOrder:false as const,
    riskWarning:'10 pierderi consecutive înseamnă pierderea integrală a fondurilor alocate; niciun profit nu este garantat.',
  };
  if(!balance) return base;
  if (!Number.isSafeInteger(nowMs)||!isCents(balance.balanceCents) ||
      balance.account!=='DEMO' || balance.source!=='BROKER_READ_ONLY_VERIFIED' ||
      balance.payoutPercent!==MARTINGALE_PAYOUT_562 ||
      !Number.isSafeInteger(balance.verifiedAtMs) ||
      nowMs<balance.verifiedAtMs ||
      nowMs-balance.verifiedAtMs>BALANCE_MAX_AGE_MS_562)
    return {...base,balanceStatus:'INVALID_OR_STALE'};
  const available=balance.balanceCents;
  const affordable=levels.filter(l=>l.totalLossesIfThisFailsCents<=available).length;
  return {...base,availableBalanceCents:available,maxAffordableLevels:affordable,
    shortfallCents:Math.max(0,requiredBalanceCents-available),
    balanceStatus:available>=requiredBalanceCents?'ENOUGH_FOR_TEN':'INSUFFICIENT'
  };
}

export type DemoSeriesOutcome562 = 'WIN' | 'LOSS' | 'DRAW';
export type MartingaleSeriesProgress562 = {
  state:'UNSETTLED'|'ONGOING'|'TARGET_REACHED'|'FAILED_TEN_LOSSES'|'INVALID';
  attempted: number;
  netCents: number;
  nextStakeCents: number | null;
  reason:string;
  simulatorOnly:true;
};
/**
 * Simulate already-settled attempts. DRAW is a returned stake and repeats
 * the same level; a WIN finishes the entire sequence, not an individual
 * guarantee. Each result needs broker confirmation outside this module.
 */
export function simulateMartingaleSeries562(outcomes:DemoSeriesOutcome562[]):MartingaleSeriesProgress562 {
  const invalid=(reason:string):MartingaleSeriesProgress562=>({
    state:'INVALID',attempted:0,netCents:0,nextStakeCents:null,reason,simulatorOnly:true
  });
  if(!Array.isArray(outcomes)||outcomes.length>10 ||
     outcomes.some(v=>!['WIN','LOSS','DRAW'].includes(v)))return invalid('Secvență invalidă sau peste 10 încercări');
  const levels=buildMartingaleLadder562();
  let net=0,losses=0;
  for(let i=0;i<outcomes.length;i++){
    const outcome=outcomes[i];
    const current=levels[losses];
    if(!current) return invalid('S-au depășit zece pierderi');
    if(outcome==='LOSS') {net-=current.stakeCents;losses++;}
    if(outcome==='WIN') {
      net+=Math.floor(current.stakeCents*MARTINGALE_PAYOUT_562/100);
      if(i!==outcomes.length-1)return invalid('Nu se continuă după un WIN; seria se resetează');
      return {state:'TARGET_REACHED',attempted:outcomes.length,netCents:net,nextStakeCents:null,
        reason:'WIN încheie seria; profitul este pe serie, nu pe fiecare trade',
        simulatorOnly:true};
    }
    if(losses===10) {
      if(i!==outcomes.length-1)return invalid('Seria trebuie oprită după 10 pierderi');
      return {state:'FAILED_TEN_LOSSES',attempted:outcomes.length,netCents:net,nextStakeCents:null,
        reason:'Fondurile întregii serii au fost pierdute',simulatorOnly:true};
    }
  }
  return {state:outcomes.length?'ONGOING':'UNSETTLED',attempted:outcomes.length,
    netCents:net,nextStakeCents:levels[losses].stakeCents,
    reason:'Numai simulare; nu autorizează plasarea automată a următorului ordin',
    simulatorOnly:true};
}
