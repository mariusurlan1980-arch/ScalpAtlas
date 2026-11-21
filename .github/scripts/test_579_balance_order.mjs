import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';

const editor=readFileSync(new URL('../native-overlay/DemoStakeEditor.kt',import.meta.url),'utf8');
const touch=readFileSync(new URL('../native-overlay/TouchTestService.kt',import.meta.url),'utf8');
const overlay=readFileSync(new URL('../native-overlay/ScalpOverlayService.kt',import.meta.url),'utf8');
const pipeline=readFileSync(new URL('../workflows/build-native-robot-safe-preflight-379.yml',import.meta.url),'utf8');

const a=editor.indexOf('internal fun demoBalanceFromVerifiedHeader579(');
const b=editor.indexOf('private val brokerBalanceToken567',a);
const parser=editor.slice(a,b);
const p=touch.indexOf('val accountAnchors497 =');
const q=touch.indexOf('val expression = if (side == "BUY")',p);
const preflight=touch.slice(p,q);

// Mirror the strict Kotlin parser with JS, using identical anchored patterns.
// This demonstrates accepted locale forms, not authorization to place orders.
function strictBalance(raw) {
  const trimmed=raw.trim().replace(/\s+/g,' ').replace(/^QT\s+Demo\b\s*/i,'')
    .replace(/^(?:USD\s*|\$\s*)/i,'')
    .replace(/\s*(?:USD|\$)$/i,'').trim();
  const plain=/^(\d{1,5})(?:[.,](\d{1,2}))?$/;
  const simple=plain.exec(trimmed);
  if(simple) return Number(simple[1])*100 +
    (simple[2]===undefined?0:simple[2].length===1?
      Number(simple[2])*10:Number(simple[2]));
  const US=/^\d{1,3}(?:,\d{3})+\.\d{2}$/;
  const EU=/^\d{1,3}(?:\.\d{3})+,\d{2}$/;
  const DEC=/^\d{1,5}[.,]\d{2}$/;
  const num=US.test(trimmed)?trimmed.replace(/,/g,''):
    EU.test(trimmed)?trimmed.replace(/\./g,'').replace(',','.'):
    DEC.test(trimmed)?trimmed.replace(',','.') : null;
  if(num===null) return null;
  const parts=num.split('.');
  return Number(parts[0])*100+Number(parts[1]);
}
test('579 exact QT Demo balance forms, including observed 1,572.68',()=>{
 for(const v of ['1,572.68','USD 1,572.68','QT Demo USD 1,572.68',
    '1.572,68','USD 1.572,68','1572.68'])
   assert.equal(strictBalance(v),157268,v);
 for(const v of ['1,09','1.09']) assert.equal(strictBalance(v),109,v);
 for(const v of ['20','QT Demo USD 20','20.5','USD 20,5'])
   assert.equal(strictBalance(v),v.includes('20.5')||v.includes('20,5')?2050:2000,v);
 for(const v of ['572.68.00','1,572.6','1,572','1,572,68','a1,572.68',
    'real: 1,572.68','QT Real USD 1,572.68','59.46117','0.16079',''])
   assert.equal(strictBalance(v),null,v);
});
test('579 order preflight must use strict common balance parser',()=>{
 assert.ok(a>0 && b>a);
 assert.ok(parser.includes('brokerBalanceCents567(numeric)'));
 assert.ok(parser.includes('Regex("""(?i)^QT\\s+Demo\\b\\s*""")'));
 assert.ok(editor.includes('Regex("""^\\d{1,3}(?:,\\d{3})+\\.\\d{2}$""")'));
 assert.ok(editor.includes('Regex("""^\\d{1,3}(?:\\.\\d{3})+,\\d{2}$""")'));
 assert.ok(preflight.includes('Regex("""(?i)\\bQT\\s*Demo\\b""")'));
 assert.ok(preflight.includes('val usdAccount497 = accountLabels497.any'));
 assert.ok(preflight.includes('accountAnchors497.isEmpty() || !usdAccount497'));
 assert.ok(preflight.includes('DemoStakeEditor.demoBalanceFromVerifiedHeader579(label.value)'));
 assert.ok(preflight.includes('balanceValues497.size != 1'));
 assert.ok(preflight.includes('balanceValues497.single() < verifiedStakeCents'));
 assert.ok(!preflight.includes('val balanceFormat497 ='));
});
test('579 rotation payout uses stable foreground broker identity instead of node instance equality',()=>{
 const start=editor.indexOf('fun readRotationPayout(');
 const end=editor.indexOf('private fun inspect(',start);
 const fn=editor.slice(start,end);
 assert.ok(fn.includes('readChart(svc, realAccount)'));
 assert.ok(fn.includes('readChartPayout(chart)'));
 assert.ok(fn.includes('svc.rootInActiveWindow?.packageName?.toString() == chart.pkg'));
 assert.ok(!fn.includes('svc.rootInActiveWindow == chart.root'));
 const reader=touch.slice(touch.indexOf('fun readFxChartPayout('),touch.indexOf('fun fxListVisible('));
 assert.ok(reader.includes('readVisibleFxPair(realAccount) != pair'));
 assert.ok(reader.includes('readVisibleFxPair(realAccount) == pair'));
});
test('579 retains QT Demo only, 92%, one-position and verified result gating',()=>{
 assert.ok(touch.includes('if (real) return DemoOrderCheck(reason = "BLOCAT: QT REAL PE ECRAN")'));
 assert.ok(touch.includes('checkOneDollarDemoTarget("BUY", true, null)'));
 assert.ok(touch.includes('checkOneDollarDemoTarget("SELL", true, null)'));
 assert.ok(touch.includes('if (payoutValues.size != 1 || payoutValues[0] != 92)'));
 assert.ok(overlay.includes('demoAutoStakePlan565.permitsFreshDemoOrder('));
 assert.ok(overlay.includes('tradePositionGate.beginAttempt()'));
 assert.ok(overlay.includes('val closed = verifiedClosedDetail437'));
 const plan=readFileSync(new URL('../native-overlay/DemoAutoStakePlan565.kt',import.meta.url),'utf8');
 assert.ok(plan.includes('STOP_AFTER_LOSSES = 10'));
 assert.ok(plan.includes('PAYOUT_EXACT = 92'));
});
test('579 signed Android release and balance regression included',()=>{
 assert.ok(pipeline.includes("expo['android']['versionCode']=580"));
 assert.ok(pipeline.includes('node --test .github/scripts/test_579_balance_order.mjs'));
 assert.ok(pipeline.includes('ScalpAtlas-580-BASE109-READBACK-DEMO-G24.apk'));
 assert.ok(pipeline.includes('apksigner'));
});