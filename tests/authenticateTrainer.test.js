import test from "node:test";
import assert from "node:assert/strict";
import { hashInstitutionalPassword, verifyTrainerToken } from "../api/_lib/institutionalAuth.js";
import { loginRateLimiter } from "../api/_lib/loginRateLimiter.js";
import { authenticateTrainer } from "../api/_lib/authenticateTrainer.js";

function fakeFirestore() {
  const data = new Map();
  return {
    collection() {
      return { doc(id) {
        return {
          id,
          async get() { return { exists: data.has(id), data: () => data.get(id) }; },
          async delete() { data.delete(id); },
        };
      } };
    },
    async runTransaction(callback) {
      return callback({
        async get(ref) { return ref.get(); },
        set(ref, value) { data.set(ref.id, value); },
      });
    },
  };
}

function setup() {
  let now = 2_000_000_000_000;
  const db = fakeFirestore();
  const limiter = loginRateLimiter(db, "independent-private-rate-limiting-secret-1234", () => now);
  const hash = hashInstitutionalPassword("Institucional-Ficticia-12345!");
  const sessionSecret = "secret-for-testing-signed-sessions-1234567890";
  const directory = { async getActive(code) {
    return code === "F001" ? { code: "F001", displayName: "Ejemplo" } : null;
  } };
  const request = (patch = {}) => authenticateTrainer({
    code: "F001", ip: "198.51.100.9", password: "Institucional-Ficticia-12345!",
    hash, sessionSecret, epoch: 0, limiter, directory, ...patch,
  });
  return { request, sessionSecret, advance: (ms) => { now += ms; } };
}

test("formador activo y contraseña correcta reciben sesión de 15 minutos", async () => {
  const { request, sessionSecret } = setup();
  const response = await request();
  assert.equal(response.status, 200);
  assert.equal(response.body.code, "F001");
  assert.equal(response.body.expiresInSeconds, 900);
  assert.equal(verifyTrainerToken(response.body.token, sessionSecret)?.code, "F001");
});

test("código inexistente no divulga información personal", async () => {
  const { request } = setup();
  const r = await request({ code: "F999" });
  assert.equal(r.status, 401);
  assert.equal(r.body.error, "Credenciales inválidas.");
});

test("cinco contraseñas falsas provocan bloqueo de 15 minutos", async () => {
  const { request, advance } = setup();
  for (let i = 0; i < 5; i++) {
    const r = await request({ password: "incorrecta" });
    assert.equal(r.status, 401);
  }
  const blocked = await request();
  assert.equal(blocked.status, 429);
  assert.ok(blocked.retryAfterSeconds > 0);
  advance(15 * 60_000 + 1);
  assert.equal((await request()).status, 200);
});

test("un acceso válido no desbloquea el contador compartido de IP", async () => {
  const { request } = setup();
  for (let i = 0; i < 4; i++) {
    await request({ code: "F999", password: "incorrecta" });
  }
  assert.equal((await request()).status, 200);
  await request({ code: "F999", password: "incorrecta" });
  assert.equal((await request()).status, 429);
});
