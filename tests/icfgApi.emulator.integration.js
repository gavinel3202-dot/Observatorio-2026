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
