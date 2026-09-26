export class ShopifyPartnerDirectory {
  constructor({ shopifyClient }) {
    this.shopify = shopifyClient;
  }

  async getEligiblePartners(order) {
    const [partners, quotes] = await Promise.all([
      this.#loadAll("ff_florist_partner"),
      this.#loadAll("ff_supplier_product_quote")
    ]);

    const approved = new Set(
      quotes
        .map(toRecord)
        .filter(q =>
          q.quote_status === "approved" &&
          q.product_id === order.productId &&
          q.can_make !== "no"
        )
        .map(q => q.partner_id)
    );

    return partners
      .map(toRecord)
      .filter(p =>
        p.active === "true" &&
        sameCity(p.city, order.city) &&
        approved.has(p.id)
      )
      .map(p => ({
        id: p.id,
        name: p.partner_name,
        city: p.city,
        countryCode: p.country_code,
        email: p.email,
        whatsapp: p.whatsapp,
        priority: numberOr(p.priority, 999),
        responseMinutes: numberOr(p.response_minutes, 10),
        active: true
      }))
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
