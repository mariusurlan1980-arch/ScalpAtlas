import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../native-overlay/DemoStakeEditor.kt',import.meta.url),'utf8');
const rx=source.match(/private val brokerBalanceToken567 = Regex\(\s*"""([^"]+)"""\s*\)/);
assert.ok(rx,'567 native header-balance regex must exist');
const token=new RegExp(rx[1],'g');

function centsOfNativeEquivalent(v){
 const match=/^(\d{1,5})(?:[.,](\d{1,2}))?$/.exec(v);
 if(!match)return null;
 const frac=match[2]||'';
 return Number(match[1])*100+(frac.length===1?Number(frac)*10:frac.length===2?Number(frac):0);
}
function amountCents(input){
 const sample=input.trim();
 let normalized;
 if(/^\d{1,3}(?:,\d{3})+\.\d{2}$/.test(sample))normalized=sample.replaceAll(',','');
 else if(/^\d{1,3}(?:\.\d{3})+,\d{2}$/.test(sample))normalized=sample.replaceAll('.','').replace(',','.');
 else if(/^\d{1,5}[.,]\d{2}$/.test(sample))normalized=sample.replace(',','.');
 else return null;
 return centsOfNativeEquivalent(normalized);
}
function extract(label){
 return [...label.matchAll(token)].map(m=>amountCents(m[0])).filter(v=>v!==null);
}
test('QT DEMO screenshot balance 1,572.68 USD parses as 157268 cents, not 57268',()=>{
 assert.deepEqual(extract('QT Demo USD 1,572.68'),[157268]);
});
test('also understands the exact desired 1,572.44 USD',()=>{
 assert.deepEqual(extract('QT Demo USD 1,572.44'),[157244]);
});
test('Romanian grouped decimal balance parses independently',()=>{
 assert.deepEqual(extract('QT Demo USD 1.572,68'),[157268]);
});
test('ungrouped 1572.68 parses intact',()=>{
 assert.deepEqual(extract('1572.68'),[157268]);
});
test('rejects suffix-only matches of malformed groupings',()=>{
 assert.deepEqual(extract('1,57,2.68'),[]);
});
test('rejects numbers over 5 whole digits in native centsOf',()=>{
 assert.deepEqual(extract('100,000.00'),[]);
});
test('rejects incomplete decimals and trailing price notation',()=>{
 assert.deepEqual(extract('USD 1,572.680'),[]);
});
test('entry stake is independently set to 1.09, never borrowed from old 4.00 UI',()=>{
 const plan=readFileSync(new URL('../native-overlay/DemoAutoStakePlan565.kt',import.meta.url),'utf8');
 assert.match(plan,/private val LADDER = longArrayOf\(109L,/);
 assert.match(plan,/const val PLANNED_BUDGET_CENTS = 157244L/);
 assert.match(plan,/putLong\("pendingStake",expected\)/);
 assert.match(source,/centsOf\(after.input.value\) != stakeCents/);
 assert.match(source,/before.balanceCents < stakeCents/);
 assert.match(source,/buyPayout != 92/);
});

test('no manual or automatic broker order without opt-in start and exact 1.09 readback',()=>{
 const overlay=readFileSync(new URL('../native-overlay/ScalpOverlayService.kt',import.meta.url),'utf8');
 assert.ok(overlay.includes('BLOCAT: PORNEȘTE MIZĂ AUTO DEMO • START 1,09 USD'));
 assert.ok(overlay.includes('BLOCAT: ACTIVEAZĂ MIZĂ AUTO DEMO • START 1,09 USD'));
 assert.ok(overlay.includes('BLOCAT: START MIZĂ AUTO DEMO 1,09 USD'));
 assert.ok(overlay.includes('val readyForDemo = demoAutoStakePlan565.isEnabled() &&'));
 assert.ok(overlay.includes('BLOCAT: START 1,09 USD NECONFIRMAT • FĂRĂ ORDIN'));
 assert.ok(overlay.includes('demoAutoStakePlan565.permitsFreshDemoOrder('));
});
