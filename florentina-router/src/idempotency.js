export class InMemoryIdempotencyLedger {
  #seen = new Set();

  has(key) {
    return key ? this.#seen.has(key) : false;
  }

  mark(key) {
    if (key) this.#seen.add(key);
  }

  size() {
    return this.#seen.size;
  }
}
