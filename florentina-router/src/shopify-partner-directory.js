export class ShopifyPartnerDirectory {
  constructor({ shopifyClient }) {
    this.shopify = shopifyClient;
  }

  async getEligiblePartners(order) {
    const [partners, quotes] = await Promise.all([
      this.#loadAll("ff_florist_partner"),
      this.#loadAll("ff_supplier_product_quote")
    ]);

    const approvedQuotes = quotes
      .map(toRecord)
      .filter(q =>
        q.quote_status === "approved" &&
        q.product_id === order.productId &&
        q.can_make !== "no"
      );

    const quoteByPartner = new Map();
    for (const quote of approvedQuotes) {
      if (!quoteByPartner.has(quote.partner_id)) {
        quoteByPartner.set(quote.partner_id, quote);
      }
    }

    return partners
      .map(toRecord)
      .filter(p =>
        p.active === "true" &&
        sameCity(p.city, order.city) &&
        quoteByPartner.has(p.id)
      )
      .map(p => {
        const quote = quoteByPartner.get(p.id);
        const supplierCost = supplierTotal(quote);

        return {
          id: p.id,
          name: p.partner_name,
          city: p.city,
          countryCode: p.country_code,
          email: p.email,
          whatsapp: p.whatsapp,
          priority: numberOr(p.priority, 999),
          responseMinutes: numberOr(p.response_minutes, 10),
          active: true,
          quoteId: quote.id,
          supplierCost,
          supplierCurrency: "EUR",
          payoutMode: p.payout_mode || "after_delivery_confirmation",
          payoutCurrency: p.payout_currency || "EUR",
          payoutProvider: p.payout_provider || "",
          payoutOnboardingStatus: p.payout_onboarding_status || "not_connected",
          payoutAccountReference: p.payout_account_reference || "",
          payoutEnabled: p.payout_enabled === "true"
        };
      })
      .filter(p => Number.isFinite(p.supplierCost) && p.supplierCost > 0)
      .sort((a,b)=>(a.priority??999)-(b.priority??999));
  }

  async #loadAll(type) {
    const nodes = [];
    let after = null;

    do {
      const data = await this.shopify.graphql(
        `query FlorentinaMetaobjects($type: String!, $after: String) {
          metaobjects(type: $type, first: 100, after: $after) {
            nodes {
              id
              handle
              fields { key value }
            }
            pageInfo { hasNextPage endCursor }
          }
        }`,
        { type, after }
      );

      nodes.push(...data.metaobjects.nodes);
      after = data.metaobjects.pageInfo.hasNextPage
        ? data.metaobjects.pageInfo.endCursor
        : null;
    } while (after);

    return nodes;
  }
}

function supplierTotal(quote) {
  const total = Number(quote.total_supplier_cost_eur);
  if (Number.isFinite(total) && total > 0) return total;

  const bouquet = Number(quote.bouquet_cost_eur || 0);
  const delivery = Number(quote.delivery_fee_eur || 0);
  const calculated = bouquet + delivery;
  return Number.isFinite(calculated) ? calculated : NaN;
}

function toRecord(node) {
  const record = { id: node.id, handle: node.handle };
  for (const field of node.fields ?? []) {
    record[field.key] = field.value;
  }
  return record;
}

function sameCity(a, b) {
  return normalize(a) === normalize(b);
}

function normalize(value) {
  return String(value ?? "").trim().toLocaleLowerCase("en-US");
}

function numberOr(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
