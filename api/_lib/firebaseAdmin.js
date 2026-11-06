/**
 * Clientes administrativos ICFG para el proyecto aislado de ensayos.
 *
 * En Vercel NO se usan claves privadas JSON ni el proyecto institucional.
 * La identidad OIDC de cada solicitud se intercambia por un token de servicio
 * temporal y se utiliza en Firestore mediante google-auth-library.
 *
 * Firebase Admin Firestore no admite credenciales arbitrarias; por eso
 * @google-cloud/firestore recibe un GoogleAuth autenticado. Firebase Auth
 * usa Firebase Admin con una credencial efímera separada.
 *
 * En pruebas locales se mantiene el Firebase Emulator exclusivamente
 * con el ID demo-icfg-corrections.
 */
import { randomUUID } from "node:crypto";
import {
  STAGING_PROJECT,
  requireStagingOidcConfiguration,
  vercelOidcTokenFromHeaders,
  getShortLivedServiceAccountToken,
} from "./vercelWorkloadIdentity.js";

export async function adminFirestore({ requestHeaders } = {}) {
  const emulated = process.env.VERCEL !== "1" &&
    Boolean(process.env.FIRESTORE_EMULATOR_HOST) &&
    process.env.GCLOUD_PROJECT === "demo-icfg-corrections";

  const [{ initializeApp, getApps, deleteApp },
    { getFirestore, FieldValue: AdminFieldValue },
    { getAuth }] = await Promise.all([
    import("firebase-admin/app"),
    import("firebase-admin/firestore"),
    import("firebase-admin/auth"),
  ]);

  if (emulated) {
    let app = getApps().find(a => a.name === "[DEFAULT]");
    if (!app) app = initializeApp({ projectId: "demo-icfg-corrections" });
    if (app.options.projectId !== "demo-icfg-corrections") {
      throw new Error("El emulador apunta a un proyecto no autorizado.");
    }
    return {
      firestore: getFirestore(app),
      auth: getAuth(app),
      serverTimestamp: () => AdminFieldValue.serverTimestamp(),
      cleanup: async () => {},
    };
  }

  requireStagingOidcConfiguration();
  const oidc = vercelOidcTokenFromHeaders(requestHeaders);
  // Es obligatorio validar cada solicitud ante STS e IAM antes de crear
  // clientes; ningún JWT ni credencial temporal persiste en estado global.
  const token = await getShortLivedServiceAccountToken(oidc);

  const [{ GoogleAuth, OAuth2Client }, { Firestore, FieldValue }] =
    await Promise.all([
      import("google-auth-library"),
      import("@google-cloud/firestore"),
    ]);

  const authClient = new OAuth2Client();
  authClient.setCredentials({
    access_token: token.access_token,
    expiry_date: Date.now() + token.expires_in * 1000,
    token_type: "Bearer",
  });
  const cloudAuth = new GoogleAuth({
    projectId: STAGING_PROJECT,
    authClient,
  });

  // Instancia por solicitud: no mezclar tokens de distintos usuarios,
  // despliegues o solicitudes calientes de Vercel.
  const firestore = new Firestore({
    projectId: STAGING_PROJECT,
    auth: cloudAuth,
    preferRest: true,
  });

  const app = initializeApp({
    projectId: STAGING_PROJECT,
    credential: {
      getAccessToken: async () => ({
        access_token: token.access_token,
        expires_in: token.expires_in,
      }),
    },
  }, "icfg-staging-" + randomUUID());

  return {
    firestore,
    auth: getAuth(app),
    serverTimestamp: () => FieldValue.serverTimestamp(),
    cleanup: async () => {
      // No reutilizar credenciales temporales entre invocaciones.
      const results = await Promise.allSettled([
        firestore.terminate(),
        deleteApp(app),
      ]);
      if (results.some(r => r.status === "rejected")) {
        console.error("ICFG: no se pudo cerrar un cliente temporal.");
      }
    },
  };
}
