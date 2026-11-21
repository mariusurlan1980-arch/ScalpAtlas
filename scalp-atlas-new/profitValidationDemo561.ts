/**
 * Scalp Atlas 561: DEMO-only performance validator for the 560 min/max strategy.
 * Read-only ledger: never dispatches orders, presses BUY/SELL, changes a broker
 * stake, triggers Martingale, or treats a BIP/screenshot as settlement evidence.
 */
export type Outcome561 = 'WIN' | 'LOSS' | 'DRAW';
export type DemoReceipt561 = {
  orderId: string;
  account: 'DEMO' | 'REAL';
  strategy: 'MINMAX_560' | string;
  pair: string;
  openedAtMs: number;
  closedAtMs: number;
  expiryMinutes: number;
  stakeCents: number;
  payoutPercent: number;
  outcome: Outcome561;
  netCents: number;
  /** Must be verified against broker's explicit CLOSED order receipt. */
  brokerClosedReceiptVerified: boolean;
};
export type DemoProfitSummary561 = {
  state: 'NECONFIRMAT' | 'TEST_IN_CURS' | 'REZULTAT_POZITIV' | 'REZULTAT_NEGATIV' | 'PAUZA_RISC';
  reason: string;
  count: number;
  wins: number;
  losses: number;
  draws: number;
  netCents: number;
  winRatePercent: number;
  breakEvenWinRatePercent: number;
  maxDrawdownCents: number;
  currentLossStreak: number;
  maxLossStreak: number;
  /** Report is descriptive ONLY, never a broker-order authorization. */
  analyticsOnly: true;
};
export type DemoProfitSettings561 = {
  /** Exact broker payout; 92% means +0.92 stake after a WIN. */
  exactPayoutPercent: 92;
  minimumVerifiedTrades: number;
  maxConsecutiveLosses: number;
  maxSessionNetLossCents: number;
};

export const PROFIT_DEMO_SETTINGS_561: DemoProfitSettings561 = {
  exactPayoutPercent: 92,
  minimumVerifiedTrades: 50,
  maxConsecutiveLosses: 3,
  maxSessionNetLossCents: 500,
};
const EMPTY = (reason:string):DemoProfitSummary561 => ({
  state:'NECONFIRMAT', reason, count:0, wins:0, losses:0, draws:0,
  netCents:0, winRatePercent:0,breakEvenWinRatePercent:100/1.92,
  maxDrawdownCents:0,currentLossStreak:0,maxLossStreak:0,analyticsOnly:true
});

/** Evaluate only independently verified CLOSED transactions in chronological order. */
export function analyzeProfitDemo561(
  receipts: DemoReceipt561[],
  settings: DemoProfitSettings561 = PROFIT_DEMO_SETTINGS_561,
): DemoProfitSummary561 {
  if (!Array.isArray(receipts) || receipts.length===0) return EMPTY('Nu există ordine DEMO închise și verificate');
  if (settings?.exactPayoutPercent !== 92 ||
      !Number.isInteger(settings.minimumVerifiedTrades) || settings.minimumVerifiedTrades < 30 ||
      !Number.isInteger(settings.maxConsecutiveLosses) || settings.maxConsecutiveLosses < 1 ||
      !Number.isInteger(settings.maxSessionNetLossCents) || settings.maxSessionNetLossCents < 100)
    return EMPTY('Parametri de validare neacceptați');

  const ids=new Set<string>();
  let wins=0,losses=0,draws=0,net=0,peak=0,maxDd=0,streak=0,maxStreak=0,prevClose=-Infinity;
  let baselineStake:number|null=null;
  for(let i=0;i<receipts.length;i++){
    const r=receipts[i];
    if (!r || !r.brokerClosedReceiptVerified || r.account!=='DEMO' ||
        r.strategy!=='MINMAX_560' || typeof r.orderId!=='string' ||
        r.orderId.length===0 || ids.has(r.orderId) || typeof r.pair!=='string' ||
        !r.pair.trim() || !['WIN','LOSS','DRAW'].includes(r.outcome))
      return EMPTY('Ordin lipsă, duplicat, REAL sau fără închidere verificată');
    ids.add(r.orderId);
    if (![r.openedAtMs,r.closedAtMs,r.stakeCents,r.netCents,r.payoutPercent].every(Number.isFinite) ||
        !Number.isInteger(r.stakeCents) || r.stakeCents<=0 ||
        !Number.isInteger(r.netCents) || r.payoutPercent!==92 ||
        r.expiryMinutes!==5 || r.openedAtMs<prevClose ||
        r.closedAtMs<r.openedAtMs+300_000 ||
        r.closedAtMs>r.openedAtMs+360_000)
      return EMPTY('Payout/timp/sumă invalidă sau poziții DEMO suprapuse');
    if (baselineStake===null) baselineStake=r.stakeCents;
    if (baselineStake!==r.stakeCents)
      return EMPTY('Miza a fost modificată în timpul sesiunii; nu este test cu miză fixă');

    const expectedNet=r.outcome==='WIN'?Math.round(r.stakeCents*.92):
      r.outcome==='LOSS'?-r.stakeCents:0;
    if (r.netCents!==expectedNet)
      return EMPTY('Rezultatul net nu corespunde câștigului/pierderii brokerului');
    if(r.outcome==='WIN'){wins++;streak=0;}
    else if(r.outcome==='LOSS'){losses++;streak++;maxStreak=Math.max(maxStreak,streak);}
    else {draws++;streak=0;}
    net += r.netCents;
    peak=Math.max(peak,net);
    maxDd=Math.max(maxDd,peak-net);
    prevClose=r.closedAtMs;
  }

  const decisive=wins+losses;
  const winRate=decisive?100*wins/decisive:0;
  const breakEven=100/1.92;
  const riskHit=streak>=settings.maxConsecutiveLosses ||
    net<=-settings.maxSessionNetLossCents;
  const sufficient=decisive>=settings.minimumVerifiedTrades;
  return {
    state:riskHit?'PAUZA_RISC':!sufficient?'TEST_IN_CURS':
      (net>0 && winRate>breakEven)?'REZULTAT_POZITIV':'REZULTAT_NEGATIV',
    reason:riskHit?'Pauză: prag de pierdere atins; fără ordin nou':
      !sufficient?`Sunt necesare cel puțin ${settings.minimumVerifiedTrades} rezultate WIN/LOSS confirmate`:
      'Statistică istorică DEMO, fără garanție pentru tranzacțiile viitoare',
    count:receipts.length,wins,losses,draws,netCents:net,
    winRatePercent:winRate,breakEvenWinRatePercent:breakEven,
    maxDrawdownCents:maxDd,currentLossStreak:streak,maxLossStreak:maxStreak,
    analyticsOnly:true,
  };
}
