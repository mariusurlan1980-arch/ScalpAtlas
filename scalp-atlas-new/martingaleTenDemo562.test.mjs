import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildMartingaleLadder562,reviewMartingaleTenDemo562,simulateMartingaleSeries562
} from './martingaleTenDemo562.ts';
const ladder=buildMartingaleLadder562();
const amounts=[109,228,475,992,2070,4320,9016,18816,39268,81950];
const totals=[109,337,812,1804,3874,8194,17210,36026,75294,157244];
const now=1_800_000_000_000;
const readOnly={account:'DEMO',balanceCents:157244,payoutPercent:92,
  source:'BROKER_READ_ONLY_VERIFIED',verifiedAtMs:now-1000};
test('ten exact-cent stakes match fixed +$1 at 92 percent',()=>{
 assert.deepEqual(ladder.map(v=>v.stakeCents),amounts);
 assert.deepEqual(ladder.map(v=>v.totalLossesIfThisFailsCents),totals);
});
test('every winning level nets AT LEAST one dollar after previous losses',()=>{
 assert.equal(ladder.length,10);
 for(const l of ladder) assert.ok(l.netProfitIfThisWinsCents>=100);
});
test('ten losses cost 1,572.44 USD',()=>{
 const s=simulateMartingaleSeries562(Array(10).fill('LOSS'));
 assert.equal(s.state,'FAILED_TEN_LOSSES');assert.equal(s.netCents,-157244);
 assert.equal(s.nextStakeCents,null);
});
test('ten level total is required bankroll, not only last stake',()=>{
 const s=reviewMartingaleTenDemo562(now,readOnly);
 assert.equal(s.requiredBalanceCents,157244);
 assert.equal(s.maxAffordableLevels,10);
 assert.equal(s.balanceStatus,'ENOUGH_FOR_TEN');
 assert.equal(s.mayPlaceBrokerOrder,false);
});
test('a 100 USD verified balance affords 6 consecutive attempts, not ten',()=>{
 const s=reviewMartingaleTenDemo562(now,{...readOnly,balanceCents:10000});
 assert.equal(s.maxAffordableLevels,6);
 assert.equal(s.shortfallCents,147244);
 assert.equal(s.balanceStatus,'INSUFFICIENT');
});
test('a 32.81 USD verified balance affords four cumulative levels',()=>{
 const s=reviewMartingaleTenDemo562(now,{...readOnly,balanceCents:3281});
 assert.equal(s.maxAffordableLevels,4);
});
test('unverified user-entered DEMO balance never unlocks funding status',()=>{
 const s=reviewMartingaleTenDemo562(now,{...readOnly,source:'USER_ENTERED'});
 assert.equal(s.balanceStatus,'INVALID_OR_STALE');assert.equal(s.availableBalanceCents,null);
});
test('real-account balance is never accepted',()=>{
 const s=reviewMartingaleTenDemo562(now,{...readOnly,account:'REAL'});
 assert.equal(s.balanceStatus,'INVALID_OR_STALE');
});
test('stale balance is never treated as broker proof',()=>{
 const s=reviewMartingaleTenDemo562(now,{...readOnly,verifiedAtMs:now-20000});
 assert.equal(s.balanceStatus,'INVALID_OR_STALE');
});
test('future balance timestamp is rejected',()=>{
 const s=reviewMartingaleTenDemo562(now,{...readOnly,verifiedAtMs:now+1});
 assert.equal(s.balanceStatus,'INVALID_OR_STALE');
});
test('payout must remain EXACTLY 92%',()=>{
 assert.equal(reviewMartingaleTenDemo562(now,{...readOnly,payoutPercent:89}).balanceStatus,'INVALID_OR_STALE');
 assert.equal(reviewMartingaleTenDemo562(now,{...readOnly,payoutPercent:93}).balanceStatus,'INVALID_OR_STALE');
});
test('no broker balance results in no funding statement',()=>{
 const s=reviewMartingaleTenDemo562(now,null);
 assert.equal(s.balanceStatus,'NO_VERIFIED_BALANCE');assert.equal(s.maxAffordableLevels,0);
});
test('win on the first attempt ends a $1 series',()=>{
 const s=simulateMartingaleSeries562(['WIN']);
 assert.equal(s.state,'TARGET_REACHED');assert.equal(s.netCents,100);assert.equal(s.nextStakeCents,null);
});
test('after four losses winning fifth returns $1.00 net',()=>{
 const s=simulateMartingaleSeries562(['LOSS','LOSS','LOSS','LOSS','WIN']);
 assert.equal(s.state,'TARGET_REACHED');assert.equal(s.netCents,100);
});
test('after nine losses winning tenth returns $1.00 net',()=>{
 const s=simulateMartingaleSeries562([...Array(9).fill('LOSS'),'WIN']);
 assert.equal(s.state,'TARGET_REACHED');assert.equal(s.netCents,100);
});
test('two early losses progress to level three with a -$3.37 series',()=>{
 const s=simulateMartingaleSeries562(['LOSS','LOSS']);
 assert.equal(s.state,'ONGOING');assert.equal(s.netCents,-337);assert.equal(s.nextStakeCents,475);
});
test('a draw does not escalate the next stake',()=>{
 const s=simulateMartingaleSeries562(['DRAW']);
 assert.equal(s.state,'ONGOING');assert.equal(s.nextStakeCents,109);assert.equal(s.netCents,0);
});
test('no attempt means un-settled and no broker order',()=>{
 const s=simulateMartingaleSeries562([]);
 assert.equal(s.state,'UNSETTLED');assert.equal(s.nextStakeCents,109);assert.equal(s.simulatorOnly,true);
});
test('cannot continue after a WIN',()=>{
 assert.equal(simulateMartingaleSeries562(['WIN','LOSS']).state,'INVALID');
});
test('cannot exceed ten attempts',()=>{
 assert.equal(simulateMartingaleSeries562(Array(11).fill('LOSS')).state,'INVALID');
});
test('cannot infer outcomes from OPEN or unknown receipts',()=>{
 assert.equal(simulateMartingaleSeries562(['OPEN']).state,'INVALID');
});
