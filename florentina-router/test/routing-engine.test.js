import test from "node:test";
import assert from "node:assert/strict";
import { createOrderFinanceRecord, EVENTS, STATES, transition } from "../src/index.js";
import { InMemoryOrderRepository } from "../src/storage.js";
import { InMemoryPartnerDirectory, RoutingEngine } from "../src/routing-engine.js";

function makeOrder() {
  const order = createOrderFinanceRecord({
    orderName:"#R-1",
    shopifyOrderId:"order-route-1",
    total:150,
    currency:"EUR",
    city:"Berlin",
    authorizationExpiresAt:"2026-10-01T12:00:00Z"
  });
  order.productId="p-red-24";
  return order;
}

function partners(count=5) {
  return Array.from({length:count},(_,i)=>({
    id:`f${i+1}`,
    name:`Florist ${i+1}`,
    city:"Berlin",
    priority:i+1,
    active:true,
    certifiedProductIds:["p-red-24"]
  }));
}

function setup({count=5, now=Date.parse("2026-09-26T10:00:00Z")}={}) {
  const repository=new InMemoryOrderRepository([makeOrder()]);
  const sent=[];
  const notifier={async sendOffer(x){sent.push(x);}};
  let current=now;
  const engine=new RoutingEngine({
    repository,
    partnerDirectory:new InMemoryPartnerDirectory(partners(count)),
    notifier,
    tokenSecret:"routing-secret",
    portalBaseUrl:"https://partners.example.test",
    responseMinutes:10,
    maxAttempts:5,
    clock:()=>current
  });
  return {repository,engine,sent,setNow:v=>{current=v;}};
}

test("starts with priority 1 and a ten-minute deadline",async()=>{
  const {repository,engine,sent}=setup();
  const order=await engine.start("order-route-1");
  assert.equal(order.currentOfferedPartnerId,"f1");
  assert.equal(order.offerExpiresAt,"2026-09-26T10:10:00.000Z");
  assert.equal(sent.length,1);
  assert.equal(sent[0].partner.id,"f1");
  assert.match(sent[0].portalUrl,/\/partner\?token=/);
  assert.equal((await repository.get("order-route-1")).state,STATES.OFFERING_TO_PARTNER);
});

test("timeout moves automatically from florist 1 to florist 2",async()=>{
  const {repository,engine,sent,setNow}=setup();
  await engine.start("order-route-1");
  setNow(Date.parse("2026-09-26T10:10:01Z"));
  await engine.processDueOffers();

  const order=await repository.get("order-route-1");
  assert.equal(order.currentOfferedPartnerId,"f2");
  assert.deepEqual(order.attemptedPartnerIds,["f1"]);
  assert.equal(sent.length,2);
});

test("rejection advances immediately to next florist",async()=>{
  const {repository,engine}=setup();
  let order=await engine.start("order-route-1");
  order=transition(order,EVENTS.PARTNER_REJECT,{partnerId:"f1"});
  order.attemptedPartnerIds=["f1"];
  await repository.save(order);

  await engine.advanceAfterPartnerDecision(order.id);
  order=await repository.get(order.id);
  assert.equal(order.currentOfferedPartnerId,"f2");
});

test("after five unsuccessful florists authorization goes to void path",async()=>{
  const {repository,engine,setNow}=setup();
  await engine.start("order-route-1");

  for(let i=0;i<5;i++){
    const current=await repository.get("order-route-1");
    if(current.state!==STATES.OFFERING_TO_PARTNER || !current.currentOfferedPartnerId) break;
    setNow(new Date(current.offerExpiresAt).getTime()+1);
    await engine.processDueOffers();
  }

  const final=await repository.get("order-route-1");
  assert.equal(final.state,STATES.VOID_PENDING);
  assert.deepEqual(final.attemptedPartnerIds,["f1","f2","f3","f4","f5"]);
});

test("inactive or uncertified florist is skipped",async()=>{
  const order=makeOrder();
  const repository=new InMemoryOrderRepository([order]);
  const sent=[];
  const directory=new InMemoryPartnerDirectory([
    {id:"skip-inactive",city:"Berlin",priority:1,active:false,certifiedProductIds:["p-red-24"]},
    {id:"skip-product",city:"Berlin",priority:2,active:true,certifiedProductIds:["other"]},
    {id:"ok",city:"Berlin",priority:3,active:true,certifiedProductIds:["p-red-24"]}
  ]);
  const engine=new RoutingEngine({
    repository,partnerDirectory:directory,
    notifier:{async sendOffer(x){sent.push(x);}},
    tokenSecret:"secret",portalBaseUrl:"https://partner.test",
    responseMinutes:10,maxAttempts:5
  });
  const routed=await engine.start(order.id);
  assert.equal(routed.currentOfferedPartnerId,"ok");
  assert.equal(sent.length,1);
});
