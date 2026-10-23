/**
 * Acceso PRIVADO a formadores autorizados (solo servidor).
 * No importar desde React. Requiere firebase-admin configurado en backend.
 * La contraseña institucional no se almacena aquí.
 */
import { normalizeTrainerCode } from "./institutionalAuth.js";

const COLLECTION = "icfg_formadores_privados";

export function trainerDirectory(firestore) {
  if (!firestore || typeof firestore.collection !== "function") {
    throw new Error("Firestore Admin SDK no configurado.");
  }

  return {
    async getActive(code) {
      const normalized = normalizeTrainerCode(code);
      if (!normalized) return null;
      const snap = await firestore.collection(COLLECTION).doc(normalized).get();
      if (!snap.exists) return null;
      const data = snap.data();
      return data?.active === true && data?.role === "formador"
        ? { code: normalized, displayName: data.displayName ?? "" }
        : null;
    },

    async assertActive(code) {
      const trainer = await this.getActive(code);
      if (!trainer) throw new Error("Formador no autorizado.");
      return trainer;
    },

    // SOLO llamar tras verificar sesión administrativa independiente y MFA.
    async upsertByAdmin(code, { displayName, active }, adminContext) {
      if (adminContext?.role !== "admin" || adminContext?.mfaVerified !== true) {
        throw new Error("Se requiere autorización administrativa con MFA.");
      }
      const normalized = normalizeTrainerCode(code);
      if (!normalized) throw new Error("Código de formador inválido.");
      if (typeof displayName !== "string" || displayName.trim().length < 3 ||
          typeof active !== "boolean") {
        throw new Error("Datos de formador inválidos.");
      }
      await firestore.collection(COLLECTION).doc(normalized).set({
        displayName: displayName.trim(),
        active,
        role: "formador",
        updatedAt: new Date(),
        updatedBy: adminContext.uid,
      }, { merge: true });
      return { code: normalized, active };
    },
  };
}
