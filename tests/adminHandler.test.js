import test from "node:test";
import assert from "node:assert/strict";
import handler from "../api/icfg-admin-formadores.js";

function response() {
  return {
    statusCode: 200, headers: {}, body: null,
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    status(status) { this.statusCode = status; return this; },
    json(payload) { this.body = payload; return this; },
  };
}

test("administración deshabilitada por defecto antes de tocar Firestore", async () => {
  const previous = process.env.ICFG_ADMIN_ENABLED;
  delete process.env.ICFG_ADMIN_ENABLED;
  try {
    const res = response();
    await handler({
      method: "POST",
      body: {
        action: "set", code: "F001", displayName: "Ficticio",
        active: true, expectedRevision: 0, reason: "Motivo ficticio",
      },
      headers: {},
    }, res);
    assert.equal(res.statusCode, 503);
    assert.match(res.body.error, /no habilitada/i);
    assert.equal(res.headers["cache-control"], "no-store");
    assert.equal(res.headers["x-content-type-options"], "nosniff");
  } finally {
    if (previous === undefined) delete process.env.ICFG_ADMIN_ENABLED;
    else process.env.ICFG_ADMIN_ENABLED = previous;
  }
});

test("solicitudes de gestión invalidas se rechazan antes de usar credenciales", async () => {
  const previous = process.env.ICFG_ADMIN_ENABLED;
  process.env.ICFG_ADMIN_ENABLED = "true";
  try {
    for (const body of [
      {},
      { action: "delete", code: "F001" },
      { action: "set", code: "F001", active: true, superAdmin: true },
      { action: "get", code: "F001", password: "contraseña compartida" },
    ]) {
      const res = response();
      await handler({ method: "POST", body, headers: {} }, res);
      assert.equal(res.statusCode, 400);
    }
    const res = response();
    await handler({ method: "DELETE", body: {}, headers: {} }, res);
    assert.equal(res.statusCode, 405);
  } finally {
    if (previous === undefined) delete process.env.ICFG_ADMIN_ENABLED;
    else process.env.ICFG_ADMIN_ENABLED = previous;
  }
});
