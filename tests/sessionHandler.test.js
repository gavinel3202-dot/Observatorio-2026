import test from "node:test";
import assert from "node:assert/strict";
import sessionHandler from "../api/icfg-session.js";

function fakeResponse() {
  return {
    statusCode: 200, headers: {}, payload: null,
    setHeader(key, value) { this.headers[key.toLowerCase()] = value; },
    status(code) { this.statusCode = code; return this; },
    json(data) { this.payload = data; return this; },
  };
}

test("servicio de acceso está desactivado por defecto", async () => {
  const original = process.env.ICFG_SESSION_ENABLED;
  delete process.env.ICFG_SESSION_ENABLED;
  try {
    const res = fakeResponse();
    await sessionHandler({
      method: "POST",
      headers: {},
      body: { code: "PRUEBA", password: "NO_ES_UNA_CREDENCIAL" },
      socket: { remoteAddress: "127.0.0.1" },
    }, res);
    assert.equal(res.statusCode, 503);
    assert.match(res.payload.error, /no habilitado/i);
    assert.equal(res.headers["cache-control"], "no-store");
  } finally {
    if (original === undefined) delete process.env.ICFG_SESSION_ENABLED;
    else process.env.ICFG_SESSION_ENABLED = original;
  }
});
