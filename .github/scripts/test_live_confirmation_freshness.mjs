// Regression expectations for the native LIVE confirmation state machine.
// Synthetic sequences below are reference scenarios, not observed trading wins.
import assert from 'node:assert/strict';
import fs from 'node:fs';

const kotlin = fs.readFileSync('.github/native-overlay/ScalpOverlayService.kt', 'utf8');
const journal = fs.readFileSync('.github/native-overlay/SignalJournal.kt', 'utf8');
const engine = fs.readFileSync('.github/templates/ScalpAtlasAnalysisEngineV0416.ts', 'utf8');
for (const token of [
  'private const val CANDIDATE_EVIDENCE_GRACE_MS = 5_000L',
  'private const val CANDIDATE_MAX_AGE_MS = 70_000L',
  'now - candidateLastSeenAt <= CANDIDATE_EVIDENCE_GRACE_MS',
  'now - candidateLastSeenAt > CANDIDATE_EVIDENCE_GRACE_MS',
  'now - candidateStartedAt > CANDIDATE_MAX_AGE_MS',
  'candidateLastSeenAt = now',
  'candidateStartedAt = now',
  'journal.observe(',
  'journal.record(',
  'journal.followUp(',
]) assert.ok(kotlin.includes(token), 'missing native invariant: ' + token);
assert.ok(!kotlin.includes('now - candidateLastAt <= 65000L'),
  'old sticky candidate logic must never return');
for (const token of [
  'private val maxObservations = 100',
  'lastObservedAt < 15_000L',
  'now - lastDiagnosticImageAt >= 120_000L',
  '"NEVERIFICAT"',
]) assert.ok(journal.includes(token), 'missing bounded diagnostic invariant: ' + token);
assert.ok(engine.includes("candidateDirection:r.clear?r.dir:'NONE'"),
  'diagnostic direction must never bypass the optical gate');
assert.ok(engine.includes("signal:clear?r.dir:'NONE'"),
  'only optically confirmed signals are eligible for audio');

// The expected timed scenario: three consistent positive windows spanning
// at least 40 seconds, no stale carryover after 5 seconds without evidence.
function run(sequence) {
  let dir = null, count = 0, last = 0, seen = 0, first = 0, emitted = 0;
  for (const [now, result] of sequence) {
    if (result === 'NONE') {
      if (!(dir && now - seen <= 5000 && now - first <= 70000)) {
        dir = null; count = 0; last = 0; seen = 0; first = 0;
      }
      continue;
    }
    if (dir !== result || !seen || now - seen > 5000 || !first || now - first > 70000) {
      dir = result; count = 1; last = now; first = now;
    } else if (now - last >= 20000) {
      count += 1; last = now;
    }
    seen = now;
    if (count >= 3) {
      emitted++;
      dir = null; count = 0; last = 0; seen = 0; first = 0;
    }
  }
  return emitted;
}
function positive(from, to, interval=2000, dir='SELL') {
  return Array.from({length:Math.floor((to-from)/interval)+1},
    (_,i)=>[from + i*interval, dir]);
}
assert.equal(run([...positive(1000,49000)]), 1, 'continuous stable confirmation can beep');
assert.equal(run([...positive(1000,7000),[13000,'NONE'],...positive(23000,41000)]),
  0, 'an old candidate cannot accumulate partial windows');
assert.equal(run([...positive(1000,24000),[31000,'NONE'],...positive(40000,58000)]),
  0, 'a 7sec gap must reject an accumulated 2/3 candidate');
assert.equal(run([...positive(1000,20000),[23000,'BUY'],...positive(25000,44000)]),
  0, 'an opposite optical signal resets confirmation');
assert.equal(run([]),0,'no optical frames never cause a beep');
console.log('PASS: native stale-candidate checks + five synthetic timing cases + bounded diagnostic invariants.');
