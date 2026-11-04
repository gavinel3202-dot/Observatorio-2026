/**
 * Diagnóstico OIDC de solo lectura del backend ICFG de ensayos.
 *
 * Deshabilitado por defecto. Requiere sesión administrativa individual con
 * TOTP y comprueba una evaluación FICTICIA sin devolver datos personales.
 * No incluye operaciones de escritura ni modifica las banderas operativas.
 */
import { adminFirestore } from "./_lib/firebaseAdmin.js";
import { verifyAdministrator, AdminAccessError } from "./_lib/adminAuthorization.js";

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

  try {
    const { firestore, auth } = await adminFirestore({
      requestHeaders: req.headers,
    });
    await verifyAdministrator({
      authorization: req.headers?.authorization,
      authClient: auth,
      allowedUid: process.env.ICFG_ADMIN_UID,
    });

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
    console.error("Diagnóstico OIDC de ensayos no disponible:", error?.name || "Error");
    return res.status(503).json({ error: "No se pudo verificar la conexión de ensayos." });
  }
}
