import test from "node:test";
import assert from "node:assert/strict";
import { trainerDirectory } from "../api/_lib/trainerDirectory.js";

function fakeFirestore() {
  const data = new Map([
    ["F001", { active: true, role: "formador", displayName: "Formador DEMO" }],
    ["F002", { active: false, role: "formador", displayName: "Suspendido" }],
    ["F003", { active: true, role: "admin", displayName: "Rol distinto" }],
  ]);
  return {
    collection(name) {
      assert.equal(name, "icfg_formadores_privados");
      return {
        doc(code) {
          return {
            async get() {
              return { exists: data.has(code), data: () => data.get(code) };
            },
          };
        },
      };
    },
  };
}

test("formador activo es reconocido por código individual", async () => {
  const dir = trainerDirectory(fakeFirestore());
  assert.equal((await dir.getActive("f001")).code, "F001");
  assert.equal((await dir.assertActive("F001")).displayName, "Formador DEMO");
});

test("formador suspendido, rol distinto e identificadores inválidos se rechazan", async () => {
  const dir = trainerDirectory(fakeFirestore());
  assert.equal(await dir.getActive("F002"), null);
  assert.equal(await dir.getActive("F003"), null);
  assert.equal(await dir.getActive("!"), null);
  await assert.rejects(dir.assertActive("F002"), /no autorizado/);
});

test("directorio de lectura no expone funciones de modificación", () => {
  const dir = trainerDirectory(fakeFirestore());
  assert.equal(dir.upsertByAdmin, undefined);
  assert.equal(dir.delete, undefined);
});
