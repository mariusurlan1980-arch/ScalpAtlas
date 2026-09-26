export const STATES = Object.freeze({
  PAYMENT_AUTHORIZED: "PAYMENT_AUTHORIZED",
  OFFERING_TO_PARTNER: "OFFERING_TO_PARTNER",
  PARTNER_ACCEPTED: "PARTNER_ACCEPTED",
  PREPARING: "PREPARING",
  PHOTO_PENDING: "PHOTO_PENDING",
  PHOTO_APPROVED: "PHOTO_APPROVED",
  OUT_FOR_DELIVERY: "OUT_FOR_DELIVERY",
  DELIVERY_REPORTED: "DELIVERY_REPORTED",
  CAPTURE_PENDING: "CAPTURE_PENDING",
  PAYMENT_CAPTURED: "PAYMENT_CAPTURED",
  PAYOUT_PENDING: "PAYOUT_PENDING",
  COMPLETE: "COMPLETE",
  VOID_PENDING: "VOID_PENDING",
  VOIDED: "VOIDED",
  REFUND_PENDING: "REFUND_PENDING",
  REFUNDED: "REFUNDED",
  EXCEPTION: "EXCEPTION"
});

export const EVENTS = Object.freeze({
  START_ROUTING: "START_ROUTING",
  PARTNER_OFFERED: "PARTNER_OFFERED",
  PARTNER_ACCEPT: "PARTNER_ACCEPT",
  PARTNER_REJECT: "PARTNER_REJECT",
  PARTNER_TIMEOUT: "PARTNER_TIMEOUT",
  PREPARATION_STARTED: "PREPARATION_STARTED",
  PHOTO_SUBMITTED: "PHOTO_SUBMITTED",
  PHOTO_APPROVED: "PHOTO_APPROVED",
  PHOTO_REJECTED: "PHOTO_REJECTED",
  DELIVERY_STARTED: "DELIVERY_STARTED",
  DELIVERY_REPORTED: "DELIVERY_REPORTED",
  DELIVERY_CONFIRMED: "DELIVERY_CONFIRMED",
  DELIVERY_VERIFIED: "DELIVERY_VERIFIED",
  DELIVERY_REJECTED: "DELIVERY_REJECTED",
  CAPTURE_SUCCEEDED: "CAPTURE_SUCCEEDED",
  CAPTURE_FAILED: "CAPTURE_FAILED",
  PAYOUT_SUCCEEDED: "PAYOUT_SUCCEEDED",
  PAYOUT_FAILED: "PAYOUT_FAILED",
  ALL_PARTNERS_EXHAUSTED: "ALL_PARTNERS_EXHAUSTED",
  VOID_SUCCEEDED: "VOID_SUCCEEDED",
  REFUND_SUCCEEDED: "REFUND_SUCCEEDED"
});

