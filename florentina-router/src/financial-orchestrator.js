import { EVENTS, STATES, transition } from "./state-machine.js";

export class FinancialOrchestrator {
  constructor({ repository, paymentProvider, clock = () => Date.now(), retryMinutes = 2 }) {
    this.repository = repository;
    this.paymentProvider = paymentProvider;
    this.clock = clock;
    this.retryMinutes = retryMinutes;
  }

  async processPending(now = this.clock()) {
    const orders = await this.repository.list();
    const pending = orders.filter(order =>
      [STATES.CAPTURE_PENDING, STATES.VOID_PENDING].includes(order.state) &&
      (!order.financialRetryAfter || new Date(order.financialRetryAfter).getTime() <= now)
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

    if (order.state === STATES.CAPTURE_PENDING) {
      return this.#capture(order);
    }
    if (order.state === STATES.VOID_PENDING) {
      return this.#void(order);
    }

    return order;
  }

  async #capture(order) {
    if (order.photoApproved !== true || order.deliveryVerified !== true || order.paymentCaptured === true) {
      throw new Error("Capture safety gate not satisfied");
    }

    try {
      const result = await this.paymentProvider.captureAuthorizedPayment(order.shopifyOrderId);
      const next = transition(order, EVENTS.CAPTURE_SUCCEEDED, {
        captureReference: result.captureReference
      });
      next.capturedAmount = result.amount ?? null;
      next.capturedCurrency = result.currency ?? order.currency ?? null;
      delete next.financialRetryAfter;
      delete next.lastFinancialErrorCode;
      await this.repository.save(next);
      await this.#audit(next, "PAYMENT_CAPTURED");
      return next;
    } catch {
      const next = structuredClone(order);
      next.lastFinancialErrorCode = "CAPTURE_ATTEMPT_FAILED";
      next.financialRetryAfter = new Date(
        this.clock() + this.retryMinutes * 60_000
      ).toISOString();
      next.updatedAt = new Date(this.clock()).toISOString();
      await this.repository.save(next);
      await this.#audit(next, "CAPTURE_ATTEMPT_FAILED");
      return next;
    }
  }

  async #void(order) {
    if (order.paymentCaptured === true) {
      throw new Error("Captured payment cannot use authorization void path");
    }

    try {
      const result = await this.paymentProvider.voidAuthorization(order.shopifyOrderId);
      const next = transition(order, EVENTS.VOID_SUCCEEDED);
      next.voidReference = result.voidReference ?? null;
      delete next.financialRetryAfter;
      delete next.lastFinancialErrorCode;
      await this.repository.save(next);
      await this.#audit(next, "AUTHORIZATION_VOIDED");
      return next;
    } catch {
      const next = structuredClone(order);
      next.lastFinancialErrorCode = "VOID_ATTEMPT_FAILED";
      next.financialRetryAfter = new Date(
        this.clock() + this.retryMinutes * 60_000
      ).toISOString();
      next.updatedAt = new Date(this.clock()).toISOString();
      await this.repository.save(next);
      await this.#audit(next, "VOID_ATTEMPT_FAILED");
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
