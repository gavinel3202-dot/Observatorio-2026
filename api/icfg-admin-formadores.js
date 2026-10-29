/**
 * API administrativa ICFG. Deshabilitada por defecto; NO publicar credenciales.
 * Administrador único: Firebase Auth personal, claim icfgAdmin y segundo factor.
 * Solo lectura puntual y altas/suspensiones, sin eliminar documentos.
 */
import { adminFirestore } from "./_lib/firebaseAdmin.js";
import { verifyAdministrator, AdminAccessError } from "./_lib/adminAuthorization.js";
import {
  getTrainerForAdmin, setTrainerByAdmin, TrainerAdminError,
} from "./_lib/adminTrainerService.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (process.env.ICFG_ADMIN_ENABLED !== "true") {
    return res.status(503).json({ error: "Administración institucional todavía no habilitada." });
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método no permitido." });
  }

  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body) ||
      JSON.stringify(body).length > 4096 ||
      !["get", "set"].includes(body.action)) {
    return res.status(400).json({ error: "Solicitud administrativa inválida." });
  }
  const allowedKeys = body.action === "get"
    ? ["action", "code"]
    : ["action", "code", "displayName", "active", "reason", "expectedRevision"];
  if (Object.keys(body).some((key) => !allowedKeys.includes(key))) {
    return res.status(400).json({ error: "Campos administrativos no autorizados." });
  }

  try {
    // Firebase debe inicializarse antes de getAuth(). No usar sesiones
    // de formador ni contraseñas compartidas para administrar permisos.
    const { firestore, serverTimestamp } = await adminFirestore();
    const { getAuth } = await import("firebase-admin/auth");
    const admin = await verifyAdministrator({
      authorization: req.headers?.authorization,
      authClient: getAuth(),
      allowedUid: process.env.ICFG_ADMIN_UID,
    });

    if (body.action === "get") {
      const found = await getTrainerForAdmin({ firestore, admin, code: body.code });
      return res.status(200).json(found);
    }

    const saved = await setTrainerByAdmin({
      firestore, serverTimestamp, admin, code: body.code,
      displayName: body.displayName, active: body.active,
      expectedRevision: body.expectedRevision, reason: body.reason,
    });
    return res.status(200).json(saved);
  } catch (error) {
    if (error instanceof AdminAccessError || error instanceof TrainerAdminError) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error("Falló servicio administrativo ICFG:", error?.name || "Error");
    return res.status(503).json({ error: "Servicio administrativo no disponible." });
  }
}
