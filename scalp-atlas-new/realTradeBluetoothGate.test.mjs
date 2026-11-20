import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareRealTouchIntent } from './realTradeBluetoothGate.ts';

const now = 100_000;
const signal = { id: 's-1', account: 'REAL', direction: 'BUY', pair: 'EUR/USD OTC', timeframe: 'M5', payoutPercent: 92, emittedAtMs: now - 1000 };
const context = { nowMs: now, confirmedSignalId: 's-1', brokerApprovedExternalActuator: true, bluetoothPaired: true, capacitiveTwoChannelDeviceVerified: true, touchPositionsCalibrated: true, openTrade: false };
const decide = (signalOverride = {}, contextOverride = {}) => prepareRealTouchIntent({ ...signal, ...signalOverride }, { ...context, ...contextOverride });

test('BUY uses channel A only after all explicit gates pass', () => {
  const result = decide();
  assert.equal(result.allowed, true);
  assert.equal(result.intent.channel, 'A');
});
test('SELL uses channel B', () => {
  const result = decide({ direction: 'SELL' });
  assert.equal(result.allowed, true);
  assert.equal(result.intent.channel, 'B');
});
test('never prepares REAL touch for DEMO signal', () => assert.equal(decide({ account: 'DEMO' }).allowed, false));
test('never prepares touch without manual confirmation', () => assert.equal(decide({}, { confirmedSignalId: null }).allowed, false));
test('never prepares touch without explicit broker approval', () => assert.equal(decide({}, { brokerApprovedExternalActuator: false }).allowed, false));
test('never prepares touch for an unpaired device', () => assert.equal(decide({}, { bluetoothPaired: false }).allowed, false));
test('never prepares touch for uncalibrated buttons', () => assert.equal(decide({}, { touchPositionsCalibrated: false }).allowed, false));
test('never prepares touch during another trade', () => assert.equal(decide({}, { openTrade: true }).allowed, false));
test('never prepares touch for stale signals', () => assert.equal(decide({ emittedAtMs: now - 9000 }).allowed, false));
test('never prepares touch under minimum payout', () => assert.equal(decide({ payoutPercent: 89 }).allowed, false));
