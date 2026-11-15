import { createArmedRobot } from './armed.mjs';
import { createFxRotation } from './rotation.mjs';

export function createScalpAtlasController({ onOpenConfirmed } = {}) {
  const robot = createArmedRobot();
  const rotate = createFxRotation();
  let live = false;
  let pending = null;
  let brokerOrderId = null;

  return {
    setLive(enabled) {
      live = enabled === true;
      robot.setLive(live);
    },

    update(frame) {
      if (!live) return { action: 'STOP', status: 'OPRIT' };
      if (frame.account !== 'QT Demo') {
        rotate(frame);
        return { action: 'WAIT_FOR_DEMO', status: 'CONT DEMO NECONFIRMAT' };
      }
      const rotation = rotate({ ...frame, orderPending: pending !== null });
      if (rotation.action !== 'OBSERVE') return rotation;

      const result = robot.evaluate({ ...frame, pair: rotation.pair });
      if (!result.order) return { ...rotation, status: result.status };
      pending = result.order;
      brokerOrderId = null;
      return { action: 'SUBMIT_DEMO_ORDER', ...result };
    },

    reportOrder(receipt) {
      if (!pending || receipt?.token !== pending.token ||
          receipt.account !== 'QT Demo') return false;

      if (receipt.status === 'OPEN_CONFIRMED') {
        if (brokerOrderId !== null || typeof receipt.orderId !== 'string' ||
            !receipt.orderId.trim()) return false;
        brokerOrderId = receipt.orderId;
        onOpenConfirmed?.(receipt);
        return true;
      }

      if (receipt.status === 'CLOSED_CONFIRMED' &&
          (brokerOrderId === null || receipt.orderId !== brokerOrderId)) return false;
      if (receipt.status === 'REJECTED_CONFIRMED' && brokerOrderId !== null) return false;
      if (!robot.settle(receipt)) return false;
      pending = null;
      return true;
    },
  };
}
