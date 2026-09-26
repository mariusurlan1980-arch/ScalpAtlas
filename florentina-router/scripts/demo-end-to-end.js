import { createOrderFinanceRecord, STATES } from "../src/index.js";
import { InMemoryOrderRepository } from "../src/storage.js";
import { InMemoryPartnerDirectory, RoutingEngine } from "../src/routing-engine.js";
import { PartnerOrderService } from "../src/partner-service.js";
import { FinancialOrchestrator } from "../src/financial-orchestrator.js";
import { SupplierPayoutOrchestrator } from "../src/supplier-payout.js";

const now = Date.now();
let order = createOrderFinanceRecord({
  orderName:"#DEMO-END-TO-END",
  shopifyOrderId:"demo-end-to-end",
  total:150,
  currency:"EUR",
  city:"Paris",
  authorizationExpiresAt:new Date(now + 5*24*60*60_000).toISOString()
});

Object.assign(order,{
  productId:"demo-product",
  productTitle:"24 Red Roses",
  deliveryDate:new Date(now + 24*60*60_000).toISOString().slice(0,10),
  recipient:{name:"Demo Recipient",address:"Demo Address",phone:"+33000000000"},
  matchStandard:"STRICT_EXACT_99",
  substitutionPolicy:"Exactly 24 red roses.",
  photoRequired:true,
  paymentFees:4
});

const repository=new InMemoryOrderRepository([order]);
const partner={
  id:"demo-florist",
  name:"Demo Florist",
  city:"Paris",
  priority:1,
  active:true,
  certifiedProductIds:["demo-product"],
  quoteId:"demo-quote",
  supplierCost:85,
  supplierCurrency:"EUR",
  payoutCurrency:"EUR",
  payoutProvider:"demo",
  payoutOnboardingStatus:"verified",
  payoutAccountReference:"demo-beneficiary",
  payoutEnabled:true
};

let token="";
const routing=new RoutingEngine({
  repository,
  partnerDirectory:new InMemoryPartnerDirectory([partner]),
  notifier:{
    async sendOffer(input){
      token=new URL(input.portalUrl).searchParams.get("token");
      return {channel:"demo",messageId:"demo-message"};
    }
  },
  tokenSecret:"demo-secret",
  portalBaseUrl:"https://demo.invalid",
  clock:()=>now
});

await routing.start(order.id);

const service=new PartnerOrderService({
  repository,
  tokenSecret:"demo-secret",
  routingEngine:routing,
  clock:()=>now,
  photoStore:{async saveBuffer(){return "/uploads/demo.jpg";}}
});

await service.applyAction(token,"ACCEPT");
await service.applyAction(token,"START_PREPARATION");
await service.submitPhoto(token,Buffer.from("demo"),{mimeType:"image/jpeg"});
await service.reviewPhoto(order.id,{approved:true});
await service.applyAction(token,"START_DELIVERY");
await service.applyAction(token,"CONFIRM_DELIVERY");
await service.verifyDelivery(order.id,{approved:true});

const financial=new FinancialOrchestrator({
  repository,
  paymentProvider:{
    async captureAuthorizedPayment(){return {captureReference:"demo-capture",amount:"150.00",currency:"EUR"};},
    async voidAuthorization(){return {voidReference:"demo-void"};}
  }
});
await financial.processOrder(order.id);

const payout=new SupplierPayoutOrchestrator({
  repository,
  payoutProvider:{
    async paySupplier(x){return {payoutReference:"demo-payout",amount:x.amount,currency:x.currency};}
  }
});
await payout.processOrder(order.id);

const finalOrder=await repository.get(order.id);
console.log(JSON.stringify({
  result: finalOrder.state,
  customerCaptured: `${finalOrder.capturedAmount} ${finalOrder.capturedCurrency}`,
  floristPaid: `${finalOrder.supplierPaidAmount} ${finalOrder.supplierPaidCurrency}`,
  grossMarginBeforeFees: `${finalOrder.grossMarginBeforeFees} EUR`,
  knownPaymentFees: `${finalOrder.paymentFees} EUR`,
  marginAfterKnownPaymentFees: `${finalOrder.marginAfterKnownPaymentFees} EUR`,
  realMoneyMoved:false
},null,2));

if(finalOrder.state!==STATES.COMPLETE) process.exitCode=1;
