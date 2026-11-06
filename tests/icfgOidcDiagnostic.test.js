import test from "node:test";
import assert from "node:assert/strict";
import handler from "../api/icfg-oidc-diagnostic.js";

function response() {
  return {
    statusCode: 200, body: null, headers: {},
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    status(value) { this.statusCode = value; return this; },
    json(value) { this.body = value; return this; },
  };
}

test("el diagnóstico OIDC está deshabilitado por defecto y no toca Firestore", async () => {
  const previous = process.env.ICFG_OIDC_DIAGNOSTIC_ENABLED;
  delete process.env.ICFG_OIDC_DIAGNOSTIC_ENABLED;
  try {
    const res = response();
    await handler({ method: "POST", headers: {} }, res);
    assert.equal(res.statusCode, 503);
    assert.equal(res.headers["cache-control"], "no-store");
    assert.equal(res.body.error, "Diagnóstico OIDC no habilitado.");
  } finally {
    if (previous === undefined) delete process.env.ICFG_OIDC_DIAGNOSTIC_ENABLED;
    else process.env.ICFG_OIDC_DIAGNOSTIC_ENABLED = previous;
  }
});

test("rechaza operaciones que no son POST y cuerpos con datos", async () => {
  const previous = process.env.ICFG_OIDC_DIAGNOSTIC_ENABLED;
  process.env.ICFG_OIDC_DIAGNOSTIC_ENABLED = "true";
  try {
    let res = response();
    await handler({ method: "GET", headers: {} }, res);
    assert.equal(res.statusCode, 405);
    res = response();
    await handler({ method: "POST", headers: {}, body: { attempt: "write" } }, res);
    assert.equal(res.statusCode, 400);
  } finally {
    if (previous === undefined) delete process.env.ICFG_OIDC_DIAGNOSTIC_ENABLED;
    else process.env.ICFG_OIDC_DIAGNOSTIC_ENABLED = previous;
  }
});
