/**
 * Administración de formadores con control de versión y auditoría transaccional.
 * Operaciones solo desde backend tras verifyAdministrator; sin borrado físico.
 */
import { normalizeTrainerCode } from "./institutionalAuth.js";

const FORMADORES = "icfg_formadores_privados";
const AUDIT = "icfg_formadores_audit_private";

export class TrainerAdminError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "TrainerAdminError";
    this.status = status;
  }
}

function ensureAdmin(admin) {
  if (!admin || admin.role !== "admin" || admin.mfaVerified !== true ||
      typeof admin.uid !== "string" || !admin.uid.trim()) {
    throw new TrainerAdminError(403, "Acceso administrativo no autorizado.");
  }
}

function ensureCode(value) {
  const code = normalizeTrainerCode(value);
  if (!code) throw new TrainerAdminError(400, "Código de formador inválido.");
  return code;
}

export async function getTrainerForAdmin({ firestore, admin, code }) {
  ensureAdmin(admin);
  const normalized = ensureCode(code);
  const snapshot = await firestore.collection(FORMADORES).doc(normalized).get();
  const data = snapshot.exists ? snapshot.data() : null;
  return {
    code: normalized,
    exists: Boolean(data),
    displayName: data?.displayName ?? "",
    active: data?.active === true,
    revision: data?.revision ?? 0,
  };
}

export async function setTrainerByAdmin({
  firestore, serverTimestamp, admin, code, displayName, active,
  expectedRevision, reason,
}) {
  ensureAdmin(admin);
  const normalized = ensureCode(code);
  if (typeof displayName !== "string" || displayName.trim().length < 3 ||
      displayName.trim().length > 120) {
    throw new TrainerAdminError(400, "Nombre institucional inválido.");
  }
  if (typeof active !== "boolean") {
    throw new TrainerAdminError(400, "Estado de autorización inválido.");
  }
  if (typeof reason !== "string" || reason.trim().length < 8 ||
      reason.trim().length > 500) {
    throw new TrainerAdminError(400, "Debe indicar un motivo de 8 a 500 caracteres.");
  }
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
    throw new TrainerAdminError(400, "Versión esperada inválida.");
  }
  if (!firestore?.runTransaction || typeof serverTimestamp !== "function") {
    throw new Error("Firestore Admin no configurado.");
  }

  const ref = firestore.collection(FORMADORES).doc(normalized);
  const auditRef = firestore.collection(AUDIT).doc();

  return firestore.runTransaction(async (tx) => {
    const current = await tx.get(ref);
    const prior = current.exists ? current.data() : null;
    const revision = prior?.revision ?? 0;
    if (revision !== expectedRevision) {
      throw new TrainerAdminError(409, "El formador fue modificado. Consulte su estado antes de reintentar.");
    }
    if (prior?.displayName === displayName.trim() &&
        prior?.active === active && prior?.role === "formador") {
      throw new TrainerAdminError(409, "El registro ya tiene esos valores.");
    }

    const nextRevision = revision + 1;
    const changedAt = serverTimestamp();
    // La desactivación no borra el documento. El login y cada corrección
    // verifican en Firestore si el formador sigue activo.
    tx.set(ref, {
      code: normalized,
      displayName: displayName.trim(),
      active,
      role: "formador",
      revision: nextRevision,
      updatedAt: changedAt,
      updatedBy: admin.uid,
    }, { merge: true });

    tx.create(auditRef, {
      kind: current.exists ? "FORMADOR_MODIFICADO" : "FORMADOR_CREADO",
      formadorCode: normalized,
      adminUid: admin.uid,
      reason: reason.trim(),
      before: {
        displayName: prior?.displayName ?? null,
        active: prior?.active ?? null,
        revision,
      },
      after: {
        displayName: displayName.trim(), active, revision: nextRevision,
      },
      timestamp: serverTimestamp(),
    });

    return { code: normalized, active, displayName: displayName.trim(), revision: nextRevision };
  });
}
