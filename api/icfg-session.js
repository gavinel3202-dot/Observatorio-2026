/**
 * Servicio HTTPS de inicio de sesión de formadores.
 * REQUIERE configurar variables de servidor y firebase-admin antes de desplegar.
 * No incluir secretos en VITE_*.
 */
import {
  normalizeTrainerCode,
} from "./_lib/institutionalAuth.js";
import { trainerDirectory } from "./_lib/trainerDirectory.js";
import { loginRateLimiter } from "./_lib/loginRateLimiter.js";
import { authenticateTrainer } from "./_lib/authenticateTrainer.js";

async function firestoreAdmin() {
  const credentials = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON;
  if (!credentials) throw new Error("Firebase Admin no configurado.");
  const [{ initializeApp, cert, getApps }, { getFirestore }] = await Promise.all([
    import("firebase-admin/app"), import("firebase-admin/firestore"),
  ]);
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

    // En Vercel, el proxy sustituye X-Forwarded-For para evitar IP simuladas.
    // No confiar en cabeceras forward desde un servidor local sin proxy confiable.
    const forwarded = process.env.VERCEL === "1"
      ? (req.headers?.["x-vercel-forwarded-for"] || req.headers?.["x-forwarded-for"])
      : null;
    const ip = String(forwarded || req.socket?.remoteAddress || "unknown").split(",")[0].trim();
    const adminDb = await firestoreAdmin();
    const limiter = loginRateLimiter(adminDb, process.env.ICFG_RATE_LIMIT_SECRET);
    const result = await authenticateTrainer({
      code, password, ip, hash, sessionSecret: secret, epoch,
      limiter, directory: trainerDirectory(adminDb),
    });
    if (result.retryAfterSeconds) {
      res.setHeader("Retry-After", String(result.retryAfterSeconds));
    }
    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error("No se pudo completar la autenticación institucional:", error.message);
    return res.status(503).json({ error: "Servicio de acceso no disponible." });
  }
}
