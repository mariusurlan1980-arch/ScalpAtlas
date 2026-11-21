import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('.github/native-overlay/ScalpOverlayService.kt', 'utf8');
const inZone = (instant, zone) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date(instant));
  const get = type => Number(parts.find(x => x.type === type).value);
  return get('hour') * 60 + get('minute');
};
const clockMinutes = instant =>
  new Set([inZone(instant, 'Europe/Bucharest'), inZone(instant, 'Etc/GMT-3')]);
const uniqueRow = (rows, minutes) => {
  const candidates = rows.filter(row => [...minutes].some(m => {
    const gap = Math.abs(m - row.minute);
    return Math.min(gap, 1440 - gap) <= 3;
  }));
  return candidates.length === 1 ? candidates[0] : null;
};

test('582: history at 18:49 and broker chart at 19:49 are both valid clock views', () => {
  const c = clockMinutes('2026-11-21T16:49:00Z');
  assert.deepEqual([...c].sort((a,b) => a-b), [18*60+49, 19*60+49]);
  assert.equal(uniqueRow([{pair:'AUD/CHF OTC',minute:18*60+49}],c)?.pair,'AUD/CHF OTC');
  assert.equal(uniqueRow([{pair:'AUD/CHF OTC',minute:19*60+49}],c)?.pair,'AUD/CHF OTC');
});
test('582: two matching historical rows are ambiguous and MUST NOT be selected', () => {
  const c = clockMinutes('2026-11-21T16:49:00Z');
  assert.equal(uniqueRow([{minute:18*60+49},{minute:19*60+49}],c),null);
  assert.equal(uniqueRow([{minute:17*60+49}],c),null);
});
test('582: the Kotlin navigation and order safeguards remain required', () => {
  assert.match(source,/private fun brokerHistoryClockSeconds582\(/);
  assert.match(source,/java\.util\.TimeZone\.getDefault\(\)/);
  assert.match(source,/java\.util\.TimeZone\.getTimeZone\("GMT\+03:00"\)/);
  assert.match(source,/brokerHistoryClockSeconds582\(gestureWallTime\)/);
  assert.match(source,/brokerHistoryClockSeconds582\(System\.currentTimeMillis\(\) - age \+ 300_000L\)/);
  assert.match(source,/if \(timeMatched\.size == 1\) timeMatched/);
  assert.match(source,/verifiedOpenId445 == closedProof437\.positionId/);
  assert.match(source,/closedProof437\.stakeCents == expectedStake429/);
  assert.match(source,/closedProof437\.payoutPercent == expectedPayout429/);
  assert.match(source,/brokerVerifiedEmptyDemoReview\(true\)/);
  assert.match(source,/alreadySettledClosedReceipt444\(/);
});
