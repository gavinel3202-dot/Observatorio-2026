import test from "node:test";
import assert from "node:assert/strict";
import {
  hashInstitutionalPassword, verifyInstitutionalPassword,
  normalizeTrainerCode, issueTrainerToken, verifyTrainerToken,
} from "../api/_lib/institutionalAuth.js";

test("código de formador se normaliza y valida", () => {
  assert.equal(normalizeTrainerCode(" ab-123 "), "AB-123");
  assert.equal(normalizeTrainerCode(""), null);
  assert.equal(normalizeTrainerCode("../admin"), null);
});

test("contraseña se almacena como hash con sal y se verifica", () => {
  const encoded = hashInstitutionalPassword("ClaveInstitucionalSegura123!");
  assert.equal(encoded.includes("ClaveInstitucionalSegura123!"), false);
  assert.equal(verifyInstitutionalPassword("ClaveInstitucionalSegura123!", encoded), true);
  assert.equal(verifyInstitutionalPassword("incorrecta", encoded), false);
  assert.equal(verifyInstitutionalPassword("cualquiera", "invalido"), false);
});

test("token válido, expirado, alterado o rotado", () => {
  const secret = "clave-servidor-de-pruebas-con-mas-de-32-caracteres";
  const now = 1_800_000_000_000;
  const token = issueTrainerToken({ code: "FORMADOR01", secret, epoch: 3, now });
  assert.equal(verifyTrainerToken(token, secret, { epoch: 3, now })?.code, "FORMADOR01");
  assert.equal(verifyTrainerToken(token, secret, { epoch: 4, now }), null);
  assert.equal(verifyTrainerToken(token, secret, { epoch: 3, now: now + 901000 }), null);
  assert.equal(verifyTrainerToken(token + "x", secret, { epoch: 3, now }), null);
});
