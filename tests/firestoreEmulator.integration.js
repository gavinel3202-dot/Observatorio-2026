/**
 * Pruebas de integración contra Firebase Emulator, NUNCA producción.
 * Se ejecutan con FIRESTORE_EMULATOR_HOST y proyecto demo-icfg-corrections.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { correctEvaluation, CorrectionError } from "../api/_lib/correctionService.js";

const PROJECT = "demo-icfg-corrections";
if (!process.env.FIRESTORE_EMULATOR_HOST ||
    (process.env.GCLOUD_PROJECT && process.env.GCLOUD_PROJECT !== PROJECT)) {
  throw new Error("Pruebas de integración solo permitidas con Firestore Emulator.");
}
if (!getApps().length) initializeApp({ projectId: PROJECT });
const firestore = getFirestore();
const evaluations = firestore.collection("artifacts/icfg-app-id/public/data/evaluaciones_icfg");
const audits = firestore.collection("icfg_corrections_audit_private");

function record() {
  return {
    nombre: "Persona ficticia", edad: "57", tipoDocumento: "CC",
    numeroDocumento: "DEMO-00001", sexo: "Hombre", sede: "Sede ficticia",
    fecha: "2026-10-01", peso: "82", talla: "167",
    scores: {
      prension: "35", salto: "20", core: "17", flexiones: "15",
      trote2k: "18", perimetro: "92", equilibrio: "30", flexibilidad: "12",
    },
    total: 71, revision: 0,
    createdAt: "2026-10-01T00:00:00Z",
  };
}

test("actualización transaccional real: un documento, auditoría y versión", async () => {
  const id = "EVAL-EMULADOR-01";
  await evaluations.doc(id).set(record());
  const args = {
    firestore, documentId: id, expectedRevision: 0,
    changes: { person: { peso: "80" } },
    reason: "Se verificó un error de digitación",
    actorCode: "F001", serverTimestamp: () => FieldValue.serverTimestamp(),
  };
  const saved = await correctEvaluation(args);
  assert.equal(saved.revision, 1);
  assert.equal(saved.imc, "28.7");
  const after = (await evaluations.doc(id).get()).data();
  assert.equal(after.peso, "80");
  assert.equal(after.revision, 1);
  assert.equal(after.createdAt, record().createdAt);
  assert.equal(after.updatedAt?.toDate instanceof Function, true);

  const query = await audits.where("evaluationId", "==", id).get();
  assert.equal(query.size, 1);
  const audit = query.docs[0].data();
  assert.equal(audit.actorCode, "F001");
  assert.equal(audit.before.peso, "82");
  assert.equal(audit.after.peso, "80");
  assert.equal(audit.fromRevision, 0);
  assert.equal(audit.toRevision, 1);
  assert.ok(audit.timestamp?.toDate instanceof Function);

  await assert.rejects(correctEvaluation(args),
    (error) => error instanceof CorrectionError && error.status === 409);
  assert.equal((await audits.where("evaluationId", "==", id).get()).size, 1);
});
