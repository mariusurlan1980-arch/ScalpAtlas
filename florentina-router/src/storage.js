import fs from "node:fs/promises";
import path from "node:path";

export class InMemoryOrderRepository {
  constructor(seed = []) {
    this.orders = new Map(seed.map(order => [order.id, structuredClone(order)]));
    this.audit = [];
  }

  async get(id) {
    const order = this.orders.get(id);
    return order ? structuredClone(order) : null;
  }

  async save(order) {
    if (!order?.id) throw new Error("Order requires id");
    this.orders.set(order.id, structuredClone(order));
    return structuredClone(order);
  }

  async appendAudit(entry) {
    this.audit.push(structuredClone(entry));
  }

  async listAudit() {
    return structuredClone(this.audit);
  }
}

export class JsonOrderRepository {
  #queue = Promise.resolve();

  constructor(filePath) {
    this.filePath = filePath;
  }

  async init() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      await fs.access(this.filePath);
    } catch {
      await this.#writeState({ orders: {}, audit: [] });
    }
  }

  async get(id) {
    const state = await this.#readState();
    return state.orders[id] ? structuredClone(state.orders[id]) : null;
  }

  async save(order) {
    if (!order?.id) throw new Error("Order requires id");
    return this.#mutate(state => {
      state.orders[order.id] = structuredClone(order);
      return structuredClone(order);
    });
  }

  async appendAudit(entry) {
    await this.#mutate(state => {
      state.audit.push(structuredClone(entry));
    });
  }

  async listAudit() {
    const state = await this.#readState();
    return structuredClone(state.audit);
  }

  async #mutate(fn) {
    const job = this.#queue.then(async () => {
      const state = await this.#readState();
      const result = fn(state);
      await this.#writeState(state);
      return result;
    });
    this.#queue = job.catch(() => {});
    return job;
  }

  async #readState() {
    const raw = await fs.readFile(this.filePath, "utf8");
    const parsed = JSON.parse(raw);
    parsed.orders ??= {};
    parsed.audit ??= [];
    return parsed;
  }

  async #writeState(state) {
    const temp = `${this.filePath}.tmp`;
    await fs.writeFile(temp, JSON.stringify(state, null, 2), "utf8");
    await fs.rename(temp, this.filePath);
  }
}
