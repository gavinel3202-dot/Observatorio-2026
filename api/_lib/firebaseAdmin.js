/**
 * Firestore Admin para funciones Vercel.
 * Solo acepta credenciales de servidor. Excepción EXCLUSIVA de pruebas:
 * Firestore Emulator + proyecto demo + entorno distinto de Vercel.
 */
export async function adminFirestore() {
  const credentials = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON;
  const emulated = process.env.VERCEL !== "1" &&
    Boolean(process.env.FIRESTORE_EMULATOR_HOST) &&
    process.env.GCLOUD_PROJECT === "demo-icfg-corrections";

  if (!credentials && !emulated) throw new Error("Firebase Admin no configurado.");

  const [{ initializeApp, cert, getApps }, { getFirestore, FieldValue }] = await Promise.all([
    import("firebase-admin/app"), import("firebase-admin/firestore"),
  ]);

  if (!getApps().length) {
    const config = emulated
      ? { projectId: "demo-icfg-corrections" }
      : { credential: cert(JSON.parse(credentials)) };
    initializeApp(config);
  }
  return {
    firestore: getFirestore(),
    serverTimestamp: () => FieldValue.serverTimestamp(),
  };
}
