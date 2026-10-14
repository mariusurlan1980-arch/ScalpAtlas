import assert from 'node:assert/strict';
import fs from 'node:fs';

// These tests check conservative state-transition requirements, not trading profits.
const k=fs.readFileSync('.github/native-overlay/ScalpOverlayService.kt','utf8');
const j=fs.readFileSync('.github/native-overlay/SignalJournal.kt','utf8');
const l=fs.readFileSync('.github/native-overlay/LiveTestMonitor.kt','utf8');
const e=fs.readFileSync('.github/templates/ScalpAtlasAnalysisEngineV0416.ts','utf8');
for(const s of [
  'private const val MARKET_OCR_CONFIRMATIONS = 2',
  'private const val MARKET_STALE_MS = 12_000L',
  'private const val MARKET_SETTLE_MS = 6_000L',
  'marketVerified = false',
  'clearOnInstrumentChange()',
  'if (!pairReady(now))',
  'frameMarketEpoch = marketEpoch',
  'frameMarket = currentPair(now)',
  'frameMarketEpoch != marketEpoch',
  'frameMarket != currentPair(now)',
  'if (ocrBusy || now - lastOcrAttemptAt < OCR_INTERVAL_MS) return',
  'val market = currentPair(now)',
  'marketStableAt = observedAt',
]) assert.ok(k.includes(s),'Missing fail-closed instrument context: '+s);
assert.ok(!k.includes('if (!tfAutomatic || ocrBusy'),
  'Asset OCR must still run in manual timeframe mode');
assert.ok(j.includes('PROFILURI PE PERECHE SI TIMEFRAME'),
  'Journal must report per-instrument samples distinctly');
assert.ok(j.includes('marketRegime: String'),
  'Journal must accept optical regime');
assert.ok(l.includes('.put("markets", JSONObject())'),
  '30-minute LIVE sessions must collect per-market stats');
assert.ok(l.includes('fun onBeep(now: Long, direction: String, market: String)'),
  'Audio events must be attached to correct asset');
assert.ok(e.includes('marketRegime,'),
  'Screenshot analysis must report a visual regime');
assert.ok(e.includes("signal:clear?r.dir:'NONE'"),
  'Optical gate must stay in front of audio');

// Simple reference model for future integration tests; chart identity is
// allowed to become eligible only after two consistent reads and settling.
class Pair {
  constructor(){this.pair='NEIDENTIFICAT';this.valid=false;this.pending='';this.n=0;this.pendingAt=0;this.confirmedAt=0;this.lastAt=0;this.epoch=0;}
  observe(asset,now){
    if(asset!==this.pair && this.valid){this.valid=false;this.epoch++;}
    if(this.pending!==asset||now-this.pendingAt>9000){this.pending=asset;this.n=1;}
    else this.n++;
    this.pendingAt=now;
    if(this.n>=2){
      if(!this.valid||this.pair!==asset){this.pair=asset;this.valid=true;this.confirmedAt=now;this.epoch++;}
      this.lastAt=now;
    }
  }
  canBeep(now){return this.valid&&now-this.lastAt<=12000&&now-this.confirmedAt>=6000;}
}
const p=new Pair();
p.observe('EUR/USD',1000);
assert.equal(p.canBeep(2000),false,'one OCR reading is insufficient');
p.observe('EUR/USD',4100);
assert.equal(p.canBeep(7000),false,'new pair needs settle period');
assert.equal(p.canBeep(11000),true,'stable verified pair is eligible');
const oldEpoch=p.epoch;
p.observe('QAR/CNY',12000);
assert.equal(p.canBeep(12100),false,'first new pair reading must invalidate old entry');
assert.ok(p.epoch>oldEpoch,'instrument change must advance epoch');
p.observe('QAR/CNY',15200);
assert.equal(p.canBeep(18000),false,'wait for new market settle');
assert.equal(p.canBeep(21500),true,'new market may be eligible after confirmations');
assert.equal(p.canBeep(35000),false,'stale OCR must not permit signals');
console.log('PASS: pair OCR, switching, market epochs, settling, per-instrument diagnostics (synthetic reference tests).');
