import test from "node:test";
import assert from "node:assert/strict";
import {
  STAGING_PROVIDER, STAGING_PROJECT, STAGING_SERVICE_ACCOUNT,
  requireStagingOidcConfiguration,
  vercelOidcTokenFromHeaders,
  getShortLivedServiceAccountToken,
} from "../api/_lib/vercelWorkloadIdentity.js";

const env = {
  VERCEL: "1", VERCEL_ENV: "production",
  ICFG_EXPECTED_FIREBASE_PROJECT_ID: STAGING_PROJECT,
  ICFG_WORKLOAD_IDENTITY_PROVIDER: STAGING_PROVIDER,
  ICFG_SERVICE_ACCOUNT_EMAIL: STAGING_SERVICE_ACCOUNT,
};
const jwt = "aGVhZGVy.cGF5bG9hZA.c2lnbmF0dXJl";
const now = 1800000000000;

test("acepta solo configuración de Firebase de ensayos", () => {
  assert.doesNotThrow(() => requireStagingOidcConfiguration(env));
  for (const patch of [
    { VERCEL: "0" }, { VERCEL_ENV: "preview" },
    { ICFG_EXPECTED_FIREBASE_PROJECT_ID: "otro-proyecto" },
    { ICFG_WORKLOAD_IDENTITY_PROVIDER: "projects/otro" },
    { ICFG_SERVICE_ACCOUNT_EMAIL: "cuenta-distinta" },
  ]) assert.throws(() => requireStagingOidcConfiguration({ ...env, ...patch }));
});

test("exige tres partes de un JWT en el encabezado OIDC", () => {
  assert.equal(vercelOidcTokenFromHeaders({ "x-vercel-oidc-token": jwt }), jwt);
  for (const value of [undefined, "", "incorrecto", "a.b", "a.b.c.d"]) {
    assert.throws(() => vercelOidcTokenFromHeaders({ "x-vercel-oidc-token": value }));
  }
});

test("intercambio OIDC simulado mantiene audiencia y alcance correctos", async () => {
  const visited = [];
  const fakeFetch = async (url, options) => {
    visited.push(url);
    if (url.includes("sts.googleapis.com")) {
      const body = new URLSearchParams(options.body);
      assert.equal(body.get("audience"), "//iam.googleapis.com/" + STAGING_PROVIDER);
      assert.equal(body.get("subject_token"), jwt);
      return { ok: true, json: async () => ({ access_token: "simulated-first-stage" }) };
    }
    assert.ok(url.includes(STAGING_SERVICE_ACCOUNT));
    return { ok: true, json: async () => ({
      accessToken: "simulated-second-stage",
      expireTime: new Date(now + 3600000).toISOString(),
    }) };
  };
  const result = await getShortLivedServiceAccountToken(jwt, {
    fetchImpl: fakeFetch, now: () => now, env,
  });
  assert.equal(visited.length, 2);
  assert.equal(result.access_token, "simulated-second-stage");
  assert.ok(result.expires_in > 3000);
});

test("rechaza respuesta no satisfactoria de Google STS", async () => {
  await assert.rejects(getShortLivedServiceAccountToken(jwt, {
    fetchImpl: async () => ({ ok: false }), env,
  }));
});
