import crypto from "node:crypto";

export function verifyShopifyWebhook(rawBody, receivedHmac, webhookSecret) {
  if (!receivedHmac || !webhookSecret) return false;

  const expected = crypto
    .createHmac("sha256", webhookSecret)
    .update(rawBody)
    .digest("base64");

  const a = Buffer.from(expected);
  const b = Buffer.from(receivedHmac);

  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function webhookEventKey(headers) {
  return headers["x-shopify-event-id"] ||
    headers["X-Shopify-Event-Id"] ||
    headers["x-shopify-webhook-id"] ||
    headers["X-Shopify-Webhook-Id"] ||
    null;
}
