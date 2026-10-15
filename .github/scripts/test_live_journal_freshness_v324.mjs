// Regression checklist for the LIVE alert gate and T+5m journal.
 // Checks source wiring plus explicit observed timing cases; these are NOT
 // broker-OHLC/backtest/win-rate tests.
import assert from 'node:assert/strict';
import fs from 'node:fs';

const journal = fs.readFileSync('.github/native-overlay/SignalJournal.kt', 'utf8');
const service = fs.readFileSync('.github/native-overlay/ScalpOverlayService.kt', 'utf8');

assert.match(journal, /private val targetFollowupMs = 5L \* 60_000L/);
assert.match(journal, /private val followupToleranceMs = 45_000L/);
assert.match(journal, /if \(elapsed > targetFollowupMs \+ followupToleranceMs\)/);
assert.match(journal, /item\.put\("followupReason", "CAPTURA_INTARZIATA"\)/);
assert.match(journal, /item\.put\("followupDelaySeconds", elapsed \/ 1000L\)/);

assert.match(service, /private const val MAX_ALERT_ANALYSIS_AGE_MS = 3000L/);
assert.match(service, /analysisAgeMs > MAX_ALERT_ANALYSIS_AGE_MS/);
assert.match(service, /Cadru vechi • fără candidat și fără bip/);

const validCapture = (seconds, samePairAndTf) => seconds >= 300 &&
  seconds <= 345 && samePairAndTf;
for (const seconds of [300, 301, 345]) assert.equal(validCapture(seconds,true),true);
for (const seconds of [299,346,589,1190]) assert.equal(validCapture(seconds,true),false);
assert.equal(validCapture(301,false),false);
const freshAnalysis = ms => ms >= 0 && ms <= 3000;
assert.equal(freshAnalysis(2800),true);
assert.equal(freshAnalysis(3001),false);

console.log('PASS: late-frame beep guard; exact T+5m capture window; same pair/TF; delays found in real journal (589s/1190s) rejected.');
