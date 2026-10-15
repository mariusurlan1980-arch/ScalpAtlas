// Expected regression invariants for SCALP ATLAS LIVE 3.2.3
// No profitability claims; synthetic pixels check detection only.
import assert from 'node:assert/strict';
import fs from 'node:fs';
const native=fs.readFileSync('.github/native-overlay/ScalpOverlayService.kt','utf8');
const engine=fs.readFileSync('.github/templates/ScalpAtlasAnalysisEngineV0416.ts','utf8');
assert.match(engine,/function wickRejectionEvidence\(/);
assert.match(engine,/const buyWick=wickRejectionEvidence\(curve,'BUY',buyColors\)/);
assert.match(engine,/const sellWick=wickRejectionEvidence\(curve,'SELL',sellColors\)/);
assert.match(engine,/wickRejectionGate:!!clear&&!!wick/);
assert.match(engine,/marketRegime==='TENDINTA'/);
assert.match(engine,/expiry:clear\?5:null/);
assert.match(native,/wickGate && readableTrend/);
assert.match(native,/val confirmedSignal = if \(quality >= 55 && score >= 70 && opticalGate/);
console.log('PASS: LIVE wick-rejection and native fail-closed invariants.');
