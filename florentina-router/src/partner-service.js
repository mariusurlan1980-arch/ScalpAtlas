import { verifyPartnerPortalToken } from "./partner-links.js";
import { allowedPartnerActions, buildPartnerOrderView } from "./partner-portal-model.js";
import { EVENTS, STATES, transition } from "./state-machine.js";

const ACTION_EVENT = Object.freeze({
  ACCEPT: EVENTS.PARTNER_ACCEPT,
  REJECT: EVENTS.PARTNER_REJECT,
  START_PREPARATION: EVENTS.PREPARATION_STARTED,
  START_DELIVERY: EVENTS.DELIVERY_STARTED,
  CONFIRM_DELIVERY: EVENTS.DELIVERY_REPORTED
});

export class PartnerOrderService {
  constructor({ repository, tokenSecret, photoStore }) {
    this.repository = repository;
    this.tokenSecret = tokenSecret;
    this.photoStore = photoStore;
  }

  async getOrderView(token) {
    const identity = this.#identity(token);
    const order = await this.#order(identity.orderId);
    return buildPartnerOrderView(order, { id: identity.partnerId });
  }

  async applyAction(token, action, payload = {}) {
    const identity = this.#identity(token);
    const order = await this.#order(identity.orderId);
    const partner = { id: identity.partnerId };
    const allowed = allowedPartnerActions(order, partner);

    if (!allowed.includes(action)) {
      throw new Error("Action not allowed for this florist or order state");
    }

    const event = ACTION_EVENT[action];
    if (!event) throw new Error("Unsupported florist action");

    const eventPayload = {};
    if (action === "ACCEPT" || action === "REJECT") {
      eventPayload.partnerId = identity.partnerId;
    }
    if (action === "CONFIRM_DELIVERY") {
      eventPayload.deliveryProof =
        payload.deliveryProof || `partner-report:${new Date().toISOString()}`;
    }

    const next = transition(order, event, eventPayload);
    await this.repository.save(next);
    await this.#audit(next, identity.partnerId, action);

    return buildPartnerOrderView(next, partner);
  }

  async submitPhoto(token, buffer, metadata) {
    const identity = this.#identity(token);
    const order = await this.#order(identity.orderId);
    const partner = { id: identity.partnerId };

    if (!allowedPartnerActions(order, partner).includes("UPLOAD_PHOTO")) {
      throw new Error("Photo upload is not allowed for this florist or order state");
    }
    if (!this.photoStore) throw new Error("Photo storage is not configured");

    const photoUrl = await this.photoStore.saveBuffer(buffer, metadata);
    const next = transition(order, EVENTS.PHOTO_SUBMITTED, { photoUrl });
    await this.repository.save(next);
    await this.#audit(next, identity.partnerId, "PHOTO_SUBMITTED");

    return buildPartnerOrderView(next, partner);
  }

  async offerToPartner(orderId, partnerId) {
    const order = await this.#order(orderId);
    const next = transition(order, EVENTS.PARTNER_OFFERED, { partnerId });
    await this.repository.save(next);
    await this.#audit(next, partnerId, "PARTNER_OFFERED");
    return next;
  }

  async reviewPhoto(orderId, { approved, reason }) {
    const order = await this.#order(orderId);
    const event = approved ? EVENTS.PHOTO_APPROVED : EVENTS.PHOTO_REJECTED;
    const next = transition(order, event, { reason });
    await this.repository.save(next);
    await this.#audit(next, order.partnerId, approved ? "PHOTO_APPROVED" : "PHOTO_REJECTED");
    return next;
  }

  async verifyDelivery(orderId, { approved, reason }) {
    const order = await this.#order(orderId);
    const event = approved ? EVENTS.DELIVERY_VERIFIED : EVENTS.DELIVERY_REJECTED;
    const next = transition(order, event, { reason });
    await this.repository.save(next);
    await this.#audit(next, order.partnerId, approved ? "DELIVERY_VERIFIED" : "DELIVERY_REJECTED");
    return next;
  }

  #identity(token) {
    const result = verifyPartnerPortalToken(token, this.tokenSecret);
    if (!result.valid) throw new Error(`Invalid partner link: ${result.reason}`);
    return result.data;
  }

  async #order(id) {
    const order = await this.repository.get(id);
    if (!order) throw new Error("Order not found");
    return order;
  }

  async #audit(order, partnerId, event) {
    await this.repository.appendAudit({
      orderId: order.id,
      partnerId: partnerId ?? null,
      event,
      state: order.state,
      at: new Date().toISOString()
    });
  }
}

export function canCapturePayment(order) {
  return order.state === STATES.CAPTURE_PENDING &&
    order.deliveryVerified === true &&
    order.photoApproved === true &&
    order.paymentCaptured !== true;
}
