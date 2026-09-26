import test from "node:test";
import assert from "node:assert/strict";
import { createOrderFinanceRecord, EVENTS, STATES, transition } from "../src/index.js";
import { createPartnerPortalToken } from "../src/partner-links.js";
import { PartnerOrderService, canCapturePayment } from "../src/partner-service.js";
import { InMemoryOrderRepository } from "../src/storage.js";

const secret = "test-secret";

function setup() {
  let order = createOrderFinanceRecord({
    orderName: "#1001",
    shopifyOrderId: "order-1",
    total: 150,
    currency: "EUR",
    city: "Paris",
    authorizationExpiresAt: "2026-10-01T10:00:00Z"
  });

  Object.assign(order, {
    productTitle: "24 Red Roses",
    supplierCost: 80,
    recipient: { name: "Ana", address: "10 Rue Test", phone: "+331234" },
    photoRequired: true
  });
  order = transition(order, EVENTS.PARTNER_OFFERED, { partnerId: "p1" });

  const repository = new InMemoryOrderRepository([order]);
  const photoStore = {
    async saveBuffer() { return "/uploads/test.jpg"; }
  };
  const service = new PartnerOrderService({ repository, tokenSecret: secret, photoStore });
  const token = createPartnerPortalToken({
    orderId: order.id,
    partnerId: "p1",
    expiresAt: new Date(Date.now() + 60_000).toISOString()
  }, secret);
  const wrongToken = createPartnerPortalToken({
    orderId: order.id,
    partnerId: "p2",
    expiresAt: new Date(Date.now() + 60_000).toISOString()
  }, secret);

  return { service, repository, token, wrongToken };
}

test("only the currently offered florist can accept", async () => {
  const { service, token, wrongToken } = setup();
  const wrongView = await service.getOrderView(wrongToken);
  assert.deepEqual(wrongView.actions, []);
  await assert.rejects(() => service.applyAction(wrongToken, "ACCEPT"), /not allowed/);

  const view = await service.applyAction(token, "ACCEPT");
  assert.equal(view.recipient.address, "10 Rue Test");
  assert.deepEqual(view.actions, ["START_PREPARATION"]);
});

test("photo and delivery must be verified before capture becomes eligible", async () => {
  const { service, repository, token } = setup();

  await service.applyAction(token, "ACCEPT");
  await service.applyAction(token, "START_PREPARATION");
  await service.submitPhoto(token, Buffer.from("fake-image"), { mimeType: "image/jpeg" });

  let order = await repository.get("order-1");
  assert.equal(order.state, STATES.PHOTO_PENDING);
  assert.equal(canCapturePayment(order), false);

  await service.reviewPhoto("order-1", { approved: true });
  await service.applyAction(token, "START_DELIVERY");
  await service.applyAction(token, "CONFIRM_DELIVERY");

  order = await repository.get("order-1");
  assert.equal(order.state, STATES.DELIVERY_REPORTED);
  assert.equal(canCapturePayment(order), false);

  await service.verifyDelivery("order-1", { approved: true });
  order = await repository.get("order-1");
  assert.equal(order.state, STATES.CAPTURE_PENDING);
  assert.equal(canCapturePayment(order), true);
});
