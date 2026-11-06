/**
 * Servicio de correcciones ICFG. Exclusivamente servidor (Firebase Admin SDK).
 * No escribe hasta que un endpoint verifique el token y el formador activo.
 * Una transacción actualiza el documento original Y crea auditoría inmutable.
 */
import { prepareCorrection, EDITABLE_PERSON_FIELDS } from "../../src/correctionDraft.js";
import { tests } from "../../src/icfg.js";
import { normalizeTrainerCode } from "./institutionalAuth.js";

const EVALUATIONS_PATH = "artifacts/icfg-app-id/public/data/evaluaciones_icfg";
const AUDIT_COLLECTION = "icfg_corrections_audit_private";
const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const SCORE_LIMITS = Object.freeze({
  prension: [0, 200], salto: [0, 200], core: [0, 500],
  flexiones: [0, 500], trote2k: [0.01, 240],
  perimetro: [30, 300], equilibrio: [0, 600],
  flexibilidad: [-100, 100],
});
const PERSON_SET = new Set(EDITABLE_PERSON_FIELDS);
const SCORE_SET = new Set(tests.map((t) => t.id));

export class CorrectionError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "CorrectionError";
    this.status = status;
  }
}

function fail(message) {
  throw new CorrectionError(400, message);
}

function boundedText(value, max, label, mandatory = false) {
  if (typeof value !== "string" || value.length > max ||
      (mandatory && value.trim().length === 0)) {
    fail(`Campo inválido: ${label}.`);
  }
}

function boundedNumber(value, min, max, label, allowEmpty = true, integer = false) {
  if (value === "" && allowEmpty) return;
  if (value === null || value === undefined || typeof value === "boolean" ||
      (typeof value !== "number" && typeof value !== "string") ||
      (typeof value === "string" && value.trim() === "")) {
    fail(`Campo inválido: ${label}.`);
  }
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max || (integer && !Number.isInteger(n))) {
    fail(`Valor fuera de rango: ${label}.`);
  }
}

function validISODate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function validateChanges(changes) {
  if (!changes || typeof changes !== "object" || Array.isArray(changes) ||
      Object.keys(changes).some((key) => !["person", "scores"].includes(key))) {
    fail("El formato de la corrección no es válido.");
  }
  for (const [section, allowed] of [["person", PERSON_SET], ["scores", SCORE_SET]]) {
    const fields = changes[section];
    if (fields === undefined) continue;
    if (!fields || typeof fields !== "object" || Array.isArray(fields) ||
        Object.keys(fields).some((key) => !allowed.has(key))) {
      fail(`Campos no autorizados en ${section}.`);
    }
  }

  const p = changes.person || {};
  for (const [field, value] of Object.entries(p)) {
    if (["nombre", "sede", "tipoDocumento", "numeroDocumento"].includes(field)) {
      boundedText(value, field === "nombre" ? 120 : 100, field, field === "nombre");
    } else if (field === "edad") boundedNumber(value, 18, 100, field, false, true);
    else if (field === "peso") boundedNumber(value, 20, 400, field);
    else if (field === "talla") boundedNumber(value, 80, 250, field);
    else if (field === "sexo" && !["Hombre", "Mujer"].includes(value)) fail("Sexo inválido.");
    else if (field === "fecha" && !validISODate(value)) fail("Fecha inválida.");
  }
  for (const [field, value] of Object.entries(changes.scores || {})) {
    boundedNumber(value, ...SCORE_LIMITS[field], field);
  }
}

export async function correctEvaluation({
  firestore, documentId, expectedRevision, changes, reason, actorCode,
  serverTimestamp,
}) {
  if (!firestore?.runTransaction || !firestore?.collection || typeof serverTimestamp !== "function") {
    throw new Error("Backend no configurado.");
  }
  if (typeof documentId !== "string" || !ID_PATTERN.test(documentId)) fail("ID de evaluación inválido.");
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
    fail("Se requiere una revisión válida del documento.");
  }
  if (!normalizeTrainerCode(actorCode)) fail("Identificación del formador inválida.");
  boundedText(reason, 500, "motivo", true);
  if (reason.trim().length < 8) fail("El motivo debe tener al menos 8 caracteres.");
  validateChanges(changes);

  const evaluationRef = firestore.collection(EVALUATIONS_PATH).doc(documentId);
  const auditRef = firestore.collection(AUDIT_COLLECTION).doc();

  return firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(evaluationRef);
    if (!snapshot.exists) throw new CorrectionError(404, "Evaluación no encontrada.");
    const original = { id: snapshot.id || documentId, ...snapshot.data() };
    if (original.deletedAt || original.isDeleted) {
      throw new CorrectionError(409, "La evaluación no está activa.");
    }
    const revision = original.revision ?? 0;
    if (!Number.isSafeInteger(revision) || revision !== expectedRevision) {
      throw new CorrectionError(409, "La evaluación cambió; actualiza la consulta antes de corregir.");
    }

    let proposal;
    try {
      proposal = prepareCorrection(original, changes, actorCode, reason);
    } catch (error) {
      throw new CorrectionError(400, error.message);
    }
    const nextRevision = revision + 1;
    const updatedAt = serverTimestamp();
    transaction.update(evaluationRef, {
      ...proposal.proposedRecord,
      revision: nextRevision,
      updatedAt,
      lastCorrectedBy: actorCode,
    });
    transaction.create(auditRef, {
      evaluationId: documentId,
      fromRevision: revision,
      toRevision: nextRevision,
      actorCode,
      reason: reason.trim(),
      before: proposal.auditDraft.before,
      after: proposal.auditDraft.after,
      newICFG: proposal.proposedRecord.total,
      newIMC: proposal.proposedRecord.imcValue,
      timestamp: serverTimestamp(),
      kind: "CORRECTION",
    });
    return {
      documentId, revision: nextRevision,
      auditId: auditRef.id,
      icfg: proposal.proposedRecord.total,
      imc: proposal.proposedRecord.imcValue,
    };
  });
}
