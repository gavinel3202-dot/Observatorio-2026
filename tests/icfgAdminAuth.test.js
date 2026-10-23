import test from "node:test";
import assert from "node:assert/strict";
import { initializeApp, getApp } from "firebase/app";
import { getIsolatedAdminAuth, closeAdminSignIn } from "../src/icfgAdminAuth.js";

test("administración inicializa una instancia Firebase Auth independiente", async () => {
  const original = initializeApp({
    apiKey: "api-key-ficticia-para-pruebas",
    projectId: "demo-icfg-admin-auth",
    appId: "1:000000000:web:demo",
    authDomain: "demo-icfg-admin-auth.firebaseapp.com",
  });
  assert.equal(getApp(), original);
  const isolated = getIsolatedAdminAuth();
  assert.notEqual(isolated.app, original);
  assert.equal(isolated.app.name, "icfg-admin-isolated");
  assert.equal(isolated.app.options.projectId, original.options.projectId);
  assert.equal(getIsolatedAdminAuth(), isolated);
  assert.equal(isolated.currentUser, null);
  await closeAdminSignIn();
  assert.equal(isolated.currentUser, null);
});
