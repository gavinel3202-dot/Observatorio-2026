/**
 * API de corrección ICFG. Deshabilitada por defecto (fail closed).
 * Activar SOLO en un proyecto Firebase de pruebas con reglas y respaldos
 * verificados. No usa las credenciales anónimas del navegador.
 */
import { adminFirestore } from "./_lib/firebaseAdmin.js";
import { verifyTrainerToken } from "./_lib/institutionalAuth.js";
import { trainerDirectory } from "./_lib/trainerDirectory.js";
import { correctEvaluation, CorrectionError } from "./_lib/correctionService.js";



export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (process.env.ICFG_CORRECTIONS_ENABLED !== "true") {
    return res.status(503).json({ error: "Guardado de correcciones no habilitado." });
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método no permitido." });
  }
  try {
    const secret = process.env.ICFG_SESSION_SECRET;
    const epochRaw = process.env.ICFG_SESSION_EPOCH;
    if (!secret || !/^\d+$/.test(epochRaw || "")) {
      throw new Error("Configuración de sesión incompleta.");
    }
    const authorization = req.headers?.authorization || "";
    if (!/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(authorization)) {
      return res.status(401).json({ error: "Sesión requerida." });
    }
    const claims = verifyTrainerToken(authorization.slice(7), secret, { epoch: Number(epochRaw) });
    if (!claims) return res.status(401).json({ error: "Sesión inválida o vencida." });

    const body = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body) ||
        JSON.stringify(body).length > 16000 ||
        Object.keys(body).some((k) => !["documentId", "expectedRevision", "changes", "reason"].includes(k))) {
      return res.status(400).json({ error: "Solicitud inválida." });
    }

    const { firestore, serverTimestamp } = await adminFirestore();
    const active = await trainerDirectory(firestore).getActive(claims.code);
    if (!active) return res.status(403).json({ error: "Formador no autorizado." });

    const saved = await correctEvaluation({
      firestore, serverTimestamp, actorCode: active.code,
      documentId: body.documentId,
      expectedRevision: body.expectedRevision,
      changes: body.changes,
      reason: body.reason,
    });
    return res.status(200).json(saved);
  } catch (error) {
    if (error instanceof CorrectionError) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error("Falló el servicio de corrección ICFG:", error?.name || "Error");
    return res.status(503).json({ error: "Servicio de corrección no disponible." });
  }
}
