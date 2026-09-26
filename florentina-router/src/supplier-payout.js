import { EVENTS, STATES, transition } from "./state-machine.js";

const VERIFIED_STATUSES = new Set(["verified", "ready", "active"]);

export class SupplierPayoutOrchestrator {
  constructor({ repository, payoutProvider, clock = () => Date.now(), retryMinutes = 5 }) {
    this.repository = repository;
    this.payoutProvider = payoutProvider;
    this.clock = clock;
    this.retryMinutes = retryMinutes;
  }

  async processPending(now = this.clock()) {
    const orders = await this.repository.list();
    const pending = orders.filter(order =>
      order.state === STATES.PAYOUT_PENDING &&
      (!order.payoutRetryAfter || new Date(order.payoutRetryAfter).getTime() <= now)
    );

    const results = [];
    for (const order of pending) {
      results.push(await this.processOrder(order.id));
    }
    return results;
  }

  async processOrder(orderId) {
    const order = await this.repository.get(orderId);
    if (!order) throw new Error("Order not found");
    if (order.state !== STATES.PAYOUT_PENDING) return order;

    const gate = payoutSafetyGate(order);
    if (!gate.ok) {
      const blocked = structuredClone(order);
      blocked.supplierPayoutStatus = "BLOCKED";
      blocked.supplierPayoutBlockReason = gate.reason;
      blocked.updatedAt = new Date(this.clock()).toISOString();
      await this.repository.save(blocked);
      await this.#audit(blocked, "SUPPLIER_PAYOUT_BLOCKED");
      return blocked;
    }

    if (order.payoutReference) {
      return order;
    }

    const idempotencyKey = `ff:${order.id}:supplier-payout:v1`;

    try {
      const result = await this.payoutProvider.paySupplier({
        orderId: order.id,
        partnerId: order.partnerId,
        amount: Number(order.supplierCost),
        currency: order.supplierPayoutCurrency || order.supplierCurrency,
        accountReference: order.supplierPayoutAccountReference,
        provider: order.supplierPayoutProvider,
        reference: `Florentina Flowers ${order.orderName}`,
        idempotencyKey
      });

      const next = transition(order, EVENTS.PAYOUT_SUCCEEDED, {
        payoutReference: result.payoutReference
      });
      next.supplierPayoutStatus = "PAID";
      next.supplierPaidAmount = result.amount ?? Number(order.supplierCost);
      next.supplierPaidCurrency =
        result.currency ?? order.supplierPayoutCurrency ?? order.supplierCurrency;
      next.grossMarginBeforeFees = gate.grossMarginBeforeFees;
      if (Number.isFinite(Number(order.paymentFees))) {
        next.marginAfterKnownPaymentFees = roundMoney(
          gate.grossMarginBeforeFees - Number(order.paymentFees)
        );
      }
      next.payoutIdempotencyKey = idempotencyKey;
      delete next.payoutRetryAfter;
      delete next.lastPayoutErrorCode;
      delete next.supplierPayoutBlockReason;
      await this.repository.save(next);
      await this.#audit(next, "SUPPLIER_PAYOUT_SUCCEEDED");
      return next;
    } catch {
      const next = structuredClone(order);
      next.supplierPayoutStatus = "RETRY";
      next.lastPayoutErrorCode = "SUPPLIER_PAYOUT_ATTEMPT_FAILED";
      next.payoutRetryAfter = new Date(
        this.clock() + this.retryMinutes * 60_000
      ).toISOString();
      next.payoutIdempotencyKey = idempotencyKey;
      next.updatedAt = new Date(this.clock()).toISOString();
      await this.repository.save(next);
      await this.#audit(next, "SUPPLIER_PAYOUT_ATTEMPT_FAILED");
      return next;
    }
  }

  async #audit(order, event) {
    await this.repository.appendAudit({
      orderId: order.id,
      partnerId: order.partnerId ?? null,
      event,
      state: order.state,
      at: new Date(this.clock()).toISOString()
    });
  }
}

export function payoutSafetyGate(order) {
  if (order.paymentCaptured !== true) return fail("CUSTOMER_PAYMENT_NOT_CAPTURED");
  if (order.deliveryVerified !== true) return fail("DELIVERY_NOT_VERIFIED");
  if (order.photoApproved !== true) return fail("PHOTO_NOT_APPROVED");
  if (!order.partnerId) return fail("NO_ASSIGNED_FLORIST");
  if (order.supplierPayoutEnabled !== true) return fail("FLORIST_PAYOUT_DISABLED");
  if (!VERIFIED_STATUSES.has(String(order.supplierPayoutOnboardingStatus || "").toLowerCase())) {
    return fail("FLORIST_PAYOUT_NOT_VERIFIED");
  }
  if (!order.supplierPayoutAccountReference) return fail("MISSING_PAYOUT_ACCOUNT_REFERENCE");

  const supplierCost = Number(order.supplierCost);
  const captured = Number(order.capturedAmount ?? order.total);
  if (!Number.isFinite(supplierCost) || supplierCost <= 0) return fail("INVALID_SUPPLIER_COST");
  if (!Number.isFinite(captured) || captured <= 0) return fail("INVALID_CAPTURED_AMOUNT");
  if (supplierCost >= captured) return fail("NO_POSITIVE_MARGIN");

  const payoutCurrency = order.supplierPayoutCurrency || order.supplierCurrency;
  const capturedCurrency = order.capturedCurrency || order.currency;
  if (!payoutCurrency || !capturedCurrency || payoutCurrency !== capturedCurrency) {
    return fail("PAYOUT_CURRENCY_MISMATCH");
  }

  return {
    ok: true,
    grossMarginBeforeFees: roundMoney(captured - supplierCost)
  };
}

export class HttpPayoutProvider {
  constructor({ baseUrl, apiKey, fetchImpl = fetch }) {
    if (!baseUrl || !apiKey) throw new Error("Payout API URL and key are required");
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.apiKey = apiKey;
    this.fetch = fetchImpl;
  }

  async paySupplier(instruction) {
    const response = await this.fetch(`${this.baseUrl}/payouts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`,
        "Idempotency-Key": instruction.idempotencyKey
      },
      body: JSON.stringify({
        beneficiary_reference: instruction.accountReference,
        amount: instruction.amount,
        currency: instruction.currency,
        reference: instruction.reference,
        metadata: {
          order_id: instruction.orderId,
          partner_id: instruction.partnerId
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Payout provider HTTP ${response.status}`);
    }

    const body = await response.json();
    const payoutReference = body.payoutReference || body.id;
    if (!payoutReference) throw new Error("Payout provider returned no payout reference");

    return {
      payoutReference,
      amount: body.amount ?? instruction.amount,
      currency: body.currency ?? instruction.currency
    };
  }
}

function fail(reason) {
  return { ok: false, reason };
}

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
