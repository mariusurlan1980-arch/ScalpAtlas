import { STATES } from "./state-machine.js";

const ACTIONS_BY_STATE = Object.freeze({
  [STATES.OFFERING_TO_PARTNER]: ["ACCEPT", "REJECT"],
  [STATES.PARTNER_ACCEPTED]: ["START_PREPARATION"],
  [STATES.PREPARING]: ["UPLOAD_PHOTO"],
  [STATES.PHOTO_PENDING]: [],
  [STATES.PHOTO_APPROVED]: ["START_DELIVERY"],
  [STATES.OUT_FOR_DELIVERY]: ["CONFIRM_DELIVERY"],
  [STATES.CAPTURE_PENDING]: [],
  [STATES.PAYOUT_PENDING]: [],
  [STATES.COMPLETE]: []
});

export function allowedPartnerActions(order) {
  return ACTIONS_BY_STATE[order.state] ?? [];
}

export function buildPartnerOrderView(order, partner) {
  if (!order || !partner) throw new Error("Order and partner are required");

  const accepted = Boolean(order.partnerId && order.partnerId === partner.id);

  return {
    orderName: order.orderName,
    state: order.state,
    productTitle: order.productTitle ?? "",
    referenceImageUrl: order.referenceImageUrl ?? "",
    floristPrice: order.supplierCost ?? null,
    currency: order.currency ?? "EUR",
    deliveryCity: order.city ?? "",
    deliveryDate: order.deliveryDate ?? "",
    recipient: accepted ? {
      name: order.recipient?.name ?? "",
      address: order.recipient?.address ?? "",
      phone: order.recipient?.phone ?? ""
    } : null,
    greetingMessage: accepted ? (order.greetingMessage ?? "") : "",
    standard: {
      matchStandard: order.matchStandard ?? "",
      substitutionPolicy: order.substitutionPolicy ?? "",
      photoRequired: order.photoRequired !== false
    },
    actions: allowedPartnerActions(order),
    privacyNotice: accepted
      ? "Recipient details are visible because this florist accepted the order."
      : "Recipient address and phone stay hidden until the order is accepted."
  };
}
