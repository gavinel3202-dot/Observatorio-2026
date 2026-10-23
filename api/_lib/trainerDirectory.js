/**
 * Directorio de formadores (solo lecturas desde servidor).
 * Las altas, suspensiones y reactivaciones deben usar adminTrainerService,
 * que requiere un administrador verificado y crea auditoría transaccional.
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
  };
}
