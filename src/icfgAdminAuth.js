/**
 * Autenticación administrativa aislada de la sesión anónima del Observatorio.
 * Únicamente cliente: Firebase Auth individual + TOTP ya inscrito.
 * El servidor siempre vuelve a verificar token, UID, MFA y permisos.
 *
 * No guarda tokens/contraseñas en localStorage o sessionStorage.
 * El segundo factor TOTP debe inscribirse previamente en Firebase staging.
 */
import { getApp, getApps, initializeApp } from "firebase/app";
import {
  initializeAuth, getAuth, inMemoryPersistence,
  signInWithEmailAndPassword, getMultiFactorResolver,
  TotpMultiFactorGenerator, signOut,
} from "firebase/auth";

const ADMIN_APP_NAME = "icfg-admin-isolated";
let separateAuth = null;

export function getIsolatedAdminAuth() {
  if (separateAuth) return separateAuth;
  // getApp() requiere que firebase.js inicialice el proyecto principal.
  const primary = getApp();
  const named = getApps().find((app) => app.name === ADMIN_APP_NAME) ||
    initializeApp(primary.options, ADMIN_APP_NAME);
  try {
    separateAuth = initializeAuth(named, { persistence: inMemoryPersistence });
  } catch (error) {
    if (error?.code !== "auth/already-initialized") throw error;
    separateAuth = getAuth(named);
  }
  return separateAuth;
}

export async function beginAdminSignIn(email, password) {
  const auth = getIsolatedAdminAuth();
  try {
    await signInWithEmailAndPassword(auth, email.trim(), password);
    // Firebase permite primer factor sin MFA a cuentas sin enrolamiento.
    // Se rechaza y se cierra esa sesión inmediatamente.
    await signOut(auth);
    throw new Error("La cuenta administrativa debe tener MFA TOTP configurado antes de ingresar.");
  } catch (error) {
    if (error?.code !== "auth/multi-factor-auth-required") throw error;
    const resolver = getMultiFactorResolver(auth, error);
    const totp = resolver.hints.find(
      (hint) => hint.factorId === TotpMultiFactorGenerator.FACTOR_ID
    );
    if (!totp) {
      throw new Error("Esta cuenta no tiene un segundo factor TOTP habilitado. Consulte con administración.");
    }
    return { resolver, enrollmentId: totp.uid };
  }
}

export async function completeAdminTotp(resolver, enrollmentId, oneTimeCode) {
  const code = String(oneTimeCode || "").trim();
  if (!/^\d{6,8}$/.test(code)) {
    throw new Error("Ingrese el código temporal de su aplicación autenticadora.");
  }
  const assertion = TotpMultiFactorGenerator.assertionForSignIn(enrollmentId, code);
  const credential = await resolver.resolveSignIn(assertion);
  const claims = (await credential.user.getIdTokenResult(true)).claims;
  if (claims.firebase?.sign_in_provider !== "password" ||
      claims.firebase?.sign_in_second_factor !== "totp") {
    await signOut(getIsolatedAdminAuth());
    throw new Error("La sesión no acredita ambos factores de autenticación.");
  }
  return { uid: credential.user.uid, email: credential.user.email || "" };
}

export async function adminIdentityToken() {
  const auth = getIsolatedAdminAuth();
  if (!auth.currentUser) throw new Error("Inicie sesión administrativa.");
  // Nunca copiar el token a estados React o almacenamiento persistente.
  return auth.currentUser.getIdToken(true);
}

export async function closeAdminSignIn() {
  if (separateAuth) await signOut(separateAuth);
}
