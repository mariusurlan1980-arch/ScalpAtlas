import crypto from "node:crypto";

export function createPartnerActionToken({ orderId, partnerId, action, expiresAt }, secret) {
  if (!secret) throw new Error("Missing partner-link secret");
  const payload = Buffer.from(JSON.stringify({ orderId, partnerId, action, expiresAt }))
    .toString("base64url");
  const signature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyPartnerActionToken(token, secret, now = Date.now()) {
  if (!token || !secret) return { valid: false, reason: "missing" };
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return { valid: false, reason: "format" };

  const expected = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { valid: false, reason: "signature" };
  }

  const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  if (!data.expiresAt || new Date(data.expiresAt).getTime() <= now) {
    return { valid: false, reason: "expired" };
  }
  return { valid: true, data };
}
