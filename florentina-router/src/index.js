import { EVENTS, STATES, transition } from "./state-machine.js";

export function createOrderFinanceRecord({
  orderName,
  shopifyOrderId,
  total,
  currency,
  city,
  authorizationExpiresAt
}) {
  return {
    orderName,
    shopifyOrderId,
    total,
    currency,
    city,
    authorizationExpiresAt,
    state: STATES.PAYMENT_AUTHORIZED,
    partnerAttempt: 1,
    paymentCaptured: false,
    supplierPaid: false,
    photoApproved: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

export { EVENTS, STATES, transition };
