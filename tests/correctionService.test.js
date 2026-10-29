import test from "node:test";
import assert from "node:assert/strict";
import { correctEvaluation, CorrectionError } from "../api/_lib/correctionService.js";

const original = () => ({
  id: "EVAL01",
  nombre: "Persona Prueba", edad: "57", tipoDocumento: "CC",
  numeroDocumento: "DOC-FICTICIO", sexo: "Hombre", sede: "Sede Prueba",
  fecha: "2026-10-01", peso: "82", talla: "167",
  evaluador: "Formador original",
  createdAt: "2026-10-01T00:00:00Z", timestamp: 1_800_000_000_000,
  total: 60, classification: "Anterior",
  scores: {
    prension: "35", salto: "20", core: "17", flexiones: "15",
    trote2k: "18", perimetro: "92", equilibrio: "30", flexibilidad: "12",
  },
});

function fixture() {
  const evaluations = new Map([["EVAL01", original()]]);
  const audits = new Map();
  let seq = 0;
  const firestore = {
    collection(path) {
      const storage = path === "icfg_corrections_audit_private" ? audits : evaluations;
      if (path !== "icfg_corrections_audit_private" &&
          path !== "artifacts/icfg-app-id/public/data/evaluaciones_icfg") {
        throw new Error("Ruta incorrecta: " + path);
      }
      return { doc(id) {
        const key = id || "AUDIT" + ++seq;
        return { id: key, storage };
      } };
    },
    async runTransaction(fn) {
      return fn({
        async get(ref) {
          const data = ref.storage.get(ref.id);
          return { exists: data !== undefined, id: ref.id, data: () => data };
        },
        update(ref, fields) {
          assert.ok(ref.storage.has(ref.id));
          ref.storage.set(ref.id, { ...ref.storage.get(ref.id), ...fields });
        },
        create(ref, fields) {
          assert.ok(!ref.storage.has(ref.id));
          ref.storage.set(ref.id, fields);
        },
      });
    },
  };
  const correct = (changes, overrides = {}) => correctEvaluation({
    firestore, documentId: "EVAL01", expectedRevision: 0,
    changes, actorCode: "F001",
    reason: "Corrección verificada del peso reportado",
    serverTimestamp: () => "TIMESTAMP_SERVIDOR",
    ...overrides,
  });
  return { correct, evaluations, audits };
}

test("corrige el registro original y crea una auditoría privada", async () => {
  const { correct, evaluations, audits } = fixture();
  const saved = await correct({ person: { peso: "80" } });
  assert.equal(saved.documentId, "EVAL01");
  assert.equal(saved.revision, 1);
  assert.equal(evaluations.size, 1);
  assert.equal(evaluations.get("EVAL01").peso, "80");
  assert.equal(evaluations.get("EVAL01").revision, 1);
  assert.equal(evaluations.get("EVAL01").createdAt, original().createdAt);
  assert.equal(audits.size, 1);
  const audit = [...audits.values()][0];
  assert.equal(audit.actorCode, "F001");
  assert.equal(audit.before.peso, "82");
  assert.equal(audit.after.peso, "80");
  assert.equal(audit.timestamp, "TIMESTAMP_SERVIDOR");
  assert.equal(saved.imc, "28.7");
});

test("dos correcciones con la misma versión no sobrescriben datos", async () => {
  const { correct, audits } = fixture();
  await correct({ person: { peso: "80" } });
  await assert.rejects(
    correct({ person: { peso: "79" } }),
    (error) => error instanceof CorrectionError && error.status === 409
  );
  assert.equal(audits.size, 1);
});

test("no permite campos ajenos, resultados adulterados ni motivo vacío", async () => {
  const { correct, audits } = fixture();
  for (const changes of [
    { person: { total: 100 } },
    { scores: { arbitrary: 999 } },
    { person: { edad: "101" } },
    { person: { peso: -1 } },
    { scores: { trote2k: -1 } },
    { person: { fecha: "2026-02-31" } },
  ]) {
    await assert.rejects(correct(changes), (error) => error.status === 400);
  }
  await assert.rejects(
    correct({ person: { peso: "80" } }, { reason: " " }),
    (error) => error.status === 400
  );
  assert.equal(audits.size, 0);
});

test("recalcula baremos ICFG cuando cambia la edad y no altera el evaluador original", async () => {
  const { correct, evaluations } = fixture();
  const previous = original();
  const result = await correct({ person: { edad: "29" } });
  assert.ok(Number.isFinite(result.icfg));
  assert.notEqual(evaluations.get("EVAL01").total, previous.total);
  assert.equal(evaluations.get("EVAL01").evaluador, previous.evaluador);
});

test("no permite corregir evaluaciones retiradas", async () => {
  const { correct, evaluations } = fixture();
  evaluations.get("EVAL01").isDeleted = true;
  await assert.rejects(
    correct({ person: { peso: "80" } }),
    (error) => error.status === 409
  );
});
