/**
 * Primitivas de sesión institucional, solo Node.js/servidor.
 * NUNCA importar desde src/ ni incluir secretos en VITE_*.
 * Esta librería no concede permisos ni accede a Firestore.
 */
import { createHmac, scryptSync, timingSafeEqual, randomBytes } from "node:crypto";

const TOKEN_TTL_SECONDS = 15 * 60;
const MAX_CODE_LENGTH = 64;

export function normalizeTrainerCode(value) {
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase();
  return /^[A-Z0-9_-]{3,64}$/.test(code) && code.length <= MAX_CODE_LENGTH ? code : null;
}

export function hashInstitutionalPassword(password, saltHex = randomBytes(16).toString("hex")) {
  if (typeof password !== "string" || password.length < 12) {
    throw new Error("La contraseña institucional debe tener al menos 12 caracteres.");
  }
  const salt = Buffer.from(saltHex, "hex");
  if (salt.length !== 16) throw new Error("Sal inválida.");
  return `scrypt:${saltHex}:${scryptSync(password, salt, 64).toString("hex")}`;
}

export function verifyInstitutionalPassword(password, encoded) {
  if (typeof password !== "string" || typeof encoded !== "string") return false;
  const parts = encoded.split(":");
  if (parts.length !== 3 || parts[0] !== "scrypt" ||
      !/^[a-f0-9]{32}$/i.test(parts[1]) || !/^[a-f0-9]{128}$/i.test(parts[2])) return false;
  const expected = Buffer.from(parts[2], "hex");
  const actual = scryptSync(password, Buffer.from(parts[1], "hex"), expected.length);
  return timingSafeEqual(expected, actual);
}

function b64url(value) {
  return Buffer.from(value).toString("base64url");
}

function signature(payload, secret) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function issueTrainerToken({ code, secret, epoch = 0, now = Date.now() }) {
  const normalized = normalizeTrainerCode(code);
  if (!normalized || typeof secret !== "string" || secret.length < 32) {
    throw new Error("Configuración de sesión inválida.");
  }
  const body = b64url(JSON.stringify({
    code: normalized, role: "formador", epoch,
    iat: Math.floor(now / 1000), exp: Math.floor(now / 1000) + TOKEN_TTL_SECONDS,
  }));
  return `${body}.${signature(body, secret)}`;
}

export function verifyTrainerToken(token, secret, { epoch = 0, now = Date.now() } = {}) {
  if (typeof token !== "string" || typeof secret !== "string" || secret.length < 32) return null;
  const parts = token.split(".");
  if (parts.length !== 2 || parts[0].length > 2048) return null;
  const expected = Buffer.from(signature(parts[0], secret));
  const supplied = Buffer.from(parts[1]);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
  try {
    const claims = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    const current = Math.floor(now / 1000);
    if (claims.role !== "formador" || !normalizeTrainerCode(claims.code) ||
        claims.epoch !== epoch || !Number.isInteger(claims.iat) ||
        !Number.isInteger(claims.exp) || claims.iat > current + 30 ||
        claims.exp <= current || claims.exp - claims.iat > TOKEN_TTL_SECONDS) return null;
    return claims;
  } catch {
    return null;
  }
}
