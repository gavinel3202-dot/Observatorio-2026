/**
 * Servicio HTTPS de inicio de sesión de formadores.
 * REQUIERE configurar variables de servidor y firebase-admin antes de desplegar.
 * No incluir secretos en VITE_*.
 */
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import {
  normalizeTrainerCode, verifyInstitutionalPassword, issueTrainerToken,
} from "./_lib/institutionalAuth.js";
import { trainerDirectory } from "./_lib/trainerDirectory.js";
import { loginRateLimiter } from "./_lib/loginRateLimiter.js";

function firestoreAdmin() {
  const credentials = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON;
  if (!credentials) throw new Error("Firebase Admin no configurado.");
  if (!getApps().length) initializeApp({ credential: cert(JSON.parse(credentials)) });
  return getFirestore();
}

function configuredEpoch() {
  const raw = process.env.ICFG_SESSION_EPOCH;
  if (!raw || !/^\d+$/.test(raw)) throw new Error("Época de sesión no configurada.");
  return Number(raw);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  // Bloqueo preventivo: endpoint inaccesible hasta revisión de controles
  // de abuso, secretos, despliegue y pruebas en entorno aislado.
  if (process.env.ICFG_SESSION_ENABLED !== "true") {
    return res.status(503).json({ error: "Acceso institucional aún no habilitado." });
  }
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método no permitido." });
  }
  const code = normalizeTrainerCode(req.body?.code);
  const password = req.body?.password;
  if (!code || typeof password !== "string" || password.length > 256) {
    return res.status(400).json({ error: "Datos de acceso inválidos." });
  }

  try {
    const hash = process.env.ICFG_INSTITUTIONAL_PASSWORD_HASH;
    const secret = process.env.ICFG_SESSION_SECRET;
    const epoch = configuredEpoch();
    if (!hash || !secret || secret.length < 32) {
      throw new Error("Credenciales institucionales no configuradas.");
    }

    const ip = req.socket?.remoteAddress || "unknown";
    const limiter = loginRateLimiter(firestoreAdmin(), process.env.ICFG_RATE_LIMIT_SECRET);
    const limit = await limiter.check(ip, code);
    if (!limit.allowed) {
      res.setHeader("Retry-After", String(limit.retryAfterSeconds));
      return res.status(429).json({ error: "Demasiados intentos. Inténtalo más tarde." });
    }

    // Verificar hash primero y usar un mensaje genérico para no revelar códigos.
    if (!verifyInstitutionalPassword(password, hash)) {
      await limiter.recordFailure(ip, code);
      return res.status(401).json({ error: "Credenciales inválidas." });
    }
    const trainer = await trainerDirectory(firestoreAdmin()).getActive(code);
    if (!trainer) {
      await limiter.recordFailure(ip, code);
      return res.status(401).json({ error: "Credenciales inválidas." });
    }
    await limiter.recordSuccess(ip, code);
    const token = issueTrainerToken({ code, secret, epoch });
    return res.status(200).json({
      token, expiresInSeconds: 900, code: trainer.code,
    });
  } catch (error) {
    console.error("No se pudo completar la autenticación institucional:", error.message);
    return res.status(503).json({ error: "Servicio de acceso no disponible." });
  }
}
