import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Busboy from "busboy";
import { JsonOrderRepository } from "./storage.js";
import { LocalPhotoStore, isAllowedPhotoMime } from "./photo-storage.js";
import { PartnerOrderService } from "./partner-service.js";
import { ShopifyClient } from "./shopify-client.js";
import {
  InMemoryPartnerDirectory,
  RoutingEngine
} from "./routing-engine.js";
import { LogOfferNotifier, SmtpOfferNotifier } from "./offer-notifier.js";
import { ShopifyPartnerDirectory } from "./shopify-partner-directory.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.env.PORT || 8787);
const DATA_FILE = process.env.DATA_FILE || path.join(ROOT, "data", "orders.json");
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(ROOT, "data", "uploads");
const TOKEN_SECRET = requiredSecret("PARTNER_LINK_SECRET", "dev-only-change-me");
const INTERNAL_API_KEY = requiredSecret("INTERNAL_API_KEY", "dev-internal-only");
const ROUTING_ENABLED = process.env.ENABLE_ROUTING_ENGINE === "true";
const PORTAL_BASE_URL = process.env.PORTAL_BASE_URL || `http://localhost:${PORT}`;
const RESPONSE_MINUTES = Number(process.env.ROUTING_RESPONSE_MINUTES || 10);
const MAX_ATTEMPTS = Number(process.env.ROUTING_MAX_ATTEMPTS || 5);
const ROUTING_TICK_MS = Number(process.env.ROUTING_TICK_MS || 30_000);

const repository = new JsonOrderRepository(DATA_FILE);
await repository.init();

const partnerDirectory = buildPartnerDirectory();
const routingEngine = new RoutingEngine({
  repository,
  partnerDirectory,
  notifier: buildOfferNotifier(),
  tokenSecret: TOKEN_SECRET,
  portalBaseUrl: PORTAL_BASE_URL,
  responseMinutes: RESPONSE_MINUTES,
  maxAttempts: MAX_ATTEMPTS
});

const photoStore = new LocalPhotoStore({ directory: UPLOAD_DIR });
const service = new PartnerOrderService({
  repository,
  tokenSecret: TOKEN_SECRET,
  photoStore,
  routingEngine
});

if (ROUTING_ENABLED) {
  const timer = setInterval(async () => {
    try {
      await routingEngine.processDueOffers();
    } catch (error) {
      console.error("Routing timer error:", error.message);
    }
  }, ROUTING_TICK_MS);
  timer.unref();
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

    if (req.method === "GET" && url.pathname === "/health") {
      return json(res, 200, {
        ok: true,
        mode: process.env.NODE_ENV || "development",
        routingEnabled: ROUTING_ENABLED,
        responseMinutes: RESPONSE_MINUTES,
        maxAttempts: MAX_ATTEMPTS
      });
    }

    if (req.method === "GET" && url.pathname === "/api/partner/order") {
      const order = await service.getOrderView(url.searchParams.get("token"));
      return json(res, 200, { order });
    }

    if (req.method === "POST" && url.pathname === "/api/partner/action") {
      const body = await readJson(req);
      const order = await service.applyAction(body.token, body.action, body);
      return json(res, 200, { order });
    }

    if (req.method === "POST" && url.pathname === "/api/partner/photo") {
      const upload = await readPhotoUpload(req);
      const order = await service.submitPhoto(upload.token, upload.buffer, {
        mimeType: upload.mimeType,
        originalName: upload.filename
      });
      return json(res, 200, { order });
    }

    if (req.method === "POST" && url.pathname === "/api/internal/route-start") {
      requireInternal(req);
      requireRoutingEnabled();
      const body = await readJson(req);
      const order = await routingEngine.start(body.orderId);
      return json(res, 200, {
        state: order.state,
        currentOfferedPartnerId: order.currentOfferedPartnerId ?? null,
        offerExpiresAt: order.offerExpiresAt ?? null
      });
    }

    if (req.method === "POST" && url.pathname === "/api/internal/routing-tick") {
      requireInternal(req);
      requireRoutingEnabled();
      const processed = await routingEngine.processDueOffers();
      return json(res, 200, { processed: processed.length });
    }

    if (req.method === "POST" && url.pathname === "/api/internal/photo-review") {
      requireInternal(req);
      const body = await readJson(req);
      const order = await service.reviewPhoto(body.orderId, {
        approved: body.approved === true,
        reason: body.reason
      });
      return json(res, 200, { state: order.state });
    }

    if (req.method === "POST" && url.pathname === "/api/internal/delivery-review") {
      requireInternal(req);
      const body = await readJson(req);
      const order = await service.verifyDelivery(body.orderId, {
        approved: body.approved === true,
        reason: body.reason
      });
      return json(res, 200, { state: order.state });
    }

    if (req.method === "GET" && (url.pathname === "/partner" || url.pathname === "/partner/")) {
      return serveFile(res, path.join(ROOT, "portal", "index.html"), "text/html; charset=utf-8");
    }

    if (req.method === "GET" && url.pathname.startsWith("/partner/")) {
      const name = url.pathname.slice("/partner/".length);
      if (!["app.js", "styles.css"].includes(name)) return notFound(res);
      const type = name.endsWith(".js") ? "text/javascript; charset=utf-8" : "text/css; charset=utf-8";
      return serveFile(res, path.join(ROOT, "portal", name), type);
    }

    if (req.method === "GET" && url.pathname.startsWith("/uploads/")) {
      const name = path.basename(url.pathname);
      return serveUpload(res, path.join(UPLOAD_DIR, name));
    }

    return notFound(res);
  } catch (error) {
    const status = /invalid|not allowed|not found|unsupported|expired|disabled/i.test(error.message) ? 400 : 500;
    return json(res, status, { error: error.message });
  }
});

