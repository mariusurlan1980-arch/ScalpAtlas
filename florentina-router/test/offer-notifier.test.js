import test from "node:test";
import assert from "node:assert/strict";
import { buildOfferEmail } from "../src/offer-notifier.js";

const order = {
  orderName:"#1001",
  productTitle:"24 Red Roses",
  city:"Paris",
  deliveryDate:"2026-09-27",
  supplierCost:85,
  currency:"EUR",
  recipient:{
    name:"Secret Recipient",
    address:"10 Secret Street",
    phone:"+33123456789"
  }
};

test("pre-acceptance offer email never exposes recipient PII",()=>{
  const message=buildOfferEmail({
    order,
    partner:{email:"florist@example.test",countryCode:"FR"},
    portalUrl:"https://partners.example.test/partner?token=abc",
    expiresAt:"2026-09-26T10:10:00Z"
  });

  assert.equal(message.to,"florist@example.test");
  assert.match(message.subject,/Flory Flowers/);
  assert.doesNotMatch(message.text,/Secret Recipient/);
  assert.doesNotMatch(message.text,/Secret Street/);
  assert.doesNotMatch(message.text,/33123456789/);
  assert.match(message.text,/24 Red Roses/);
  assert.match(message.text,/85 EUR/);
  assert.match(message.text,/token=abc/);
});

test("country selects local language copy",()=>{
  const message=buildOfferEmail({
    order:{...order,city:"Berlin"},
    partner:{email:"berlin@example.test",countryCode:"DE"},
    portalUrl:"https://partner.test/x",
    expiresAt:"2026-09-26T10:10:00Z"
  });
  assert.match(message.text,/Lieferstadt/);
});
