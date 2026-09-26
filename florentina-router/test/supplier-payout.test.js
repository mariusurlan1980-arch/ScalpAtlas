import test from "node:test";
import assert from "node:assert/strict";
import { STATES } from "../src/state-machine.js";
import { InMemoryOrderRepository } from "../src/storage.js";
import { SupplierPayoutOrchestrator, payoutSafetyGate } from "../src/supplier-payout.js";

function readyOrder(){
  return {
    id:"order-payout-1",
    orderName:"#P-1",
    shopifyOrderId:"gid://shopify/Order/1",
    state:STATES.PAYOUT_PENDING,
    paymentCaptured:true,
    capturedAmount:"150.00",
    capturedCurrency:"EUR",
    deliveryVerified:true,
    photoApproved:true,
    partnerId:"florist-1",
    supplierCost:85,
    supplierCurrency:"EUR",
    supplierPayoutCurrency:"EUR",
    supplierPayoutProvider:"bank-provider",
    supplierPayoutAccountReference:"beneficiary-123",
    supplierPayoutOnboardingStatus:"verified",
    supplierPayoutEnabled:true,
    supplierPaid:false
  };
}

test("verified florist can be paid and positive margin remains",async()=>{
  const order=readyOrder();
  const gate=payoutSafetyGate(order);
  assert.equal(gate.ok,true);
  assert.equal(gate.grossMarginBeforeFees,65);

  const repository=new InMemoryOrderRepository([order]);
  const calls=[];
  const payoutProvider={
    async paySupplier(instruction){
      calls.push(instruction);
      return {payoutReference:"pay-123",amount:85,currency:"EUR"};
    }
  };
  const worker=new SupplierPayoutOrchestrator({repository,payoutProvider});
  const result=await worker.processOrder(order.id);

  assert.equal(result.state,STATES.COMPLETE);
  assert.equal(result.supplierPaid,true);
  assert.equal(result.payoutReference,"pay-123");
  assert.equal(calls.length,1);
  assert.equal(calls[0].idempotencyKey,"ff:order-payout-1:supplier-payout:v1");
});

test("unverified florist is blocked and provider is never called",async()=>{
  const order={...readyOrder(),supplierPayoutOnboardingStatus:"not_connected"};
  const repository=new InMemoryOrderRepository([order]);
  let called=false;
  const worker=new SupplierPayoutOrchestrator({
    repository,
    payoutProvider:{async paySupplier(){called=true;throw new Error("must not call");}}
  });
  const result=await worker.processOrder(order.id);

  assert.equal(called,false);
  assert.equal(result.state,STATES.PAYOUT_PENDING);
  assert.equal(result.supplierPayoutStatus,"BLOCKED");
  assert.equal(result.supplierPayoutBlockReason,"FLORIST_PAYOUT_NOT_VERIFIED");
});

test("payout disabled florist is blocked",()=>{
  const gate=payoutSafetyGate({...readyOrder(),supplierPayoutEnabled:false});
  assert.equal(gate.ok,false);
  assert.equal(gate.reason,"FLORIST_PAYOUT_DISABLED");
});

test("supplier cannot receive amount that removes positive margin",()=>{
  const gate=payoutSafetyGate({...readyOrder(),supplierCost:150});
  assert.equal(gate.ok,false);
  assert.equal(gate.reason,"NO_POSITIVE_MARGIN");
});

test("temporary payout error keeps order pending for retry",async()=>{
  const now=Date.parse("2026-09-26T13:40:00Z");
  const order=readyOrder();
  const repository=new InMemoryOrderRepository([order]);
  const worker=new SupplierPayoutOrchestrator({
    repository,
    clock:()=>now,
    retryMinutes:5,
    payoutProvider:{async paySupplier(){throw new Error("bank offline");}}
  });

  const result=await worker.processOrder(order.id);
  assert.equal(result.state,STATES.PAYOUT_PENDING);
  assert.equal(result.supplierPayoutStatus,"RETRY");
  assert.equal(result.payoutRetryAfter,"2026-09-26T13:45:00.000Z");
});
