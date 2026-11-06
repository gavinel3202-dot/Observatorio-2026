import test from "node:test";
import assert from "node:assert/strict";
import {
  getTrainerForAdmin, setTrainerByAdmin, TrainerAdminError,
} from "../api/_lib/adminTrainerService.js";

const admin = { uid: "UID_ADMIN_DEMO", role: "admin", mfaVerified: true };
const adminMissingMfa = { uid: "UID_ADMIN_DEMO", role: "admin", mfaVerified: false };

function fixture() {
  const collections = new Map();
  let seq = 0;
  function storage(name) {
    if (!collections.has(name)) collections.set(name, new Map());
    return collections.get(name);
  }
  const firestore = {
    collection(name) {
      const map = storage(name);
      return { doc(id) {
        const key = id || `AUDIT_${++seq}`;
        return {
          id: key, map,
          async get() { return { exists: map.has(key), data: () => map.get(key) }; },
        };
      } };
    },
    async runTransaction(callback) {
      return callback({
        get: (ref) => ref.get(),
        set(ref, value, opts) {
          ref.map.set(ref.id, { ...(opts?.merge ? ref.map.get(ref.id) : {}), ...value });
        },
        create(ref, value) {
          assert.equal(ref.map.has(ref.id), false);
          ref.map.set(ref.id, value);
        },
      });
    },
  };
  const run = (patch = {}) => setTrainerByAdmin({
    firestore, serverTimestamp: () => "FECHA_DE_SERVIDOR",
    admin, code: "f100", displayName: "Formador DEMO",
    active: true, expectedRevision: 0,
    reason: "Alta autorizada por la coordinación",
    ...patch,
  });
  return { firestore, run, collections };
}

test("alta crea registro privado y auditoría sin duplicados", async () => {
  const { firestore, run, collections } = fixture();
  const result = await run();
  assert.deepEqual(result, {
    code: "F100", displayName: "Formador DEMO", active: true, revision: 1,
  });
  assert.equal((await getTrainerForAdmin({ firestore, admin, code: "f100" })).active, true);
  assert.equal(collections.get("icfg_formadores_privados").size, 1);
  const audit = [...collections.get("icfg_formadores_audit_private").values()][0];
  assert.equal(audit.before.active, null);
  assert.equal(audit.after.active, true);
  assert.equal(audit.adminUid, admin.uid);
});

test("suspender no elimina formador y deja segunda entrada de auditoría", async () => {
  const { firestore, run, collections } = fixture();
  await run();
  await run({
    active: false, expectedRevision: 1,
    reason: "Suspensión autorizada de acceso institucional",
  });
  const current = await getTrainerForAdmin({ firestore, admin, code: "F100" });
  assert.equal(current.active, false);
  assert.equal(current.revision, 2);
  assert.equal(collections.get("icfg_formadores_privados").size, 1);
  assert.equal(collections.get("icfg_formadores_audit_private").size, 2);
});

test("rechaza rol no autorizado, MFA ausente y versiones antiguas", async () => {
  const { run, collections } = fixture();
  await assert.rejects(run({ admin: adminMissingMfa }),
    (e) => e.status === 403);
  await run();
  await assert.rejects(run({
    active: false, expectedRevision: 0,
  }), (e) => e instanceof TrainerAdminError && e.status === 409);
  assert.equal(collections.get("icfg_formadores_audit_private").size, 1);
});

test("rechaza campos inválidos, motivos vacíos y operaciones sin cambio", async () => {
  const { run, collections } = fixture();
  for (const patch of [
    { code: "NO/VALIDO" }, { reason: " " },
    { displayName: "" }, { active: "true" }, { expectedRevision: -1 },
  ]) {
    await assert.rejects(run(patch), (e) => e.status === 400);
  }
  await run();
  await assert.rejects(run({ expectedRevision: 1 }),
    (e) => e.status === 409);
  assert.equal(collections.get("icfg_formadores_audit_private").size, 1);
});
