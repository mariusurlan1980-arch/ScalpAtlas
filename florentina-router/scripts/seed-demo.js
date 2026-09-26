import path from "node:path";
import { fileURLToPath } from "node:url";
import { createOrderFinanceRecord, EVENTS, transition } from "../src/index.js";
import { createPartnerPortalToken } from "../src/partner-links.js";
import { JsonOrderRepository } from "../src/storage.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const dataFile = process.env.DATA_FILE || path.join(ROOT, "data", "orders.json");
const secret = process.env.PARTNER_LINK_SECRET || "dev-only-change-me";

const repository = new JsonOrderRepository(dataFile);
await repository.init();

let order = createOrderFinanceRecord({
  orderName: "#DEMO-1001",
  shopifyOrderId: "demo-order-1001",
  total: 150,
  currency: "EUR",
  city: "Paris",
  authorizationExpiresAt: "2026-10-03T18:00:00Z"
});

Object.assign(order, {
  productTitle: "24 Red Roses",
  referenceImageUrl: "https://cdn.shopify.com/s/files/1/0966/2890/0106/files/24-red-roses.jpg?v=1790337728",
  supplierCost: 85,
  deliveryDate: "2026-09-27",
  recipient: {
    name: "Demo Recipient",
    address: "10 Rue Exemple, Paris",
    phone: "+33 6 00 00 00 00"
  },
  greetingMessage: "With love",
  matchStandard: "STRICT_EXACT_99",
  substitutionPolicy: "Exactly 24 red roses. No count or color substitution.",
  photoRequired: true
});

order = transition(order, EVENTS.PARTNER_OFFERED, { partnerId: "demo-florist" });
await repository.save(order);

const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
const token = createPartnerPortalToken({
  orderId: order.id,
  partnerId: "demo-florist",
  expiresAt
}, secret);

console.log(`Demo order: ${order.orderName}`);
console.log(`Portal: http://localhost:8787/partner?token=${token}`);
