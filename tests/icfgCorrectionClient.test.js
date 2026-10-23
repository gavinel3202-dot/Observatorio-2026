import test from "node:test";
import assert from "node:assert/strict";
import {
  createTrainerSession, submitCorrection, changedFieldsFromAudit,
} from "../src/icfgCorrectionClient.js";

test("sesión usa solo endpoint propio, código y contraseña por POST", async () => {
  let url, options;
  const fake = async (u, o) => {
    url = u; options = o;
    return { ok: true, json: async () => ({ code: "F001", token: "TOKEN-DEMO", expiresInSeconds: 900 }) };
  };
  const session = await createTrainerSession("F001", "clave-ficticia", fake);
  assert.equal(url, "/api/icfg-session");
  assert.equal(options.method, "POST");
  assert.equal(JSON.parse(options.body).code, "F001");
  assert.equal(JSON.parse(options.body).password, "clave-ficticia");
  assert.equal(session.code, "F001");
  assert.equal(options.cache, "no-store");
});

test("corrección envía token solo en Authorization y no modifica campos sin cambios", async () => {
  const changes = changedFieldsFromAudit({ peso: "80", "scores.prension": "39" });
  assert.deepEqual(changes, { person: { peso: "80" }, scores: { prension: "39" } });
  let options;
  const fake = async (_url, o) => {
    options = o;
    return { ok: true, json: async () => ({ revision: 1 }) };
  };
  const result = await submitCorrection("TOKEN-FICTICIO", {
    documentId: "DOC01", expectedRevision: 0, changes,
    reason: "Corrección ficticia",
  }, fake);
  assert.equal(result.revision, 1);
  assert.equal(options.headers.Authorization, "Bearer TOKEN-FICTICIO");
  assert.ok(!options.body.includes("TOKEN-FICTICIO"));
});

test("sin token no intenta guardar", async () => {
  await assert.rejects(submitCorrection("", {}, () => { throw Error("No debe llamar"); }),
    /sesión de formador/);
});
