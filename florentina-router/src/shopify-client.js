const API_VERSION = "2026-07";

export class ShopifyClient {
  constructor({ shopDomain, accessToken, fetchImpl = fetch }) {
    if (!shopDomain) throw new Error("Missing Shopify shop domain");
    if (!accessToken) throw new Error("Missing Shopify Admin access token");
    this.endpoint = `https://${shopDomain}/admin/api/${API_VERSION}/graphql.json`;
    this.accessToken = accessToken;
    this.fetch = fetchImpl;
  }

  async graphql(query, variables = {}) {
    const response = await this.fetch(this.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": this.accessToken
      },
      body: JSON.stringify({ query, variables })
    });

    if (!response.ok) {
      throw new Error(`Shopify HTTP ${response.status}`);
    }

    const body = await response.json();
    if (body.errors?.length) {
      throw new Error(`Shopify GraphQL error: ${body.errors.map(e => e.message).join("; ")}`);
    }
    return body.data;
  }

  async getCapturableAuthorization(orderId) {
    const data = await this.graphql(
      `query CapturableAuthorization($id: ID!) {
        order(id: $id) {
          id
          presentmentCurrencyCode
          totalPriceSet {
            presentmentMoney { amount currencyCode }
          }
          transactions(first: 25, capturable: true) {
            id
            kind
            status
            manuallyCapturable
            amountSet {
              presentmentMoney { amount currencyCode }
            }
          }
        }
      }`,
      { id: orderId }
    );

    const order = data.order;
    if (!order) throw new Error("Shopify order not found");

    const authorization = order.transactions.find(tx =>
      tx.kind === "AUTHORIZATION" &&
      tx.status === "SUCCESS" &&
      tx.manuallyCapturable
    );

    if (!authorization) {
      throw new Error("No capturable authorization found");
    }

    return {
      orderId: order.id,
      transactionId: authorization.id,
      amount: authorization.amountSet.presentmentMoney.amount,
      currency: authorization.amountSet.presentmentMoney.currencyCode
    };
  }

  async captureAuthorizedPayment(orderId) {
    const authorization = await this.getCapturableAuthorization(orderId);

    const data = await this.graphql(
      `mutation CaptureOrder($input: OrderCaptureInput!) {
        orderCapture(input: $input) {
          transaction {
            id
            status
            kind
            amountSet {
              presentmentMoney { amount currencyCode }
            }
          }
          userErrors { field message }
        }
      }`,
      {
        input: {
          id: authorization.orderId,
          parentTransactionId: authorization.transactionId,
          amount: authorization.amount,
          currency: authorization.currency,
          finalCapture: true
        }
      }
    );

    const result = data.orderCapture;
    if (result.userErrors?.length) {
      throw new Error(result.userErrors.map(e => e.message).join("; "));
    }
    if (!result.transaction || result.transaction.status !== "SUCCESS") {
      throw new Error("Shopify capture did not complete successfully");
    }

    return {
      captureReference: result.transaction.id,
      amount: result.transaction.amountSet.presentmentMoney.amount,
      currency: result.transaction.amountSet.presentmentMoney.currencyCode
    };
  }

  async voidAuthorization(orderId) {
    const authorization = await this.getCapturableAuthorization(orderId);

    const data = await this.graphql(
      `mutation VoidAuthorization($parentTransactionId: ID!) {
        transactionVoid(parentTransactionId: $parentTransactionId) {
          transaction { id status kind }
          userErrors { field message }
        }
      }`,
      { parentTransactionId: authorization.transactionId }
    );

    const result = data.transactionVoid;
    if (result.userErrors?.length) {
      throw new Error(result.userErrors.map(e => e.message).join("; "));
    }
    if (!result.transaction || result.transaction.status !== "SUCCESS") {
      throw new Error("Shopify void did not complete successfully");
    }

    return { voidReference: result.transaction.id };
  }
}
