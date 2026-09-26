import test from "node:test";
import assert from "node:assert/strict";
import { createOrderFinanceRecord, EVENTS, STATES, transition } from "../src/index.js";
import { FinancialOrchestrator } from "../src/financial-orchestrator.js";
import { InMemoryOrderRepository } from "../src/storage.js";

function baseOrder(id="order-fin-1"){
  return createOrderFinanceRecord({
    orderName:"#FIN-1",
    shopifyOrderId:id,
    total:150,
    currency:"EUR",
    city:"Paris",
    authorizationExpiresAt:"2026-10-01T10:00:00Z"
  });
}

test("captures only after photo and delivery are verified",async()=>{
  let order=baseOrder();
  order.state=STATES.CAPTURE_PENDING;
  order.photoApproved=true;
  order.deliveryVerified=true;

  const repository=new InMemoryOrderRepository([order]);
  const calls=[];
  const paymentProvider={
    async captureAuthorizedPayment(id){
      calls.push(["capture",id]);
      return {captureReference:"cap-1",amount:"150.00",currency:"EUR"};
    },
    async voidAuthorization(){throw new Error("not expected");}
  };
  const worker=new FinancialOrchestrator({repository,paymentProvider});
  const result=await worker.processOrder(order.id);

  assert.equal(result.state,STATES.PAYOUT_PENDING);
  assert.equal(result.paymentCaptured,true);
  assert.equal(result.captureReference,"cap-1");
  assert.deepEqual(calls,[["capture",order.shopifyOrderId]]);
});

test("capture is blocked if delivery verification is missing",async()=>{
  let order=baseOrder();
  order.state=STATES.CAPTURE_PENDING;
  order.photoApproved=true;
  order.deliveryVerified=false;

  const repository=new InMemoryOrderRepository([order]);
  const worker=new FinancialOrchestrator({
    repository,
    paymentProvider:{
      async captureAuthorizedPayment(){throw new Error("must not call");},
      async voidAuthorization(){throw new Error("must not call");}
    }
  });

  await assert.rejects(()=>worker.processOrder(order.id),/safety gate/);
});

test("voids authorization after all florists are exhausted",async()=>{
  let order=baseOrder();
  order=transition(order,EVENTS.START_ROUTING);
  order=transition(order,EVENTS.ALL_PARTNERS_EXHAUSTED);
  assert.equal(order.state,STATES.VOID_PENDING);

  const repository=new InMemoryOrderRepository([order]);
  const paymentProvider={
    async captureAuthorizedPayment(){throw new Error("not expected");},
    async voidAuthorization(id){
      assert.equal(id,order.shopifyOrderId);
      return {voidReference:"void-1"};
    }
  };
  const worker=new FinancialOrchestrator({repository,paymentProvider});
  const result=await worker.processOrder(order.id);

  assert.equal(result.state,STATES.VOIDED);
  assert.equal(result.voidReference,"void-1");
});

test("temporary provider error leaves payment pending and schedules retry",async()=>{
  let order=baseOrder();
  order.state=STATES.CAPTURE_PENDING;
  order.photoApproved=true;
  order.deliveryVerified=true;

  const now=Date.parse("2026-09-26T10:00:00Z");
  const repository=new InMemoryOrderRepository([order]);
  const worker=new FinancialOrchestrator({
    repository,
    clock:()=>now,
    retryMinutes:2,
    paymentProvider:{
      async captureAuthorizedPayment(){throw new Error("network");},
      async voidAuthorization(){throw new Error("not expected");}
    }
  });

  const result=await worker.processOrder(order.id);
  assert.equal(result.state,STATES.CAPTURE_PENDING);
  assert.equal(result.lastFinancialErrorCode,"CAPTURE_ATTEMPT_FAILED");
  assert.equal(result.financialRetryAfter,"2026-09-26T10:02:00.000Z");
});
