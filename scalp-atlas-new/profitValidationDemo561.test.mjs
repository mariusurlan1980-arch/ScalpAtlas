import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeProfitDemo561, PROFIT_DEMO_SETTINGS_561 } from './profitValidationDemo561.ts';

const start=1_730_000_000_000;
const receipt=(i,outcome='WIN',more={})=>({
  orderId:`order-${i}`,account:'DEMO',strategy:'MINMAX_560',pair:'EUR/USD OTC',
  openedAtMs:start+i*360_000,closedAtMs:start+i*360_000+300_000,
  expiryMinutes:5,stakeCents:100,payoutPercent:92,outcome,
  netCents:outcome==='WIN'?92:outcome==='LOSS'?-100:0,
  brokerClosedReceiptVerified:true,...more,
});
const outcomeSet=Array.from({length:50},(_,i)=>i%2===0||[1,3,5].includes(i)?'WIN':'LOSS');
const positive=outcomeSet.map((o,i)=>receipt(i,o));
test('empty ledger is unknown, never profitable',()=>{
 const s=analyzeProfitDemo561([]);assert.equal(s.state,'NECONFIRMAT');assert.equal(s.analyticsOnly,true);
});
test('50 closed, fixed-stake 28 WIN / 22 LOSS at 92% gives positive demo net',()=>{
 const s=analyzeProfitDemo561(positive);
 assert.equal(s.state,'REZULTAT_POZITIV');assert.equal(s.count,50);assert.equal(s.wins,28);
 assert.equal(s.losses,22);assert.equal(s.netCents,376);assert.equal(s.winRatePercent,56);
 assert.equal(s.analyticsOnly,true);
});
test('52% win rate not sufficient at 92% payout',()=>{
 const os=Array.from({length:50},(_,i)=>i%2===0||[1].includes(i)?'WIN':'LOSS');
 const s=analyzeProfitDemo561(os.map((o,i)=>receipt(i,o)));
 assert.equal(s.wins,26);assert.equal(s.netCents,-8);assert.equal(s.state,'REZULTAT_NEGATIV');
});
test('break-even win rate equals 1/1.92',()=>{
 const s=analyzeProfitDemo561([receipt(0)]);
 assert.ok(Math.abs(s.breakEvenWinRatePercent-52.08333333333333)<0.00001);
});
test('no positive status with only 3 winning trades',()=>{
 const s=analyzeProfitDemo561([receipt(0),receipt(1),receipt(2)]);
 assert.equal(s.state,'TEST_IN_CURS');
});
test('risk pause after three consecutive losses',()=>{
 const s=analyzeProfitDemo561([receipt(0,'LOSS'),receipt(1,'LOSS'),receipt(2,'LOSS')]);
 assert.equal(s.state,'PAUZA_RISC');assert.equal(s.currentLossStreak,3);
});
test('risk pause when maximum allowed demo net loss reached',()=>{
 const s=analyzeProfitDemo561([
 receipt(0,'LOSS'),receipt(1,'LOSS'),receipt(2,'WIN'),
 receipt(3,'LOSS'),receipt(4,'LOSS'),receipt(5,'WIN'),
 receipt(6,'LOSS'),receipt(7,'LOSS'),receipt(8,'WIN'),
 receipt(9,'LOSS'),receipt(10,'LOSS'),receipt(11,'WIN'),
 receipt(12,'LOSS'),receipt(13,'LOSS'),
 ]);
 assert.equal(s.state,'PAUZA_RISC');assert.ok(s.netCents<=-500);
});
test('rejects an order without broker-verified CLOSED receipt',()=>assert.equal(
 analyzeProfitDemo561([receipt(0,'WIN',{brokerClosedReceiptVerified:false})]).state,'NECONFIRMAT'
));
test('rejects a REAL-account order even if labeled WIN',()=>assert.equal(
 analyzeProfitDemo561([receipt(0,'WIN',{account:'REAL'})]).state,'NECONFIRMAT'
));
test('rejects a non-MINMAX strategy claim',()=>assert.equal(
 analyzeProfitDemo561([receipt(0,'WIN',{strategy:'SHOCK'})]).state,'NECONFIRMAT'
));
test('rejects 91% payout',()=>assert.equal(
 analyzeProfitDemo561([receipt(0,'WIN',{payoutPercent:91})]).state,'NECONFIRMAT'
));
test('rejects 93% payout when 92% is required EXACTLY',()=>assert.equal(
 analyzeProfitDemo561([receipt(0,'WIN',{payoutPercent:93})]).state,'NECONFIRMAT'
));
test('rejects changing stake during performance test',()=>assert.equal(
 analyzeProfitDemo561([receipt(0),receipt(1,'WIN',{stakeCents:209,netCents:192})]).state,'NECONFIRMAT'
));
test('rejects duplicate order IDs',()=>assert.equal(
 analyzeProfitDemo561([receipt(0),receipt(1,'LOSS',{orderId:'order-0'})]).state,'NECONFIRMAT'
));
test('rejects overlapping orders',()=>assert.equal(
 analyzeProfitDemo561([receipt(0),receipt(1,'WIN',{openedAtMs:start+100_000,closedAtMs:start+400_000})]).state,'NECONFIRMAT'
));
test('rejects a five-minute elapsed-time guess without net confirmation',()=>assert.equal(
 analyzeProfitDemo561([receipt(0,'WIN',{netCents:0})]).state,'NECONFIRMAT'
));
test('rejects a 10-minute expiry imported from old strategy',()=>assert.equal(
 analyzeProfitDemo561([receipt(0,'WIN',{expiryMinutes:10})]).state,'NECONFIRMAT'
));
test('draws count separately and do not improve the win rate',()=>{
 const s=analyzeProfitDemo561([receipt(0,'WIN'),receipt(1,'DRAW')]);
 assert.equal(s.draws,1);assert.equal(s.winRatePercent,100);assert.equal(s.netCents,92);
 assert.equal(s.state,'TEST_IN_CURS');
});
test('never emits buy/sell instructions',()=>{
 const s=analyzeProfitDemo561(positive);
 assert.ok(!Object.hasOwn(s,'order'));assert.ok(!Object.hasOwn(s,'side'));
 assert.equal(s.analyticsOnly,true);
});
