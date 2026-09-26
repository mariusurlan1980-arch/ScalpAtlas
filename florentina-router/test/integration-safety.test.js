import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { ShopifyClient } from "../src/shopify-client.js";
import { verifyShopifyWebhook } from "../src/webhook-security.js";
import { createPartnerActionToken, verifyPartnerActionToken } from "../src/partner-links.js";

test("Shopify webhook HMAC accepts authentic payload and rejects modified payload", () => {
  const secret = "test-secret";
  const raw = Buffer.from('{"id":123}');
  const hmac = crypto.createHmac("sha256", secret).update(raw).digest("base64");

  assert.equal(verifyShopifyWebhook(raw, hmac, secret), true);
  assert.equal(verifyShopifyWebhook(Buffer.from('{"id":124}'), hmac, secret), false);
});

test("partner action token is signed and expires", () => {
  const secret = "partner-secret";
  const expiresAt = new Date(Date.now() + 60_000).toISOString();
  const token = createPartnerActionToken({
    orderId: "order-1",
    partnerId: "partner-1",
    action: "accept",
    expiresAt
  }, secret);

  assert.equal(verifyPartnerActionToken(token, secret).valid, true);
  assert.equal(
    verifyPartnerActionToken(token, secret, Date.now() + 120_000).reason,
    "expired"
  );
});

test("capture uses only a successful manually capturable authorization", async () => {
  const requests = [];
  const fetchImpl = async (_url, options) => {
    const req = JSON.parse(options.body);
    requests.push(req);

    if (req.query.includes("query CapturableAuthorization")) {
      return {
        ok: true,
        json: async () => ({
          data: {
            order: {
              id: "gid://shopify/Order/1",
              presentmentCurrencyCode: "EUR",
              totalPriceSet: { presentmentMoney: { amount: "150.00", currencyCode: "EUR" } },
              transactions: [{
                id: "gid://shopify/OrderTransaction/10",
                kind: "AUTHORIZATION",
                status: "SUCCESS",
                manuallyCapturable: true,
                amountSet: { presentmentMoney: { amount: "150.00", currencyCode: "EUR" } }
              }]
            }
          }
        })
      };
    }

    return {
      ok: true,
      json: async () => ({
        data: {
          orderCapture: {
            transaction: {
              id: "gid://shopify/OrderTransaction/11",
              status: "SUCCESS",
              kind: "CAPTURE",
              amountSet: { presentmentMoney: { amount: "150.00", currencyCode: "EUR" } }
            },
            userErrors: []
          }
        }
      })
    };
  };

  const client = new ShopifyClient({
    shopDomain: "example.myshopify.com",
    accessToken: "test-token",
    fetchImpl
  });

  const result = await client.captureAuthorizedPayment("gid://shopify/Order/1");
  assert.equal(result.captureReference, "gid://shopify/OrderTransaction/11");
  assert.equal(requests[1].variables.input.finalCapture, true);
  assert.equal(requests[1].variables.input.currency, "EUR");
});
