import test from "node:test";
import assert from "node:assert/strict";
import {
  requestTrainerAdmin, normalizeAdminTrainerCode,
} from "../src/icfgAdminClient.js";

test("consulta de formador transmite operación y token exclusivamente por cabecera", async () => {
  let requestUrl;
  let requestOptions;
  const fetchMock = async (url, options) => {
    requestUrl = url;
    requestOptions = options;
    return {
      ok: true,
      status: 200,
      json: async () => ({ code: "F001", exists: true, revision: 2 }),
    };
  };
  const result = await requestTrainerAdmin("ID_TOKEN_FICTICIO", {
    action: "get", code: "F001",
  }, fetchMock);
  assert.equal(result.revision, 2);
  assert.equal(requestUrl, "/api/icfg-admin-formadores");
  assert.equal(requestOptions.method, "POST");
  assert.equal(requestOptions.headers.Authorization, "Bearer ID_TOKEN_FICTICIO");
  assert.equal(requestOptions.credentials, "same-origin");
  assert.equal(requestOptions.cache, "no-store");
  assert.deepEqual(JSON.parse(requestOptions.body), { action: "get", code: "F001" });
  assert.ok(!requestOptions.body.includes("ID_TOKEN_FICTICIO"));
});

test("actualiza estado sin exponer token en los datos", async () => {
  const body = {
    action: "set", code: "F001", displayName: "Formador DEMO",
    active: false, expectedRevision: 2, reason: "Suspensión autorizada",
  };
  let sent;
  const fetchMock = async (_url, options) => {
    sent = options;
    return { ok: true, json: async () => ({ code: "F001", revision: 3 }) };
  };
  const result = await requestTrainerAdmin("TOKEN_DE_PRUEBA", body, fetchMock);
  assert.equal(result.revision, 3);
  assert.deepEqual(JSON.parse(sent.body), body);
  assert.ok(!sent.body.includes("TOKEN_DE_PRUEBA"));
});

test("no ejecuta solicitudes sin token o con operación no permitida", async () => {
  const shouldNotCall = () => {
    throw new Error("No debió realizar una solicitud");
  };
  await assert.rejects(
    requestTrainerAdmin("", { action: "get", code: "F001" }, shouldNotCall),
    /autenticación administrativa/
  );
  await assert.rejects(
    requestTrainerAdmin("TOKEN", { action: "delete", code: "F001" }, shouldNotCall),
    /Operación administrativa inválida/
  );
  assert.equal(normalizeAdminTrainerCode(" f001 "), "F001");
});

test("reconoce denegación 403 del servicio y propaga estado", async () => {
  const forbidden = async () => ({
    ok: false, status: 403,
    json: async () => ({ error: "Acceso administrativo no autorizado." }),
  });
  await assert.rejects(
    requestTrainerAdmin("TOKEN", { action: "get", code: "F001" }, forbidden),
    (error) => error.status === 403 && /no autorizado/.test(error.message)
  );
});