server.listen(PORT, () => {
  console.log(`Florentina Flowers router listening on http://localhost:${PORT}`);
  console.log(`Routing engine: ${ROUTING_ENABLED ? "ENABLED" : "DISABLED"}`);
});

function buildOfferNotifier() {
  if (process.env.SMTP_HOST) {
    return new SmtpOfferNotifier({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      user: process.env.SMTP_USER || "",
      pass: process.env.SMTP_PASS || "",
      from: process.env.SMTP_FROM
    });
  }

  if (process.env.NODE_ENV === "production" && ROUTING_ENABLED) {
    throw new Error("Routing enabled in production but SMTP notifications are not configured");
  }

  return new LogOfferNotifier();
}

function buildPartnerDirectory() {
  const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN;
  const accessToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;

  if (shopDomain && accessToken) {
    return new ShopifyPartnerDirectory({
      shopifyClient: new ShopifyClient({ shopDomain, accessToken })
    });
  }

  if (process.env.ROUTING_PARTNERS_JSON) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("ROUTING_PARTNERS_JSON is development-only");
    }
    const partners = JSON.parse(process.env.ROUTING_PARTNERS_JSON);
    return new InMemoryPartnerDirectory(partners);
  }

  if (ROUTING_ENABLED) {
    throw new Error("Routing enabled but no Shopify partner directory is configured");
  }

  return new InMemoryPartnerDirectory([]);
}

function requireRoutingEnabled() {
  if (!ROUTING_ENABLED) throw new Error("Routing engine is disabled");
}

function requiredSecret(name, developmentFallback) {
  const value = process.env[name];
  if (value) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return developmentFallback;
}

function requireInternal(req) {
  if (req.headers["x-internal-api-key"] !== INTERNAL_API_KEY) {
    throw new Error("Invalid internal API key");
  }
}

async function readJson(req, maxBytes = 256 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) throw new Error("Request too large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function readPhotoUpload(req) {
  return new Promise((resolve, reject) => {
    const busboy = Busboy({
      headers: req.headers,
      limits: { files: 1, fileSize: 10 * 1024 * 1024, fields: 5 }
    });

    let token = "";
    let filename = "";
    let mimeType = "";
    let fileTooLarge = false;
    const chunks = [];

    busboy.on("field", (name, value) => {
      if (name === "token") token = value;
    });

    busboy.on("file", (name, stream, info) => {
      if (name !== "photo") {
        stream.resume();
        return;
      }
      filename = info.filename || "bouquet";
      mimeType = info.mimeType;
      if (!isAllowedPhotoMime(mimeType)) {
        stream.resume();
        reject(new Error("Unsupported image type"));
        return;
      }
      stream.on("limit", () => { fileTooLarge = true; });
      stream.on("data", chunk => chunks.push(chunk));
    });

    busboy.on("error", reject);
    busboy.on("close", () => {
      if (fileTooLarge) return reject(new Error("Photo is too large"));
      const buffer = Buffer.concat(chunks);
      if (!token || !buffer.length) return reject(new Error("Missing token or photo"));
      resolve({ token, buffer, filename, mimeType });
    });

    req.pipe(busboy);
  });
}

async function serveFile(res, filePath, contentType) {
  const body = await fs.readFile(filePath);
  res.writeHead(200, {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  res.end(body);
}

async function serveUpload(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const type = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".heic": "image/heic",
    ".heif": "image/heif"
  }[ext] || "application/octet-stream";
  return serveFile(res, filePath, type);
}

function json(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  res.end(JSON.stringify(body));
}

function notFound(res) {
  return json(res, 404, { error: "Not found" });
}
