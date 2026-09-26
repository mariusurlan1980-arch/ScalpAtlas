import { createPartnerPortalToken } from "./partner-links.js";
import { EVENTS, STATES, transition } from "./state-machine.js";

export class RoutingEngine {
  constructor({
    repository,
    partnerDirectory,
    notifier,
    tokenSecret,
    portalBaseUrl,
    responseMinutes = 10,
    maxAttempts = 5,
    portalTokenHours = 48,
    clock = () => Date.now()
  }) {
    this.repository = repository;
    this.partnerDirectory = partnerDirectory;
    this.notifier = notifier;
    this.tokenSecret = tokenSecret;
    this.portalBaseUrl = portalBaseUrl.replace(/\/$/, "");
    this.responseMinutes = responseMinutes;
    this.maxAttempts = maxAttempts;
    this.portalTokenHours = portalTokenHours;
    this.clock = clock;
  }

  async start(orderId) {
    let order = await this.#order(orderId);
    if (order.state === STATES.PAYMENT_AUTHORIZED) {
      order = transition(order, EVENTS.START_ROUTING);
      await this.repository.save(order);
      await this.#audit(order, null, "ROUTING_STARTED");
    }
    return this.#offerNext(order);
  }

  async advanceAfterPartnerDecision(orderId) {
    const order = await this.#order(orderId);
    if (order.state !== STATES.OFFERING_TO_PARTNER || order.currentOfferedPartnerId) {
      return order;
    }
    return this.#offerNext(order);
  }

  async processDueOffers(now = this.clock()) {
    const orders = await this.repository.list();
    const due = orders.filter(order =>
      order.state === STATES.OFFERING_TO_PARTNER &&
      order.currentOfferedPartnerId &&
      order.offerExpiresAt &&
      new Date(order.offerExpiresAt).getTime() <= now
    );

    const results = [];
    for (const order of due) {
      results.push(await this.#expireAndAdvance(order));
    }
    return results;
  }

  async #expireAndAdvance(order) {
    const expiredPartnerId = order.currentOfferedPartnerId;
    const next = transition(order, EVENTS.PARTNER_TIMEOUT);
    clearSupplierOfferData(next);
    await this.repository.save(next);
    await this.#audit(next, expiredPartnerId, "PARTNER_TIMEOUT");
    return this.#offerNext(next);
  }

  async #offerNext(initialOrder) {
    let order = initialOrder;
    if (order.state !== STATES.OFFERING_TO_PARTNER) return order;

    while (order.state === STATES.OFFERING_TO_PARTNER) {
      const attempted = new Set(order.attemptedPartnerIds ?? []);
      const eligible = (await this.partnerDirectory.getEligiblePartners(order))
        .filter(p => p.active !== false)
        .sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999));

      const candidates = eligible.filter(p => !attempted.has(p.id));
      if (attempted.size >= this.maxAttempts || candidates.length === 0) {
        const exhausted = transition(order, EVENTS.ALL_PARTNERS_EXHAUSTED);
        clearSupplierOfferData(exhausted);
        await this.repository.save(exhausted);
        await this.#audit(exhausted, null, "ALL_PARTNERS_EXHAUSTED");
        return exhausted;
      }

      const partner = candidates[0];
      const now = this.clock();
      const offeredAt = new Date(now).toISOString();
      const offerExpiresAt = new Date(now + this.responseMinutes * 60_000).toISOString();
      const portalExpiresAt = new Date(now + this.portalTokenHours * 60 * 60_000).toISOString();

      const offered = transition(order, EVENTS.PARTNER_OFFERED, {
        partnerId: partner.id,
        offeredAt,
        expiresAt: offerExpiresAt
      });

      Object.assign(offered, {
        routingMaxAttempts: this.maxAttempts,
        routingResponseMinutes: this.responseMinutes,
        currentPartnerPriority: partner.priority ?? null,
        supplierQuoteId: partner.quoteId ?? null,
        supplierCost: partner.supplierCost ?? null,
        supplierCurrency: partner.supplierCurrency ?? "EUR",
        supplierPayoutMode: partner.payoutMode ?? null,
        supplierPayoutCurrency: partner.payoutCurrency ?? "EUR",
        supplierPayoutProvider: partner.payoutProvider ?? "",
        supplierPayoutOnboardingStatus: partner.payoutOnboardingStatus ?? "not_connected",
        supplierPayoutAccountReference: partner.payoutAccountReference ?? "",
        supplierPayoutEnabled: partner.payoutEnabled === true
      });

      await this.repository.save(offered);

      const token = createPartnerPortalToken({
        orderId: offered.id,
        partnerId: partner.id,
        expiresAt: portalExpiresAt
      }, this.tokenSecret);

      const portalUrl = `${this.portalBaseUrl}/partner?token=${encodeURIComponent(token)}`;

      try {
        const delivery = await this.notifier.sendOffer({
          order: offered,
          partner,
          portalUrl,
          expiresAt: offerExpiresAt
        });

        offered.notificationChannel = delivery?.channel ?? null;
        offered.notificationMessageId = delivery?.messageId ?? null;
        offered.notificationSentAt = new Date(this.clock()).toISOString();
        await this.repository.save(offered);
        await this.#audit(offered, partner.id, "PARTNER_OFFERED");
        return offered;
      } catch {
        order = transition(offered, EVENTS.PARTNER_NOTIFICATION_FAILED);
        clearSupplierOfferData(order);
        await this.repository.save(order);
        await this.#audit(order, partner.id, "PARTNER_NOTIFICATION_FAILED");
      }
    }

    return order;
  }

  async #order(id) {
    const order = await this.repository.get(id);
    if (!order) throw new Error("Order not found");
    return order;
  }

  async #audit(order, partnerId, event) {
    await this.repository.appendAudit({
      orderId: order.id,
      partnerId,
      event,
      state: order.state,
      at: new Date(this.clock()).toISOString()
    });
  }
}

export class InMemoryPartnerDirectory {
  constructor(partners = []) {
    this.partners = partners;
  }

  async getEligiblePartners(order) {
    return this.partners.filter(partner =>
      (!partner.city || partner.city === order.city) &&
      (!partner.certifiedProductIds?.length ||
        partner.certifiedProductIds.includes(order.productId))
    );
  }
}

function clearSupplierOfferData(order) {
  delete order.supplierQuoteId;
  delete order.supplierCost;
  delete order.supplierCurrency;
  delete order.supplierPayoutMode;
  delete order.supplierPayoutCurrency;
  delete order.supplierPayoutProvider;
  delete order.supplierPayoutOnboardingStatus;
  delete order.supplierPayoutAccountReference;
  delete order.supplierPayoutEnabled;
  delete order.currentPartnerPriority;
}
