import test from "node:test";
import assert from "node:assert/strict";
import correctionHandler from "../api/icfg-corrections.js";

function response() {
  return {
    code: 200, headers: {}, body: null,
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    status(status) { this.code = status; return this; },
    json(payload) { this.body = payload; return this; },
  };
}

test("guardado HTTP denegado por defecto incluso sin autenticar", async () => {
  const previous = process.env.ICFG_CORRECTIONS_ENABLED;
  delete process.env.ICFG_CORRECTIONS_ENABLED;
  try {
    const res = response();
    await correctionHandler({ method: "POST", headers: {}, body: {} }, res);
    assert.equal(res.code, 503);
    assert.match(res.body.error, /no habilitado/i);
    assert.equal(res.headers["cache-control"], "no-store");
    assert.equal(res.headers["x-content-type-options"], "nosniff");
  } finally {
    if (previous === undefined) delete process.env.ICFG_CORRECTIONS_ENABLED;
    else process.env.ICFG_CORRECTIONS_ENABLED = previous;
  }
});

test("aun habilitado, nunca escribe sin sesión válida", async () => {
  const previous = {
    flag: process.env.ICFG_CORRECTIONS_ENABLED,
    epoch: process.env.ICFG_SESSION_EPOCH,
    secret: process.env.ICFG_SESSION_SECRET,
  };
  process.env.ICFG_CORRECTIONS_ENABLED = "true";
  process.env.ICFG_SESSION_EPOCH = "0";
  process.env.ICFG_SESSION_SECRET = "clave-ficticia-firmado-con-32-caracteres";
  try {
    const res = response();
    await correctionHandler({ method: "POST", headers: {}, body: {} }, res);
    assert.equal(res.code, 401);
    assert.match(res.body.error, /sesión requerida/i);
  } finally {
    for (const [key, envName] of [["flag", "ICFG_CORRECTIONS_ENABLED"], ["epoch", "ICFG_SESSION_EPOCH"], ["secret", "ICFG_SESSION_SECRET"]]) {
      if (previous[key] === undefined) delete process.env[envName];
      else process.env[envName] = previous[key];
    }
  }
});
