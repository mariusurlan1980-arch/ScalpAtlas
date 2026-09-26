import test from "node:test";
import assert from "node:assert/strict";
import { createOrderFinanceRecord, EVENTS, STATES, transition } from "../src/index.js";

function order() {
  return createOrderFinanceRecord({
    orderName: "#TEST-1",
    shopifyOrderId: "gid://shopify/Order/test",
    total: 150,
    currency: "EUR",
    city: "Berlin",
    authorizationExpiresAt: "2026-10-01T10:00:00Z"
  });
}

function offeredOrder(partnerId="florist-1") {
  return transition(order(), EVENTS.PARTNER_OFFERED, {
    partnerId,
    offeredAt:"2026-09-26T10:00:00Z",
    expiresAt:"2026-09-26T10:10:00Z"
  });
}

function acceptedOrder() {
  return transition(offeredOrder(), EVENTS.PARTNER_ACCEPT, { partnerId: "florist-1" });
}

test("happy path never pays supplier before verified delivery and capture", () => {
  let o = acceptedOrder();
  o = transition(o, EVENTS.PREPARATION_STARTED);
  o = transition(o, EVENTS.PHOTO_SUBMITTED, { photoUrl: "https://example.test/bouquet.jpg" });
  o = transition(o, EVENTS.PHOTO_APPROVED);
  o = transition(o, EVENTS.DELIVERY_STARTED);
  o = transition(o, EVENTS.DELIVERY_REPORTED, { deliveryProof: "proof-1" });

  assert.equal(o.state, STATES.DELIVERY_REPORTED);
  assert.equal(o.paymentCaptured, false);
  assert.equal(o.supplierPaid, false);

  o = transition(o, EVENTS.DELIVERY_VERIFIED);
  assert.equal(o.state, STATES.CAPTURE_PENDING);

  o = transition(o, EVENTS.CAPTURE_SUCCEEDED, { captureReference: "cap-1" });
  assert.equal(o.state, STATES.PAYOUT_PENDING);
  assert.equal(o.supplierPaid, false);

  o = transition(o, EVENTS.PAYOUT_SUCCEEDED, { payoutReference: "pay-1" });
  assert.equal(o.state, STATES.COMPLETE);
  assert.equal(o.supplierPaid, true);
});

test("another florist cannot accept an offer", () => {
  const o = offeredOrder("florist-1");
  assert.throws(
    () => transition(o, EVENTS.PARTNER_ACCEPT, { partnerId: "florist-2" }),
    /another florist/
  );
});

test("rejected florist is recorded so it is not offered again", () => {
  const o = offeredOrder("florist-1");
  const next = transition(o, EVENTS.PARTNER_REJECT, { partnerId:"florist-1" });
  assert.deepEqual(next.attemptedPartnerIds,["florist-1"]);
  assert.equal(next.currentOfferedPartnerId,undefined);
});

test("all suppliers exhausted releases authorization when not captured", () => {
  let o = order();
  o = transition(o, EVENTS.START_ROUTING);
  o = transition(o, EVENTS.ALL_PARTNERS_EXHAUSTED);
  assert.equal(o.state, STATES.VOID_PENDING);
});

test("bad bouquet blocks automatic payout", () => {
  let o = acceptedOrder();
  o = transition(o, EVENTS.PREPARATION_STARTED);
  o = transition(o, EVENTS.PHOTO_SUBMITTED, { photoUrl: "https://example.test/bad.jpg" });
  o = transition(o, EVENTS.PHOTO_REJECTED, { reason: "Wrong rose count" });

  assert.equal(o.state, STATES.EXCEPTION);
  assert.equal(o.supplierPaid, false);
});
