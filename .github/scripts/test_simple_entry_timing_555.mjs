// Deterministic tests of the EXACT embedded Android HTML entry-timing guard.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync('scalp-atlas-new/shockNativeEngine.ts', 'utf8');
const hit = source.match(/  function earlyContinuationGuard\(candle,history,now,tolerance\)\{[\s\S]*?\n  \}\n  function send\(/);
assert.ok(hit, 'Embedded Android early entry guard missing');
const fnSource = hit[0].replace(/\n  function send\($/, '');
const guard = vm.runInNewContext('(function(){' + fnSource + ';return earlyContinuationGuard;})()');

const base = {
  dir: 'BUY', previousCandleDirection: 'BUY',
  trendMeasured: true, trendHistoryCount: 3,
  trendAverageBodyPx: 12, bodyHeight: 10,
  connectedLowerWickPixels: 3, connectedUpperWickPixels: 0, x: 100,
};
const buy = [
  {t: 1000, y: 100, dir:'BUY', x: 100},
  {t: 1600, y: 105, dir:'SELL', x: 100},
  {t: 2600, y: 102, dir:'BUY', x: 100},
];
function check(label, expected, candle=base, samples=buy, now=2600, tolerance=7) {
  assert.equal(guard(candle,samples,now,tolerance), expected, label);
}
check('BUY confirmed recent retreat and bounce', true);
check('Reject late oversized candle', false, {...base,bodyHeight:20});
check('Reject no visible rejection wick', false, {...base,connectedLowerWickPixels:0});
check('Reject mixed previous candle', false, {...base,previousCandleDirection:'SELL'});
check('Reject absent measured historical bodies', false, {...base,trendHistoryCount:2});
check('Reject static upward run without pullback', false, base,
  [buy[0], {...buy[1],y:98,dir:'BUY'}, {...buy[2],y:94}]);
check('Reject old rebound evidence', false, base, buy, 16000);
check('Reject samples from a different candle X', false, base,
  [buy[0], {...buy[1],x:130}, buy[2]]);
check('Reject insufficient separate frames', false, base, buy.slice(1));
const sellCandle = {
  ...base, dir:'SELL',previousCandleDirection:'SELL',
  connectedLowerWickPixels:0,connectedUpperWickPixels:3,
};
const sell = [
  {t: 1000, y: 100, dir:'SELL', x: 100},
  {t: 1600, y: 95, dir:'BUY', x: 100},
  {t: 2600, y: 98, dir:'SELL', x: 100},
];
check('SELL confirmed recent spike and rejection', true, sellCandle, sell);
check('SELL rejected when no upper wick', false,
  {...sellCandle,connectedUpperWickPixels:0},sell);
const service=readFileSync('.github/native-overlay/ScalpOverlayService.kt','utf8');
assert.match(service,/val simpleEntryVerified555 = result\.optBoolean\("simpleEarlyEntryGuard555", false\)/);
assert.match(service,/simpleEntryVerified555 &&\s*result\.optBoolean\("simpleOpticalVerified553", false\)/);
assert.match(service,/val confirmedShock = sameCandleColors/);
assert.match(service,/val confirmedScalp547 = rawStrategy == "SCALP_TREND"/);
assert.match(service,/tradePositionGate\.beginAttempt\(\)/);
console.log('555: early continuation timing guard passed 11 deterministic BUY/SELL/rejection cases; DEMO order path retained');
