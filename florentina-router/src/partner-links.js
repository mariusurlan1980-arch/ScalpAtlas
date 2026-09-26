import crypto from "node:crypto";

function signPayload(data, secret) {
  if (!secret) throw new Error("Missing partner-link secret");
  const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function createPartnerPortalToken({ orderId, partnerId, expiresAt }, secret) {
  return signPayload({ orderId, partnerId, scope: "partner_portal", expiresAt }, secret);
}

export function createPartnerActionToken({ orderId, partnerId, action, expiresAt }, secret) {
  return signPayload({ orderId, partnerId, action, scope: "partner_action", expiresAt }, secret);
}

export function verifyPartnerActionToken(token, secret, now = Date.now()) {
  return verifySignedToken(token, secret, now);
}

export function verifyPartnerPortalToken(token, secret, now = Date.now()) {
  const result = verifySignedToken(token, secret, now);
  if (!result.valid) return result;
  if (result.data.scope !== "partner_portal") return { valid: false, reason: "scope" };
  return result;
}

function verifySignedToken(token, secret, now) {
  if (!token || !secret) return { valid: false, reason: "missing" };
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return { valid: false, reason: "format" };

  const expected = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { valid: false, reason: "signature" };
  }

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!data.expiresAt || new Date(data.expiresAt).getTime() <= now) {
      return { valid: false, reason: "expired" };
    }
    if (!data.orderId || !data.partnerId) {
      return { valid: false, reason: "payload" };
    }
    return { valid: true, data };
  } catch {
    return { valid: false, reason: "payload" };
  }
}
