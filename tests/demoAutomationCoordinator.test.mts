import test from 'node:test';
import assert from 'node:assert/strict';
import { DemoAutomationCoordinator } from '../scalp-atlas-new/demoAutomationCoordinator.ts';
const now = 1_000_000;
const event = {
  market: 'EURUSD', timeframe: 'M10', signal: 'BUY', state: 'SIGNAL',
  probability: 82, observedAt: now, price: 1.101, chartValid: true,
};
test('PAPER mode does not place external trades', async () => {
  const c = new DemoAutomationCoordinator(() => now);
  c.arm();
  assert.equal((await c.onVerifiedAnalysis(event, 'example')).status, 'PAPER_ONLY');
});
test('broker execution is blocked without an authorized DEMO adapter', async () => {
  const c = new DemoAutomationCoordinator(() => now);
  c.configure('BROKER_DEMO'); c.arm();
  assert.deepEqual(await c.onVerifiedAnalysis(event, 'example'),
    { status: 'BLOCKED', reason: 'AUTHORIZED_ADAPTER_REQUIRED' });
});
test('refuses REAL account even if an adapter exists', async () => {
  const c = new DemoAutomationCoordinator(() => now);
  let placed = 0;
  const adapter = {
    brokerId: 'example', isDemoAccount: async () => false,
    placeDemoOrder: async () => { placed++; return { confirmed: true, brokerOrderId: 'x' }; },
  };
  c.configure('BROKER_DEMO', adapter); c.arm();
  assert.equal((await c.onVerifiedAnalysis(event, 'example')).status, 'BLOCKED');
  assert.equal(placed, 0);
});
test('authorized DEMO adapter receives one attempt and no quick reversal', async () => {
  const c = new DemoAutomationCoordinator(() => now);
  let placed = 0;
  const adapter = {
    brokerId: 'example', isDemoAccount: async () => true,
    placeDemoOrder: async () => { placed++; return { confirmed: true, brokerOrderId: 'demo-1' }; },
  };
  c.configure('BROKER_DEMO', adapter); c.arm();
  assert.equal((await c.onVerifiedAnalysis(event, 'example')).status, 'DEMO_CONFIRMED');
  assert.equal((await c.onVerifiedAnalysis({ ...event, signal: 'SELL' }, 'example')).status, 'BLOCKED');
  assert.equal(placed, 1);
});
test('emergency stop disarms new orders', async () => {
  const c = new DemoAutomationCoordinator(() => now); c.arm(); c.emergencyStop();
  assert.equal((await c.onVerifiedAnalysis(event, 'example')).status, 'BLOCKED');
});
