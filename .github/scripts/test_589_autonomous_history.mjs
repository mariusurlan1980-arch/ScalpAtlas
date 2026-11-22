import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const service = readFileSync(new URL('../native-overlay/ScalpOverlayService.kt', import.meta.url), 'utf8');
const plan = readFileSync(new URL('../native-overlay/DemoAutoStakePlan565.kt', import.meta.url), 'utf8');

test('589 auto history is allowed only for persisted QT Demo gesture in safe review mode', () => {
  const gate = service.slice(service.indexOf('val pendingAutoHistory589 ='),
                             service.indexOf('if (CHART_ONLY_DEMO_462 && !pendingAutoHistory589)'));
  for (const requirement of [
    'CHART_ONLY_DEMO_462', '!shuttingDown', '!realAccountSafetyStop517',
    'mediaProjection != null', 'TouchTestService.ready()',
    '.getBoolean("attempted", false)',
    'autoDemoSessionConsumed = true',
    'autoDemoSessionRequested = false',
    'autoDemoArmed = false'
  ]) assert.ok(gate.includes(requirement), requirement);
  assert.ok(!gate.includes('putBoolean("attempted", false)'));
  assert.ok(!gate.includes('beginAttempt()'));
  assert.ok(!gate.includes('pressVerifiedDemoStakeOnce429('));
});

test('589 previous order must settle with exact CLOSED receipt and independent empty OPEN proof', () => {
  const review = service.slice(service.indexOf('private fun inspectPassiveDemoProof463('),
    service.indexOf('private fun maybeRearmExpiredDemoPilot464('));
  for (const proof of [
    'verifiedClosedDetail437', 'closed.positionId', 'closed.pair != expectedPair',
    'closed.stakeCents != stake', 'closed.payoutPercent != payout',
    'brokerOpenTimeMatchesAttempt437', 'demoEmptyReviewReads',
    'onVerifiedClosed(', 'martingaleResultDurable581',
    '.putBoolean("attempted", false)'
  ]) assert.ok(review.includes(proof), proof);
  assert.ok(review.indexOf('onVerifiedClosed(') <
            review.indexOf('.putBoolean("attempted", false)'));
});

test('589 history exception never changes chart-only order gate or 92 percent MG', () => {
  assert.match(service, /private const val CHART_ONLY_DEMO_462 = true/);
  assert.match(plan, /PAYOUT_EXACT = 92/);
  assert.match(service, /tradePositionGate\.beginAttempt\(\)/);
  assert.match(service, /TouchTestService\.pressVerifiedDemoStakeOnce429\(/);
});
