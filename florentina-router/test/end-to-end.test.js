import test from "node:test";
import assert from "node:assert/strict";
import { createOrderFinanceRecord, STATES } from "../src/index.js";
import { createPartnerPortalToken } from "../src/partner-links.js";
import { InMemoryOrderRepository } from "../src/storage.js";
import { InMemoryPartnerDirectory, RoutingEngine } from "../src/routing-engine.js";
import { PartnerOrderService } from "../src/partner-service.js";
import { FinancialOrchestrator } from "../src/financial-orchestrator.js";
import { SupplierPayoutOrchestrator } from "../src/supplier-payout.js";

test("complete dry-run order reaches paid supplier and keeps margin", async () => {
  const now = Date.parse("2026-09-26T14:00:00Z");
  let order = createOrderFinanceRecord({
    orderName:"#DEMO-FULL-1",
    shopifyOrderId:"demo-full-1",
    total:150,
    currency:"EUR",
    city:"Paris",
    authorizationExpiresAt:"2026-10-01T12:00:00Z"
  });

  Object.assign(order, {
    productId:"product-24-red-roses",
    productTitle:"24 Red Roses",
    deliveryDate:"2026-09-27",
    referenceImageUrl:"https://example.test/24-red.jpg",
    recipient:{name:"Demo Recipient",address:"10 Rue Demo",phone:"+33600000000"},
    greetingMessage:"With love",
    matchStandard:"STRICT_EXACT_99",
    substitutionPolicy:"Exactly 24 red roses.",
    photoRequired:true,
    paymentFees:4
  });

  const repository = new InMemoryOrderRepository([order]);
  const partner = {
    id:"florist-paris-1",
    name:"Demo Florist Paris",
    city:"Paris",
    priority:1,
    active:true,
    certifiedProductIds:["product-24-red-roses"],
    quoteId:"quote-demo-1",
    supplierCost:85,
    supplierCurrency:"EUR",
    payoutMode:"after_delivery_confirmation",
    payoutCurrency:"EUR",
    payoutProvider:"demo-sepa",
    payoutOnboardingStatus:"verified",
    payoutAccountReference:"beneficiary-demo-1",
    payoutEnabled:true
  };

  let portalUrl="";
  const routingEngine = new RoutingEngine({
    repository,
    partnerDirectory:new InMemoryPartnerDirectory([partner]),
    notifier:{
      async sendOffer(input){
        portalUrl=input.portalUrl;
        return {channel:"demo",messageId:"offer-1"};
      }
    },
    tokenSecret:"e2e-secret",
    portalBaseUrl:"https://partner.demo",
    responseMinutes:10,
    maxAttempts:5,
    clock:()=>now
  });

  order = await routingEngine.start(order.id);
  assert.equal(order.state,STATES.OFFERING_TO_PARTNER);
  assert.equal(order.currentOfferedPartnerId,partner.id);
  assert.equal(order.supplierCost,85);
  assert.equal(order.supplierPayoutEnabled,true);

  const token = new URL(portalUrl).searchParams.get("token");
  assert.ok(token);

  const service = new PartnerOrderService({
    repository,
    tokenSecret:"e2e-secret",
    routingEngine,
    clock:()=>now,
    photoStore:{
      async saveBuffer(){return "/uploads/demo.jpg";}
    }
  });

  let view = await service.applyAction(token,"ACCEPT");
  assert.equal(view.recipient.address,"10 Rue Demo");

  await service.applyAction(token,"START_PREPARATION");
  await service.submitPhoto(token,Buffer.from("demo-photo"),{mimeType:"image/jpeg"});
  await service.reviewPhoto(order.id,{approved:true});
  await service.applyAction(token,"START_DELIVERY");
  await service.applyAction(token,"CONFIRM_DELIVERY");

  order = await repository.get(order.id);
  assert.equal(order.state,STATES.DELIVERY_REPORTED);
  assert.equal(order.paymentCaptured,false);

  await service.verifyDelivery(order.id,{approved:true});
  order = await repository.get(order.id);
  assert.equal(order.state,STATES.CAPTURE_PENDING);

  const paymentCalls=[];
  const financial = new FinancialOrchestrator({
    repository,
    clock:()=>now,
    paymentProvider:{
      async captureAuthorizedPayment(orderId){
        paymentCalls.push(orderId);
        return {captureReference:"capture-demo-1",amount:"150.00",currency:"EUR"};
      },
      async voidAuthorization(){throw new Error("not expected");}
    }
  });

  order = await financial.processOrder(order.id);
  assert.equal(order.state,STATES.PAYOUT_PENDING);
  assert.equal(order.paymentCaptured,true);
  assert.deepEqual(paymentCalls,["demo-full-1"]);

  const payoutCalls=[];
  const payout = new SupplierPayoutOrchestrator({
    repository,
    clock:()=>now,
    payoutProvider:{
      async paySupplier(instruction){
        payoutCalls.push(instruction);
        return {payoutReference:"payout-demo-1",amount:85,currency:"EUR"};
      }
    }
  });

  order = await payout.processOrder(order.id);
  assert.equal(order.state,STATES.COMPLETE);
  assert.equal(order.supplierPaid,true);
  assert.equal(order.grossMarginBeforeFees,65);
  assert.equal(order.marginAfterKnownPaymentFees,61);
  assert.equal(payoutCalls[0].amount,85);
  assert.equal(payoutCalls[0].accountReference,"beneficiary-demo-1");

  const audit = await repository.listAudit();
  const events = audit.map(x=>x.event);
  for (const required of [
    "ROUTING_STARTED",
    "PARTNER_OFFERED",
    "ACCEPT",
    "PHOTO_SUBMITTED",
    "PHOTO_APPROVED",
    "CONFIRM_DELIVERY",
    "DELIVERY_VERIFIED",
    "PAYMENT_CAPTURED",
    "SUPPLIER_PAYOUT_SUCCEEDED"
  ]) {
    assert.ok(events.includes(required), `missing audit event ${required}`);
  }
});
