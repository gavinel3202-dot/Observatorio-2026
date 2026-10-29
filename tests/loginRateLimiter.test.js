import test from "node:test";
import assert from "node:assert/strict";
import { loginRateLimiter } from "../api/_lib/loginRateLimiter.js";

function memoryFirestore() {
  const docs = new Map();
  return {
    collection() {
      return { doc(id) {
        return {
          id,
          async get() { return { exists: docs.has(id), data: () => docs.get(id) }; },
          async delete() { docs.delete(id); },
        };
      } };
    },
    async runTransaction(fn) {
      return fn({
        async get(ref) { return ref.get(); },
        set(ref, data) { docs.set(ref.id, data); },
      });
    },
  };
}

test("bloquea al quinto fallo y permite reintento tras 15 minutos", async () => {
  let now = 1000000;
  const limiter = loginRateLimiter(memoryFirestore(), "secreto-independiente-de-pruebas-de-32-caracteres", () => now);
  for (let i = 0; i < 4; i++) {
    assert.equal((await limiter.recordFailure("ip1", "F001")).allowed, true);
  }
  const fifth = await limiter.recordFailure("ip1", "F001");
  assert.equal(fifth.allowed, false);
  assert.equal((await limiter.check("ip1", "F001")).allowed, false);
  now += 15 * 60_000 + 1;
  assert.equal((await limiter.check("ip1", "F001")).allowed, true);
});

test("un código distinto no elude bloqueo de IP", async () => {
  const limiter = loginRateLimiter(memoryFirestore(), "secreto-independiente-de-pruebas-de-32-caracteres");
  for (let i = 0; i < 5; i++) await limiter.recordFailure("ip1", "F001");
  assert.equal((await limiter.check("ip1", "F002")).allowed, false);
  assert.equal((await limiter.check("ip2", "F002")).allowed, true);
});
