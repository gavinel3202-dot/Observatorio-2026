import test from "node:test";
import assert from "node:assert/strict";
import { trainerDirectory } from "../api/_lib/trainerDirectory.js";

function fakeFirestore() {
  const data = new Map();
  return {
    collection(name) {
      assert.equal(name, "icfg_formadores_privados");
      return {
        doc(code) {
          return {
            async get() {
              return { exists: data.has(code), data: () => data.get(code) };
            },
            async set(value, { merge }) {
              data.set(code, merge ? { ...(data.get(code) || {}), ...value } : value);
            },
          };
        },
      };
    },
  };
}

test("solo administrador con MFA puede activar formadores", async () => {
  const dir = trainerDirectory(fakeFirestore());
  await assert.rejects(
    dir.upsertByAdmin("F001", { displayName: "Formador Prueba", active: true }, { role: "formador" })
  );
  await assert.rejects(
    dir.upsertByAdmin("F001", { displayName: "Formador Prueba", active: true }, { role: "admin" })
  );
  assert.equal(await dir.getActive("F001"), null);
  await dir.upsertByAdmin("F001", { displayName: "Formador Prueba", active: true },
    { role: "admin", mfaVerified: true, uid: "admin1" });
  assert.equal((await dir.getActive("f001")).code, "F001");
});

test("formador suspendido deja de estar autorizado", async () => {
  const dir = trainerDirectory(fakeFirestore());
  const admin = { role: "admin", mfaVerified: true, uid: "admin1" };
  await dir.upsertByAdmin("F002", { displayName: "Formador Prueba", active: true }, admin);
  await dir.upsertByAdmin("F002", { displayName: "Formador Prueba", active: false }, admin);
  assert.equal(await dir.getActive("F002"), null);
  await assert.rejects(dir.assertActive("F002"));
});
