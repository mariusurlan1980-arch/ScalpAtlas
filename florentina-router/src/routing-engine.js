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
    clock = () => Date.now()
  }) {
    this.repository = repository;
    this.partnerDirectory = partnerDirectory;
    this.notifier = notifier;
    this.tokenSecret = tokenSecret;
    this.portalBaseUrl = portalBaseUrl.replace(/\/$/, "");
    this.responseMinutes = responseMinutes;
    this.maxAttempts = maxAttempts;
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
    let next = transition(order, EVENTS.PARTNER_TIMEOUT, { partnerId: expiredPartnerId });
    next.attemptedPartnerIds = unique([...(order.attemptedPartnerIds ?? []), expiredPartnerId]);
    await this.repository.save(next);
    await this.#audit(next, expiredPartnerId, "PARTNER_TIMEOUT");
    return this.#offerNext(next);
  }

  async #offerNext(order) {
    const attempted = new Set(order.attemptedPartnerIds ?? []);
    const candidates = (await this.partnerDirectory.getEligiblePartners(order))
      .filter(p => p.active !== false)
      .sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999))
      .filter(p => !attempted.has(p.id))
      .slice(0, this.maxAttempts);

    const totalAttempts = order.attemptedPartnerIds?.length ?? 0;
    if (totalAttempts >= this.maxAttempts || candidates.length === 0) {
      const exhausted = transition(order, EVENTS.ALL_PARTNERS_EXHAUSTED);
      await this.repository.save(exhausted);
      await this.#audit(exhausted, null, "ALL_PARTNERS_EXHAUSTED");
      return exhausted;
    }

    const partner = candidates[0];
    const offeredAt = new Date(this.clock()).toISOString();
    const expiresAt = new Date(this.clock() + this.responseMinutes * 60_000).toISOString();

    let offered = transition(order, EVENTS.PARTNER_OFFERED, {
      partnerId: partner.id,
      offeredAt,
      expiresAt
    });
    offered.routingMaxAttempts = this.maxAttempts;
    offered.routingResponseMinutes = this.responseMinutes;
    offered.currentPartnerPriority = partner.priority ?? null;
    await this.repository.save(offered);

    const token = createPartnerPortalToken({
      orderId: offered.id,
      partnerId: partner.id,
      expiresAt
    }, this.tokenSecret);

    const portalUrl = `${this.portalBaseUrl}/partner?token=${encodeURIComponent(token)}`;
    await this.notifier.sendOffer({ order: offered, partner, portalUrl, expiresAt });
    await this.#audit(offered, partner.id, "PARTNER_OFFERED");

    return offered;
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

export class LogOfferNotifier {
  async sendOffer({ order, partner, portalUrl, expiresAt }) {
    console.log(JSON.stringify({
      type: "FLORIST_OFFER",
      order: order.orderName,
      partner: partner.name ?? partner.id,
      portalUrl,
      expiresAt
    }));
  }
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}
