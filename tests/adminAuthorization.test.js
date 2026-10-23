import test from "node:test";
import assert from "node:assert/strict";
import { verifyAdministrator, AdminAccessError } from "../api/_lib/adminAuthorization.js";

const now = 1_800_000_000_000;
const allowedUid = "uid-admin-1234567890";
const authHeader = "Bearer TOKEN_DE_PRUEBAS_JWT_FICTICIO_12345";

function context(overrides = {}) {
  const seconds = Math.floor(now / 1000);
  const token = {
    uid: allowedUid,
    icfgAdmin: true,
    email_verified: true,
    auth_time: seconds - 120,
    firebase: { sign_in_provider: "password", sign_in_second_factor: "phone" },
    ...(overrides.token || {}),
  };
  const user = {
    disabled: false, emailVerified: true, customClaims: { icfgAdmin: true },
    ...(overrides.user || {}),
  };
  const authClient = {
    async verifyIdToken(raw, checkRevoked) {
      assert.equal(raw, authHeader.slice(7));
      assert.equal(checkRevoked, true);
      if (overrides.revoked) throw new Error("Revoked");
      return token;
    },
    async getUser(uid) {
      assert.equal(uid, token.uid);
      return user;
    },
  };
  return { authorization: authHeader, authClient, allowedUid, now };
}

test("administrador con MFA, privilegio vigente y sesión reciente obtiene permiso", async () => {
  const admin = await verifyAdministrator(context());
  assert.equal(admin.role, "admin");
  assert.equal(admin.mfaVerified, true);
  assert.equal(admin.uid, allowedUid);
});

test("identidad distinta, usuario anónimo o sin MFA son rechazados", async () => {
  for (const token of [
    { uid: "un-uid-distinto" },
    { firebase: { sign_in_provider: "anonymous" } },
    { firebase: { sign_in_provider: "password" } },
    { icfgAdmin: false },
    { email_verified: false },
  ]) {
    await assert.rejects(verifyAdministrator(context({ token })),
      (e) => e instanceof AdminAccessError && e.status === 403);
  }
});

test("bloquea sesión demasiado antigua y token revocado", async () => {
  const stale = { token: { auth_time: Math.floor(now / 1000) - 901 } };
  await assert.rejects(verifyAdministrator(context(stale)),
    (e) => e.status === 401);
  await assert.rejects(verifyAdministrator(context({ revoked: true })),
    (e) => e.status === 401);
});

test("comprueba de nuevo el privilegio y el estado actual del usuario", async () => {
  for (const user of [
    { disabled: true },
    { emailVerified: false },
    { customClaims: {} },
  ]) {
    await assert.rejects(verifyAdministrator(context({ user })),
      (e) => e.status === 403);
  }
});

test("rechaza petición sin token e impide omitir el UID autorizado", async () => {
  await assert.rejects(verifyAdministrator({
    ...context(), authorization: "Bearer CONTRASENA-COMPARTIDA",
  }), (e) => e.status === 401);
  await assert.rejects(verifyAdministrator({
    ...context(), allowedUid: "",
  }), /Configuración administrativa incompleta/);
});
