// Synthetic screenshot tests of the exact optical candle gate embedded in HTML.
// No historical performance or winning-trade assumptions are made here.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('.github/templates/ScalpAtlasAnalysisEngineV0416.ts', 'utf8');
const first = source.indexOf('  function candleEvidence(curve,wantedDirection){');
const last = source.indexOf('  function classify(curve){', first);
assert.ok(first >= 0 && last > first, 'live HTML candleEvidence must exist');
const actualFunction = source.slice(first, last);
const width = 420;
const height = 240;
const colour = {
  BUY: [20, 220, 90],
  SELL: [218, 42, 44],
};

function buildScreenshot(bars) {
  const pixels = new Uint8ClampedArray(width * height * 4);
  // Set entire screen to dark and opaque.
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = 14; pixels[i + 1] = 22; pixels[i + 2] = 35; pixels[i + 3] = 255;
  }
  for (const bar of bars) {
    const rgb = colour[bar.color];
    for (let x = bar.x; x < bar.x + 8; x++) {
      for (let y = bar.y; y < bar.y + 22; y++) {
        const i = (y * width + x) * 4;
        pixels[i] = rgb[0]; pixels[i + 1] = rgb[1]; pixels[i + 2] = rgb[2];
      }
    }
  }
  const ctx = { getImageData() { return { data: pixels }; } };
  const evidence = vm.runInNewContext(actualFunction + ';candleEvidence', { ctx });
  return (direction) => evidence({ w: width, h: height }, direction);
}

function series(colors) {
  return colors.map((color, i) => ({ color, x: 75 + i * 38, y: 75 + (i % 3) * 7 }));
}

// Rightmost candle may still be forming. Two BEFORE it must agree with signal.
const consistent = buildScreenshot(series(['SELL','BUY','SELL','SELL','BUY']));
assert.equal(consistent('SELL').ok, true, 'two matching closed bars allow optical evidence');
assert.equal(consistent('BUY').ok, false, 'conflicting closed bars must reject BUY');

const conflicting = buildScreenshot(series(['BUY','SELL','BUY','SELL','BUY']));
assert.equal(conflicting('SELL').ok, false, 'alternating closed bars must reject SELL');
assert.match(conflicting('SELL').reason, /culori opuse/);

const blank = buildScreenshot([]);
assert.equal(blank('BUY').ok, false, 'blank screenshots fail closed');

const tooFew = buildScreenshot(series(['BUY','BUY']));
assert.equal(tooFew('BUY').ok, false, 'two total candles are insufficient');

const oldBars = buildScreenshot(['SELL','SELL','SELL','SELL','BUY']
  .map((color,i)=>({color,x:40+i*17,y:65})));
assert.equal(oldBars('SELL').ok, false, 'old candles far left cannot trigger an alert');

console.log('PASS: 6 optical evidence cases (consistent, opposite, conflicting, blank, sparse, stale).');
