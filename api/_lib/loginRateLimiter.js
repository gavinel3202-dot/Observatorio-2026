/**
 * Limitador distribuido de intentos de inicio de sesión.
 * Solo servidor: Firestore Admin SDK y transacciones atómicas.
 * La clave del contador es un HMAC; no guarda IP ni código en claro.
 */
import { createHmac } from "node:crypto";

const WINDOW_MS = 15 * 60_000;
const LOCK_MS = 15 * 60_000;
const MAX_ATTEMPTS = 5;
const COLLECTION = "icfg_login_attempts_private";

function keyFor(kind, value, secret) {
  if (typeof secret !== "string" || secret.length < 32) {
    throw new Error("Se requiere secreto independiente para el limitador.");
  }
  return createHmac("sha256", secret).update(kind + ":" + value).digest("hex");
}

export function loginRateLimiter(firestore, secret, clock = () => Date.now()) {
  if (!firestore?.runTransaction || !firestore?.collection) {
    throw new Error("Firestore Admin no disponible.");
  }
  const refFor = (kind, value) =>
    firestore.collection(COLLECTION).doc(keyFor(kind, value, secret));

  async function check(kind, value) {
    const now = clock();
    const snap = await refFor(kind, value).get();
    const state = snap.exists ? snap.data() : {};
    const blockedUntil = Number(state.blockedUntil || 0);
    const retryAfterSeconds = Math.max(0, Math.ceil((blockedUntil - now) / 1000));
    return { allowed: retryAfterSeconds === 0, retryAfterSeconds };
  }

  async function failure(kind, value) {
    const ref = refFor(kind, value);
    return firestore.runTransaction(async (tx) => {
      const now = clock();
      const snap = await tx.get(ref);
      const previous = snap.exists ? snap.data() : {};
      if (Number(previous.blockedUntil || 0) > now) {
        return { allowed: false, retryAfterSeconds: Math.ceil((previous.blockedUntil - now) / 1000) };
      }
      const windowStart = Number(previous.windowStart || 0);
      const withinWindow = now - windowStart < WINDOW_MS && now >= windowStart;
      const attempts = (withinWindow ? Number(previous.attempts || 0) : 0) + 1;
      const blockedUntil = attempts >= MAX_ATTEMPTS ? now + LOCK_MS : 0;
      tx.set(ref, {
        attempts, windowStart: withinWindow ? windowStart : now,
        blockedUntil,
        // TTL de Firestore opcional: activar política TTL para este campo.
        expiresAt: new Date(now + WINDOW_MS + LOCK_MS + 60_000),
      });
      return { allowed: blockedUntil === 0, retryAfterSeconds: Math.ceil((blockedUntil - now) / 1000) };
    });
  }

  async function success(kind, value) {
    await refFor(kind, value).delete();
  }

  return {
    async check(ip, code) {
      const results = await Promise.all([check("ip", ip), check("code", code)]);
      return {
        allowed: results.every((r) => r.allowed),
        retryAfterSeconds: Math.max(...results.map((r) => r.retryAfterSeconds)),
      };
    },
    async recordFailure(ip, code) {
      const results = await Promise.all([failure("ip", ip), failure("code", code)]);
      return {
        allowed: results.every((r) => r.allowed),
        retryAfterSeconds: Math.max(...results.map((r) => r.retryAfterSeconds)),
      };
    },
    async recordSuccess(ip, code) {
      // No borrar el contador IP: evitar que un acceso válido permita
      // probar indefinidamente otros códigos desde la misma IP.
      await success("code", code);
    },
  };
}
