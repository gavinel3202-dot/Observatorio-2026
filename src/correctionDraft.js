/**
 * Preparación de correcciones ICFG.
 * Funciones puras: no escriben en Firestore ni conceden permisos.
 * El servidor deberá volver a validar y recalcular antes de persistir.
 */
import { tests, evaluateTest, classifyICFG, getIMCData } from "./icfg.js";

export const EDITABLE_PERSON_FIELDS = Object.freeze([
  "nombre", "edad", "tipoDocumento", "numeroDocumento", "sexo",
  "sede", "fecha", "peso", "talla",
]);

export function calculateEvaluation(person, scores) {
  const age = Number(person.edad);
  if (!Number.isInteger(age) || age < 18 || age > 100) {
    throw new Error("La edad debe estar entre 18 y 100 años.");
  }
  if (!["Hombre", "Mujer"].includes(person.sexo)) {
    throw new Error("El sexo debe permitir aplicar el baremo.");
  }

  const detail = tests.map((test) => {
    const rawInput = scores?.[test.id] ?? "";
    if (rawInput !== "" && (!Number.isFinite(Number(rawInput)) ||
      (test.id !== "flexibilidad" && Number(rawInput) < 0))) {
      throw new Error(`Valor inválido para ${test.name}.`);
    }
    const score1to5 = evaluateTest(test.id, rawInput, person.edad, person.sexo);
    const validScore = score1to5 > 0 ? score1to5 : 0;
    return { ...test, rawInput, score1to5, validScore,
      weighted: (validScore / 5) * test.weight };
  });
  const total = Number(detail.reduce((sum, item) => sum + item.weighted, 0).toFixed(1));
  const weakest = detail.filter((d) => d.validScore > 0)
    .sort((a, b) => a.validScore - b.validScore || b.weight - a.weight)[0];
  const imc = getIMCData(person.peso, person.talla);

  return {
    total,
    classification: classifyICFG(total).label,
    weakest: weakest?.name ?? "Faltan pruebas",
    imcValue: imc?.value ?? null,
    imcCategory: imc?.category ?? null,
  };
}

/**
 * Construye una propuesta de cambio sin mutar el registro original.
 * No es una operación autorizada de guardado.
 */
export function prepareCorrection(original, changes, actor, reason) {
  if (!original?.id) throw new Error("Se requiere el ID de la evaluación.");
  if (!actor?.trim()) throw new Error("Identifica al formador responsable.");
  if (!reason?.trim()) throw new Error("Indica el motivo de la corrección.");

  const person = Object.fromEntries(EDITABLE_PERSON_FIELDS.map(
    (field) => [field, changes.person?.[field] ?? original[field] ?? ""]
  ));
  const scores = Object.fromEntries(tests.map(
    (test) => [test.id, changes.scores?.[test.id] ?? original.scores?.[test.id] ?? ""]
  ));
  const computed = calculateEvaluation(person, scores);
  const before = {};
  const after = {};
  for (const key of EDITABLE_PERSON_FIELDS) {
    if (String(original[key] ?? "") !== String(person[key])) {
      before[key] = original[key] ?? null;
      after[key] = person[key];
    }
  }
  for (const test of tests) {
    const key = `scores.${test.id}`;
    if (String(original.scores?.[test.id] ?? "") !== String(scores[test.id])) {
      before[key] = original.scores?.[test.id] ?? null;
      after[key] = scores[test.id];
    }
  }
  if (Object.keys(after).length === 0) {
    throw new Error("No hay cambios que guardar.");
  }
  return {
    documentId: original.id,
    proposedRecord: { ...person, scores, ...computed },
    auditDraft: { actor: actor.trim(), reason: reason.trim(), before, after },
  };
}
