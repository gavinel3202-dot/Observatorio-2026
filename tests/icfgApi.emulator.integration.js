/**
 * Integración completa con Firestore Emulator: contraseña compartida,
 * código de formador, sesión firmada, guardado y auditoría.
 * Solo datos ficticios; ningún acceso al proyecto Firebase de producción.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { getFirestore } from "firebase-admin/firestore";
import { hashInstitutionalPassword } from "../api/_lib/institutionalAuth.js";
import { adminFirestore } from "../api/_lib/firebaseAdmin.js";
import loginHandler from "../api/icfg-session.js";
import correctionHandler from "../api/icfg-corrections.js";

if (process.env.FIRESTORE_EMULATOR_HOST === undefined ||
    process.env.GCLOUD_PROJECT !== "demo-icfg-corrections" ||
    process.env.VERCEL === "1") {
  throw new Error("Solo se ejecutan estas pruebas con Firestore Emulator.");
}

const password = "Institucional-Demo-2026-Solo-Test!";
process.env.ICFG_SESSION_ENABLED = "true";
process.env.ICFG_CORRECTIONS_ENABLED = "true";
process.env.ICFG_SESSION_EPOCH = "1";
process.env.ICFG_SESSION_SECRET = "clave-sesiones-demo-no-valida-fuera-de-tests-2026";
process.env.ICFG_RATE_LIMIT_SECRET = "clave-contadores-demo-no-valida-fuera-de-tests-2026";
process.env.ICFG_INSTITUTIONAL_PASSWORD_HASH = hashInstitutionalPassword(password);

function res() {
  return {
    code: 200, body: null, headers: {},
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

async function post(handler, payload, token, ip = "203.0.113.5") {
  const response = res();
  await handler({
    method: "POST",
    headers: token ? { authorization: "Bearer " + token } : {},
    body: payload,
    socket: { remoteAddress: ip },
  }, response);
  return response;
}

test("login real con código activo, corrección, auditoría y revocación", async () => {
  await adminFirestore();
  const db = getFirestore();
  const directoryRef = db.collection("icfg_formadores_privados").doc("F100");
  await directoryRef.set({ active: true, role: "formador", displayName: "Formador DEMO" });
  const docRef = db.collection("artifacts/icfg-app-id/public/data/evaluaciones_icfg").doc("E2E-DEMO01");
  await docRef.set({
    nombre: "Persona ficticia", edad: "57", tipoDocumento: "CC",
    numeroDocumento: "DEMO-123", sexo: "Hombre", sede: "Sede ficticia",
    fecha: "2026-10-01", peso: "82", talla: "167",
    scores: {
      prension: "35", salto: "20", core: "17", flexiones: "15",
      trote2k: "18", perimetro: "92", equilibrio: "30", flexibilidad: "12",
    },
    timestamp: 1_800_000_000_000, revision: 0,
  });

  const session = await post(loginHandler, { code: "F100", password });
  assert.equal(session.code, 200, JSON.stringify(session.body));
  assert.ok(session.body.token);
  const correction = await post(correctionHandler, {
    documentId: "E2E-DEMO01", expectedRevision: 0,
    changes: { person: { peso: "80" } },
    reason: "Se verificó un error de digitación",
  }, session.body.token);
  assert.equal(correction.code, 200, JSON.stringify(correction.body));
  assert.equal(correction.body.revision, 1);
  assert.equal((await docRef.get()).data().peso, "80");
  const audits = await db.collection("icfg_corrections_audit_private")
    .where("evaluationId", "==", "E2E-DEMO01").get();
  assert.equal(audits.size, 1);
  assert.equal(audits.docs[0].data().actorCode, "F100");

  await directoryRef.update({ active: false });
  const disabled = await post(correctionHandler, {
    documentId: "E2E-DEMO01", expectedRevision: 1,
    changes: { person: { peso: "79" } },
    reason: "Otro error de digitación verificado",
  }, session.body.token);
  assert.equal(disabled.code, 403);
  assert.equal((await docRef.get()).data().peso, "80");
});

test("cinco errores de contraseña bloquean IP y código", async () => {
  const ip = "203.0.113.9";
  for (let i = 0; i < 5; i++) {
    const invalid = await post(loginHandler,
      { code: "F101", password: "CONTRASENA-INCORRECTA" }, null, ip);
    assert.equal(invalid.code, 401);
  }
  const blocked = await post(loginHandler,
    { code: "F101", password }, null, ip);
  assert.equal(blocked.code, 429);
  assert.ok(Number(blocked.headers["retry-after"]) > 0);
});


test("administrador: alta y suspensión con auditoría real en Firestore Emulator", async () => {
  const { firestore, serverTimestamp } = await adminFirestore();
  const admin = { uid: "UID_ADMIN_DEMO", role: "admin", mfaVerified: true };
  const { getTrainerForAdmin, setTrainerByAdmin } = await import("../api/_lib/adminTrainerService.js");
  const code = "F200";
  const create = await setTrainerByAdmin({
    firestore, serverTimestamp, admin, code,
    displayName: "Formador Ficticio", active: true, expectedRevision: 0,
    reason: "Alta de prueba autorizada por administración",
  });
  assert.equal(create.revision, 1);
  const lookup = await getTrainerForAdmin({ firestore, admin, code });
  assert.equal(lookup.active, true);
  const suspend = await setTrainerByAdmin({
    firestore, serverTimestamp, admin, code,
    displayName: "Formador Ficticio", active: false, expectedRevision: 1,
    reason: "Suspensión ficticia autorizada por administración",
  });
  assert.equal(suspend.revision, 2);
  assert.equal((await getTrainerForAdmin({ firestore, admin, code })).active, false);
  const audit = await firestore.collection("icfg_formadores_audit_private")
    .where("formadorCode", "==", code).get();
  assert.equal(audit.size, 2);
  for (const doc of audit.docs) {
    assert.equal(doc.data().adminUid, admin.uid);
    assert.ok(doc.data().timestamp?.toDate);
  }
  await assert.rejects(
    setTrainerByAdmin({
      firestore, serverTimestamp, admin, code,
      displayName: "Formador Ficticio", active: true, expectedRevision: 1,
      reason: "Reactivación con versión obsoleta",
    }),
    (error) => error.status === 409
  );
  // No se hizo ningún borrado físico.
  assert.equal((await firestore.collection("icfg_formadores_privados").doc(code).get()).exists, true);
});


test("formador suspendido no puede obtener sesión; alta y reactivación sí, con auditoría", async () => {
  const { firestore, serverTimestamp } = await adminFirestore();
  const { setTrainerByAdmin } = await import("../api/_lib/adminTrainerService.js");
  const admin = { uid: "UID-ADMIN-EMULADOR", role: "admin", mfaVerified: true };
  const code = "DEMO-FORMADOR-EMULADOR";
  const ip = "198.51.100.91";

  // Alta ficticia: se ejerce el mismo servicio administrativo utilizado
  // por la aplicación, contra la base de datos local del emulador.
  const created = await setTrainerByAdmin({
    firestore, serverTimestamp, admin, code,
    displayName: "Formador ficticio emulador", active: true,
    expectedRevision: 0, reason: "Alta ficticia para validar el acceso del formador",
  });
  assert.equal(created.revision, 1);
  const activeLogin = await post(loginHandler, { code, password }, null, ip);
  assert.equal(activeLogin.code, 200, JSON.stringify(activeLogin.body));
  assert.ok(activeLogin.body.token);

  const suspended = await setTrainerByAdmin({
    firestore, serverTimestamp, admin, code,
    displayName: "Formador ficticio emulador", active: false,
    expectedRevision: 1, reason: "Suspensión ficticia para bloquear su inicio de sesión",
  });
  assert.equal(suspended.revision, 2);

  // El mismo código, aun con la contraseña institucional correcta, no
  // obtiene un nuevo token. La respuesta no revela si el código existe.
  const suspendedLogin = await post(loginHandler, { code, password }, null, ip);
  assert.equal(suspendedLogin.code, 401);
  assert.deepEqual(suspendedLogin.body, { error: "Credenciales inválidas." });
  assert.equal(suspendedLogin.body.token, undefined);
  const nonexistentLogin = await post(loginHandler, {
    code: "F999-INEXISTENTE", password,
  }, null, "198.51.100.92");
  assert.equal(nonexistentLogin.code, 401);
  assert.deepEqual(nonexistentLogin.body, suspendedLogin.body);

  // Un token que se emitió antes de la suspensión tampoco permite
  // corregir una evaluación. No se crea ni modifica evaluación alguna.
  const correctionDenied = await post(correctionHandler, {
    documentId: "EVAL-FICTICIA-INEXISTENTE",
    expectedRevision: 0,
    changes: { person: { peso: "80" } },
    reason: "Intento de prueba bloqueado por suspensión",
  }, activeLogin.body.token, ip);
  assert.equal(correctionDenied.code, 403);
  assert.equal((await firestore.doc(
    "artifacts/icfg-app-id/public/data/evaluaciones_icfg/EVAL-FICTICIA-INEXISTENTE"
  ).get()).exists, false);

  const reactivated = await setTrainerByAdmin({
    firestore, serverTimestamp, admin, code,
    displayName: "Formador ficticio emulador", active: true,
    expectedRevision: 2, reason: "Reactivación ficticia tras prueba de suspensión",
  });
  assert.equal(reactivated.revision, 3);
  const again = await post(loginHandler, { code, password }, null, ip);
  assert.equal(again.code, 200, JSON.stringify(again.body));

  const audit = await firestore.collection("icfg_formadores_audit_private")
    .where("formadorCode", "==", code).get();
  assert.equal(audit.size, 3);
  const entries = audit.docs.map(doc => doc.data());
  assert.ok(entries.some(e => e.before.revision === 0 &&
    e.after.revision === 1 && e.after.active === true));
  assert.ok(entries.some(e => e.before.revision === 1 &&
    e.after.revision === 2 && e.after.active === false));
  assert.ok(entries.some(e => e.before.revision === 2 &&
    e.after.revision === 3 && e.after.active === true));
  assert.ok(entries.every(e => e.adminUid === admin.uid &&
    e.timestamp?.toDate instanceof Function));
});
