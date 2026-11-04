/**
 * Diagnóstico OIDC de solo lectura del backend ICFG de ensayos.
 *
 * Deshabilitado por defecto. Requiere sesión administrativa individual con
 * TOTP y comprueba una evaluación FICTICIA sin devolver datos personales.
 * No incluye operaciones de escritura ni modifica las banderas operativas.
 */
import { adminFirestore } from "./_lib/firebaseAdmin.js";
import { verifyAdministrator, AdminAccessError } from "./_lib/adminAuthorization.js";
import { IcfgOidcError } from "./_lib/vercelWorkloadIdentity.js";

const DEMO_DOCUMENT =
  "artifacts/icfg-app-id/public/data/evaluaciones_icfg/EVAL-PRUEBA-001";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (process.env.ICFG_OIDC_DIAGNOSTIC_ENABLED !== "true") {
    return res.status(503).json({ error: "Diagnóstico OIDC no habilitado." });
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método no permitido." });
  }
  if (req.body && Object.keys(req.body).length) {
    return res.status(400).json({ error: "El diagnóstico no acepta datos." });
  }

  let stage = "firebase_initialization";
  let cleanup = null;
  try {
    const { firestore, auth, cleanup: dispose } = await adminFirestore({
      requestHeaders: req.headers,
    });
    cleanup = dispose;
    stage = "admin_verification";
    await verifyAdministrator({
      authorization: req.headers?.authorization,
      authClient: auth,
      allowedUid: process.env.ICFG_ADMIN_UID,
    });

    stage = "firestore_read";
    // La única operación sobre Firestore es una lectura de existencia.
    const testDocument = await firestore.doc(DEMO_DOCUMENT).get();
    return res.status(200).json({
      ok: true,
      environment: "observatorio-icfg-pruebas",
      oidc: "authenticated",
      firestoreRead: "success",
      syntheticDocumentFound: testDocument.exists,
    });
  } catch (error) {
    if (error instanceof AdminAccessError) {
      return res.status(error.status).json({ error: error.message });
    }
    // Los códigos y etapas son datos no secretos. Nunca devolver ni registrar
    // JWT, contraseñas, credenciales temporales ni respuestas completas.
    const safeStage = error instanceof IcfgOidcError ? error.stage : stage;
    const safeCode = typeof error?.code === "string" ? error.code.slice(0, 72) : "none";
    console.error("Diagnóstico OIDC de ensayos:", { stage: safeStage, code: safeCode,
      errorType: error?.name || "Error" });
    return res.status(503).json({
      error: "No se pudo verificar la conexión de ensayos.",
      stage: safeStage,
    });
  } finally {
    // Cerrar clientes y liberar tokens vinculados a esta invocación.
    if (cleanup) await cleanup();
  }
}
