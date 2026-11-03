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
    let config;
    if (emulated) {
      config = { projectId: "demo-icfg-corrections" };
    } else {
      // Bloqueo de entorno: jamás aceptar por accidente credenciales
      // del Firebase institucional en el servidor aislado de ensayos.
      const expected = process.env.ICFG_EXPECTED_FIREBASE_PROJECT_ID;
      if (expected !== "observatorio-icfg-pruebas") {
        throw new Error("Proyecto Firebase de ensayo no autorizado.");
      }
      let parsed;
      try {
        parsed = JSON.parse(credentials);
      } catch {
        throw new Error("Credencial del servidor inválida.");
      }
      if (parsed?.project_id !== expected) {
        throw new Error("La credencial Firebase no corresponde al proyecto de ensayo.");
      }
      config = { credential: cert(parsed), projectId: expected };
    }
    initializeApp(config);
  } else if (!emulated && getApps()[0].options.projectId !== "observatorio-icfg-pruebas") {
    throw new Error("Firebase Admin estaba inicializado con un proyecto no autorizado.");
  }
  return {
    firestore: getFirestore(),
    serverTimestamp: () => FieldValue.serverTimestamp(),
  };
}
