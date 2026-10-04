import assert from 'node:assert/strict';
import { calculateJournalStatistics, calculateStatistics } from '../src/statistics.js';

assert.deepEqual(calculateStatistics([]), { total: 0, buy: 0, sell: 0, averageProbability: 0, patterns: [], timeframes: [] });

const result = calculateStatistics([
  { signal: 'BUY', probability: 80, pattern: 'Dublu Minim', timeframe: 'M5' },
  { signal: 'SELL', probability: 70, pattern: 'Breakout Suport', timeframe: 'M10' },
  { signal: 'BUY', probability: 90, pattern: 'Dublu Minim', timeframe: 'M5' },
]);
assert.equal(result.total, 3);
assert.equal(result.buy, 2);
assert.equal(result.sell, 1);
assert.equal(result.averageProbability, 80);
assert.deepEqual(result.patterns[0], ['Dublu Minim', 2]);
assert.deepEqual(result.timeframes[0], ['M5', 2]);
console.log('Statistics tests passed');

assert.deepEqual(calculateJournalStatistics([]), { total: 0, wins: 0, losses: 0, winRate: 0 });
assert.deepEqual(calculateJournalStatistics([{outcome:'WIN'},{outcome:'LOSS'},{outcome:'WIN'}]), { total: 3, wins: 2, losses: 1, winRate: 67 });
console.log('Journal statistics tests passed');