export function transition(order, event, payload = {}) {
  const next = structuredClone(order);

  switch (event) {
    case EVENTS.START_ROUTING:
      requireState(order, STATES.PAYMENT_AUTHORIZED);
      next.state = STATES.OFFERING_TO_PARTNER;
      break;

    case EVENTS.PARTNER_OFFERED:
      if (![STATES.PAYMENT_AUTHORIZED, STATES.OFFERING_TO_PARTNER].includes(order.state)) {
        throw new Error(`Invalid partner offer from ${order.state}`);
      }
      next.currentOfferedPartnerId = required(payload.partnerId, "partnerId");
      next.state = STATES.OFFERING_TO_PARTNER;
      break;

    case EVENTS.PARTNER_ACCEPT:
      requireState(order, STATES.OFFERING_TO_PARTNER);
      requireOfferedPartner(order, payload.partnerId);
      next.partnerId = required(payload.partnerId, "partnerId");
      delete next.currentOfferedPartnerId;
      next.state = STATES.PARTNER_ACCEPTED;
      break;

    case EVENTS.PARTNER_REJECT:
      requireState(order, STATES.OFFERING_TO_PARTNER);
      requireOfferedPartner(order, payload.partnerId);
      next.partnerAttempt = (order.partnerAttempt ?? 1) + 1;
      delete next.currentOfferedPartnerId;
      next.state = STATES.OFFERING_TO_PARTNER;
      break;

    case EVENTS.PARTNER_TIMEOUT:
      requireState(order, STATES.OFFERING_TO_PARTNER);
      next.partnerAttempt = (order.partnerAttempt ?? 1) + 1;
      delete next.currentOfferedPartnerId;
      next.state = STATES.OFFERING_TO_PARTNER;
      break;

    case EVENTS.ALL_PARTNERS_EXHAUSTED:
      requireState(order, STATES.OFFERING_TO_PARTNER);
      next.state = order.paymentCaptured ? STATES.REFUND_PENDING : STATES.VOID_PENDING;
      break;

    case EVENTS.PREPARATION_STARTED:
      requireState(order, STATES.PARTNER_ACCEPTED);
      next.state = STATES.PREPARING;
      break;

    case EVENTS.PHOTO_SUBMITTED:
      requireState(order, STATES.PREPARING);
      next.photoUrl = required(payload.photoUrl, "photoUrl");
      next.state = STATES.PHOTO_PENDING;
      break;

    case EVENTS.PHOTO_APPROVED:
      requireState(order, STATES.PHOTO_PENDING);
      next.photoApproved = true;
      next.state = STATES.PHOTO_APPROVED;
      break;

    case EVENTS.PHOTO_REJECTED:
      requireState(order, STATES.PHOTO_PENDING);
      next.photoApproved = false;
      next.exceptionReason = payload.reason ?? "Product does not meet standard";
      next.state = STATES.EXCEPTION;
      break;

    case EVENTS.DELIVERY_STARTED:
      requireState(order, STATES.PHOTO_APPROVED);
      next.state = STATES.OUT_FOR_DELIVERY;
      break;

    case EVENTS.DELIVERY_REPORTED:
    case EVENTS.DELIVERY_CONFIRMED:
      requireState(order, STATES.OUT_FOR_DELIVERY);
      next.deliveryProof = required(payload.deliveryProof, "deliveryProof");
      next.deliveryReportedAt = new Date().toISOString();
      next.state = STATES.DELIVERY_REPORTED;
      break;

    case EVENTS.DELIVERY_VERIFIED:
      requireState(order, STATES.DELIVERY_REPORTED);
      next.deliveryVerified = true;
      next.deliveryVerifiedAt = new Date().toISOString();
      next.state = STATES.CAPTURE_PENDING;
      break;

    case EVENTS.DELIVERY_REJECTED:
      requireState(order, STATES.DELIVERY_REPORTED);
      next.deliveryVerified = false;
      next.exceptionReason = payload.reason ?? "Delivery could not be verified";
      next.state = STATES.EXCEPTION;
      break;

    case EVENTS.CAPTURE_SUCCEEDED:
      requireState(order, STATES.CAPTURE_PENDING);
      next.paymentCaptured = true;
      next.captureReference = required(payload.captureReference, "captureReference");
      next.state = STATES.PAYOUT_PENDING;
      break;

    case EVENTS.CAPTURE_FAILED:
      requireState(order, STATES.CAPTURE_PENDING);
      next.exceptionReason = payload.reason ?? "Payment capture failed";
      next.state = STATES.EXCEPTION;
      break;

    case EVENTS.PAYOUT_SUCCEEDED:
      requireState(order, STATES.PAYOUT_PENDING);
      next.supplierPaid = true;
      next.payoutReference = required(payload.payoutReference, "payoutReference");
      next.state = STATES.COMPLETE;
      break;

    case EVENTS.PAYOUT_FAILED:
      requireState(order, STATES.PAYOUT_PENDING);
      next.exceptionReason = payload.reason ?? "Supplier payout failed";
      next.state = STATES.EXCEPTION;
      break;

    case EVENTS.VOID_SUCCEEDED:
      requireState(order, STATES.VOID_PENDING);
      next.state = STATES.VOIDED;
      break;

    case EVENTS.REFUND_SUCCEEDED:
      requireState(order, STATES.REFUND_PENDING);
      next.state = STATES.REFUNDED;
      break;

    default:
      throw new Error(`Unknown event: ${event}`);
  }

  next.updatedAt = new Date().toISOString();
  return next;
}

function requireState(order, state) {
  if (order.state !== state) {
    throw new Error(`Invalid transition from ${order.state}; expected ${state}`);
  }
}

function requireOfferedPartner(order, partnerId) {
  if (!order.currentOfferedPartnerId) {
    throw new Error("No florist is currently assigned this offer");
  }
  if (order.currentOfferedPartnerId !== partnerId) {
    throw new Error("This offer belongs to another florist");
  }
}

function required(value, name) {
  if (value === undefined || value === null || value === "") {
    throw new Error(`Missing required field: ${name}`);
  }
  return value;
}
