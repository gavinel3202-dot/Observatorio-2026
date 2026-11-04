/**
 * Firestore y Firebase Authentication Admin para funciones Vercel.
 *
 * Producción de ENSAYOS: solo OIDC Vercel -> Google STS -> cuenta de servicio
 * con permisos mínimos. No se admiten claves privadas JSON permanentes.
 * El proyecto institucional nunca se usa en este backend de ensayo.
 *
 * Excepción EXCLUSIVA: Firebase Emulator local (demo-icfg-corrections).
 */
import {
  STAGING_PROJECT,
  requireStagingOidcConfiguration,
  vercelOidcTokenFromHeaders,
  getShortLivedServiceAccountToken,
} from "./vercelWorkloadIdentity.js";

const OIDC_APP_NAME = "icfg-staging-oidc";
let lastVercelOidcToken = null;

// Firebase Admin solicita getAccessToken al renovar sus credenciales.
// El token más reciente se aporta en cada invocación de la función, de modo
// que una instancia caliente de Vercel no dependa de un JWT ya caducado.
const federatedCredential = {
  async getAccessToken() {
    if (!lastVercelOidcToken) throw new Error("Token OIDC de función no disponible.");
    try {
      return await getShortLivedServiceAccountToken(lastVercelOidcToken);
    } catch (error) {
      // Solo registrar etapa controlada: nunca JWT ni respuestas de Google.
      const stage = ["server_configuration", "vercel_oidc", "google_sts",
        "iam_impersonation"].includes(error?.stage) ? error.stage : "exchange_network";
      console.error("ICFG OIDC intercambio detenido en etapa:", stage);
      throw error;
    }
  },
};

export async function adminFirestore({ requestHeaders } = {}) {
  const emulated = process.env.VERCEL !== "1" &&
    Boolean(process.env.FIRESTORE_EMULATOR_HOST) &&
    process.env.GCLOUD_PROJECT === "demo-icfg-corrections";

  if (!emulated) {
    requireStagingOidcConfiguration();
    // Es obligatorio obtener un token de esta invocación. No reutilizar
    // el token de una solicitud previa para autorizar una petición nueva.
    lastVercelOidcToken = vercelOidcTokenFromHeaders(requestHeaders);
  }

  const [
    { initializeApp, getApps },
    { getFirestore, FieldValue },
    { getAuth },
  ] = await Promise.all([
    import("firebase-admin/app"),
    import("firebase-admin/firestore"),
    import("firebase-admin/auth"),
  ]);

  let app;
  if (emulated) {
    // Mantener el proyecto demo como aplicación por defecto para las
    // pruebas de integración existentes con el emulador.
    app = getApps().find((a) => a.name === "[DEFAULT]");
    if (!app) app = initializeApp({ projectId: "demo-icfg-corrections" });
    if (app.options.projectId !== "demo-icfg-corrections") {
      throw new Error("Firebase Emulator apunta a un proyecto incorrecto.");
    }
  } else {
    app = getApps().find((a) => a.name === OIDC_APP_NAME);
    if (!app) {
      app = initializeApp({
        credential: federatedCredential,
        projectId: STAGING_PROJECT,
      }, OIDC_APP_NAME);
    }
    if (app.options.projectId !== STAGING_PROJECT) {
      throw new Error("Firebase Admin estaba inicializado con un proyecto no autorizado.");
    }
  }

  return {
    firestore: getFirestore(app),
    auth: getAuth(app),
    serverTimestamp: () => FieldValue.serverTimestamp(),
  };
}
