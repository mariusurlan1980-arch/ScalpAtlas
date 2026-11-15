import { createScalpAtlasController } from './controller.mjs';

// The native adapter must verify the visible account and target in the same
// operation that performs a gesture. readFrame is read-only.
export function createScalpAtlasRuntime(adapter, { onOpenConfirmed } = {}) {
  const controller = createScalpAtlasController({ onOpenConfirmed });
  let live = false;
  let running = false;
  let pending = null;

  return {
    setLive(enabled) {
      live = enabled === true;
      controller.setLive(live);
    },

    async step() {
      if (!live) return { action: 'STOP' };
      if (running) return { action: 'BUSY' };
      running = true;
      try {
        if (pending) {
          const receipt = await adapter.readOrder(pending);
          if (receipt?.attemptId === pending.attemptId && controller.reportOrder({ ...receipt, token: pending.token }) &&
              receipt.status !== 'OPEN_CONFIRMED') pending = null;
          return { action: pending ? 'WAIT_FOR_CLOSE' : 'ORDER_RESOLVED' };
        }

        const orderStatus = await adapter.pollSavedOrderStatus();
        if (!live) return { action: 'STOP' };
        if (orderStatus !== 'IDLE' && orderStatus !== 'CLOSED') {
          return { action: 'WAIT_FOR_CLOSE', status: orderStatus };
        }

        const frame = await adapter.readFrame();
        if (!live) return { action: 'STOP' };
        const decision = controller.update(frame);
        if (decision.action === 'SELECT_PAIR') {
          await adapter.selectVerifiedDemoPair(decision.pair, frame.activePair);
        } else if (decision.action === 'SUBMIT_DEMO_ORDER') {
          pending = { ...decision.order, attemptId: globalThis.crypto.randomUUID() };
          // Keep the pending lock on transport errors. The gesture might have run.
          const receipt = await adapter.submitVerifiedDemoOrder(pending);
          if (receipt?.attemptId === pending.attemptId && controller.reportOrder({ ...receipt, token: pending.token }) &&
              receipt.status !== 'OPEN_CONFIRMED') pending = null;
        }
        return decision;
      } finally {
        running = false;
      }
    },
  };
}
