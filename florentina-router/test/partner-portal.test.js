import test from "node:test";
import assert from "node:assert/strict";
import { buildPartnerOrderView } from "../src/partner-portal-model.js";
import { STATES } from "../src/state-machine.js";

const partner={id:"p1"};
const base={
  orderName:"#1001",
  productTitle:"24 Red Roses",
  referenceImageUrl:"https://example.test/24.jpg",
  supplierCost:80,
  currency:"EUR",
  city:"Paris",
  deliveryDate:"2026-09-27",
  recipient:{name:"Ana",address:"10 Rue Test",phone:"+331234"},
  greetingMessage:"With love",
  matchStandard:"STRICT_EXACT_99",
  substitutionPolicy:"Exactly 24 red roses",
  photoRequired:true
};

test("recipient private data is hidden before florist accepts",()=>{
  const view=buildPartnerOrderView({...base,state:STATES.OFFERING_TO_PARTNER},partner);
  assert.equal(view.recipient,null);
  assert.deepEqual(view.actions,["ACCEPT","REJECT"]);
});

test("recipient details appear only for the accepted florist",()=>{
  const view=buildPartnerOrderView({...base,state:STATES.PARTNER_ACCEPTED,partnerId:"p1"},partner);
  assert.equal(view.recipient.address,"10 Rue Test");
  assert.deepEqual(view.actions,["START_PREPARATION"]);
});

test("another florist cannot see recipient after someone else accepts",()=>{
  const view=buildPartnerOrderView({...base,state:STATES.PARTNER_ACCEPTED,partnerId:"p2"},partner);
  assert.equal(view.recipient,null);
});
