import { useState } from "react";
import { getApp, getApps, initializeApp } from "firebase/app";
import {
  getAuth, setPersistence, inMemoryPersistence,
  signInWithEmailAndPassword, sendEmailVerification, reload, signOut,
  multiFactor, TotpMultiFactorGenerator, getMultiFactorResolver,
} from "firebase/auth";

// La herramienta de verificación solo puede operar contra Firebase de ENSAYO.
// No otorga permisos administrativos ni modifica registros de evaluaciones.
const STAGING_PROJECT_ID = "observatorio-icfg-pruebas";
const SECONDARY_APP_NAME = "icfg-admin-verificacion-correo";
let secondaryAuthPromise = null;

function verificationAuth() {
  if (!secondaryAuthPromise) {
    secondaryAuthPromise = (async () => {
      const mainApp = getApp();
      if (mainApp.options.projectId !== STAGING_PROJECT_ID) {
        throw new Error(
          "Esta pantalla requiere el proyecto Firebase de ensayo. No se inició sesión."
        );
      }
      const secondaryApp = getApps().find((app) => app.name === SECONDARY_APP_NAME)
        || initializeApp(mainApp.options, SECONDARY_APP_NAME);
      const isolatedAuth = getAuth(secondaryApp);
      // Evita interferir con la sesión anónima de la app principal.
      // No guarda la sesión administrativa entre recargas.
      await setPersistence(isolatedAuth, inMemoryPersistence);
      return isolatedAuth;
    })().catch((error) => {
      secondaryAuthPromise = null;
      throw error;
    });
  }
  return secondaryAuthPromise;
}

function safeMessage(error) {
  if (error?.code === "auth/too-many-requests") {
    return "Firebase limitó los intentos. Intenta de nuevo más adelante.";
  }
  if (["auth/invalid-credential", "auth/wrong-password", "auth/user-not-found",
    "auth/invalid-email"].includes(error?.code)) {
    return "No se pudo iniciar sesión. Revisa el correo y la contraseña de Firebase de pruebas.";
  }
  if (error?.code === "auth/invalid-verification-code" ||
      error?.code === "auth/invalid-multi-factor-session") {
    return "Código de autenticación inválido o caducado. Utiliza el código actual de tu aplicación.";
  }
  if (error?.code === "auth/requires-recent-login") {
    return "Por seguridad debes cerrar la sesión e iniciarla de nuevo antes de registrar TOTP.";
  }
  if (error?.code === "auth/operation-not-allowed") {
    return "El acceso mediante correo y contraseña no está habilitado en Firebase de pruebas.";
  }
  return error?.message || "No fue posible completar la operación.";
}

export default function VerifyAdminEmail() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signedInEmail, setSignedInEmail] = useState("");
  const [verified, setVerified] = useState(false);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [mfaResolver, setMfaResolver] = useState(null);
  const [loginTotpCode, setLoginTotpCode] = useState("");
  const [hasTotp, setHasTotp] = useState(false);
  const [totpSecret, setTotpSecret] = useState(null);
  const [totpCode, setTotpCode] = useState("");
  const [revealKey, setRevealKey] = useState(false);

  function registerSignedInUser(user) {
    setSignedInEmail(user.email || email.trim());
    setVerified(user.emailVerified);
    setHasTotp(multiFactor(user).enrolledFactors.some(
      (factor) => factor.factorId === TotpMultiFactorGenerator.FACTOR_ID
    ));
    setSent(false);
    setMfaResolver(null);
    setLoginTotpCode("");
    setMessage(user.emailVerified
      ? "Cuenta con correo verificado. Puedes comprobar o configurar el segundo factor."
      : "Sesión iniciada. Antes de configurar MFA, verifica el correo electrónico.");
  }

  async function login(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const auth = await verificationAuth();
      const { user } = await signInWithEmailAndPassword(auth, email.trim(), password);
      registerSignedInUser(user);
    } catch (err) {
      if (err?.code === "auth/multi-factor-auth-required") {
        const auth = await verificationAuth();
        const resolver = getMultiFactorResolver(auth, err);
        if (resolver.hints.some((hint) => hint.factorId === TotpMultiFactorGenerator.FACTOR_ID)) {
          setMfaResolver(resolver);
          setMessage("Introduce el código actual de Google Authenticator para completar el acceso.");
        } else {
          setError("La cuenta requiere un segundo factor no compatible con esta pantalla.");
        }
      } else {
        setError(safeMessage(err));
      }
      setSignedInEmail("");
      setVerified(false);
    } finally {
      setPassword("");
      setBusy(false);
    }
  }

  async function resolveTotpSignIn(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const hint = mfaResolver?.hints.find(
        (item) => item.factorId === TotpMultiFactorGenerator.FACTOR_ID
      );
      if (!hint || !/^\d{6}$/.test(loginTotpCode.trim())) {
        throw new Error("Introduce los seis dígitos actuales de Google Authenticator.");
      }
      const assertion = TotpMultiFactorGenerator.assertionForSignIn(hint.uid, loginTotpCode.trim());
      const result = await mfaResolver.resolveSignIn(assertion);
      registerSignedInUser(result.user);
    } catch (err) {
      setError(safeMessage(err));
    } finally {
      setLoginTotpCode("");
      setPassword("");
      setBusy(false);
    }
  }

  async function beginTotpEnrollment() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const auth = await verificationAuth();
      const user = auth.currentUser;
      if (!user?.emailVerified) throw new Error("Primero verifica el correo del usuario.");
      if (multiFactor(user).enrolledFactors.some(
        (factor) => factor.factorId === TotpMultiFactorGenerator.FACTOR_ID
      )) throw new Error("Esta cuenta ya tiene TOTP registrado.");
      const session = await multiFactor(user).getSession();
      const secret = await TotpMultiFactorGenerator.generateSecret(session);
      setTotpSecret(secret);
      setTotpCode("");
      setRevealKey(false);
      setMessage("Se generó una clave privada temporal. Introdúcela en Google Authenticator y confirma con su código de seis dígitos. No compartas la clave.");
    } catch (err) {
      setError(safeMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function confirmTotpEnrollment(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const auth = await verificationAuth();
      const user = auth.currentUser;
      if (!user || !totpSecret) throw new Error("Inicia sesión y genera una clave TOTP.");
      if (!/^\d{6}$/.test(totpCode.trim())) {
        throw new Error("Introduce los seis dígitos actuales de Google Authenticator.");
      }
      const assertion = TotpMultiFactorGenerator.assertionForEnrollment(totpSecret, totpCode.trim());
      await multiFactor(user).enroll(assertion, "ICFG - Google Authenticator");
      setHasTotp(true);
      setTotpSecret(null);
      setTotpCode("");
      setRevealKey(false);
      setMessage("Segundo factor TOTP registrado en Firebase. Cierra sesión y vuelve a ingresar para comprobar que exige el código.");
    } catch (err) {
      setError(safeMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function sendLink() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const auth = await verificationAuth();
      if (!auth.currentUser) throw new Error("Primero inicia sesión.");
      await sendEmailVerification(auth.currentUser);
      setSent(true);
      setMessage("Enlace enviado. Revisa la bandeja de entrada y Spam. Abre el enlace recibido, vuelve a esta página y pulsa «Comprobar verificación».");
    } catch (err) {
      setError(safeMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function checkVerification() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const auth = await verificationAuth();
      const user = auth.currentUser;
      if (!user) throw new Error("La sesión terminó. Inicia sesión nuevamente.");
      await reload(user);
      const isVerified = auth.currentUser?.emailVerified === true;
      setVerified(isVerified);
      setMessage(isVerified
        ? "¡Correo verificado en Firebase de pruebas! Ya puedes cerrar la sesión de verificación."
        : "El correo aún no figura como verificado. Abre el enlace recibido y comprueba otra vez.");
    } catch (err) {
      setError(safeMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setBusy(true);
    setError("");
    try {
      const auth = await verificationAuth();
      await signOut(auth);
      setSignedInEmail("");
      setPassword("");
      setSent(false);
      setVerified(false);
      setHasTotp(false);
      setTotpSecret(null);
      setTotpCode("");
      setRevealKey(false);
      setMfaResolver(null);
      setLoginTotpCode("");
      setMessage("Sesión de verificación cerrada.");
    } catch (err) {
      setError(safeMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 text-slate-900">
      <section className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="mb-2 text-xs font-bold uppercase tracking-widest text-indigo-700">ICFG · Entorno de ensayo</p>
        <h1 className="text-2xl font-bold">Verificación del correo del administrador</h1>
        <p className="mt-3 text-sm text-slate-700">
          Esta herramienta utiliza únicamente Firebase <strong>{STAGING_PROJECT_ID}</strong>.
          Verifica el correo de la cuenta que creaste en Authentication; no concede permisos
          administrativos ni habilita la edición de evaluaciones.
        </p>
        {mfaResolver ? (
          <form className="mt-6 space-y-4" onSubmit={resolveTotpSignIn}>
            <p className="rounded-lg bg-indigo-50 p-3 text-sm text-indigo-900">
              Esta cuenta ya tiene Google Authenticator vinculado.
              Introduce el código temporal para terminar de iniciar sesión.
            </p>
            <label htmlFor="mfa-login-code" className="block text-sm font-semibold">
              Código TOTP (seis dígitos)
              <input id="mfa-login-code" inputMode="numeric" autoComplete="one-time-code"
                type="text" pattern="[0-9]{6}" maxLength={6} required
                className="mt-1 w-full rounded-lg border p-3 font-normal"
                value={loginTotpCode} onChange={(event) => setLoginTotpCode(event.target.value)} />
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="submit" disabled={busy}
                className="rounded-lg bg-indigo-700 px-4 py-2 font-semibold text-white disabled:opacity-50">
                {busy ? "Comprobando…" : "Verificar segundo factor"}
              </button>
              <button type="button" disabled={busy}
                onClick={() => { setMfaResolver(null); setLoginTotpCode(""); setError(""); }}
                className="rounded-lg border px-4 py-2 font-semibold">Volver</button>
            </div>
          </form>
        ) : !signedInEmail ? (
          <form className="mt-6 space-y-4" onSubmit={login}>
            <label className="block text-sm font-semibold" htmlFor="verify-email">
              Correo de la cuenta de Firebase de pruebas
              <input id="verify-email" type="email" required autoComplete="username"
                value={email} onChange={(event) => setEmail(event.target.value)}
                className="mt-1 w-full rounded-lg border p-3 font-normal" />
            </label>
            <label className="block text-sm font-semibold" htmlFor="verify-password">
              Contraseña creada específicamente para esa cuenta
              <input id="verify-password" type="password" required autoComplete="current-password"
                value={password} onChange={(event) => setPassword(event.target.value)}
                className="mt-1 w-full rounded-lg border p-3 font-normal" />
            </label>
            <button type="submit" disabled={busy}
              className="rounded-lg bg-indigo-700 px-4 py-2 font-semibold text-white disabled:opacity-50">
              {busy ? "Verificando acceso…" : "Iniciar sesión para verificar"}
            </button>
          </form>
        ) : (
          <div className="mt-6 space-y-4">
            <p className="rounded-lg bg-slate-100 p-3 text-sm">
              Cuenta: <strong>{signedInEmail}</strong>
            </p>
            <p className={`rounded-lg p-3 text-sm ${verified
              ? "bg-green-50 text-green-900" : "bg-amber-50 text-amber-900"}`}>
              {verified ? "Correo verificado" : "Correo pendiente de verificación"}
            </p>
            {verified && (
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/30 p-4 space-y-3">
                <h2 className="text-lg font-bold">Google Authenticator (TOTP)</h2>
                {hasTotp ? (
                  <p className="rounded-lg bg-green-50 p-3 text-sm font-medium text-green-900">
                    El segundo factor TOTP ya está registrado para esta cuenta.
                    Cierra sesión y vuelve a acceder para comprobarlo.
                  </p>
                ) : (
                  <>
                    <p className="text-sm text-slate-700">
                      Activa el segundo factor exclusivamente en la cuenta de Firebase de pruebas.
                      Puedes introducir una clave de configuración manual en Google Authenticator
                      desde tu teléfono. No enviamos esa clave a servicios de generación de códigos QR.
                    </p>
                    {!totpSecret ? (
                      <button type="button" disabled={busy} onClick={beginTotpEnrollment}
                        className="rounded-lg bg-indigo-700 px-4 py-2 font-semibold text-white disabled:opacity-50">
                        Generar clave privada de TOTP
                      </button>
                    ) : (
                      <div className="space-y-3 rounded-lg border bg-white p-4">
                        <p className="text-sm font-semibold">
                          En Google Authenticator: pulsa + → Introducir clave de configuración.
                          Nombre de la cuenta: ICFG Pruebas. Tipo: Basado en tiempo.
                        </p>
                        <label htmlFor="secret-key" className="block text-sm font-semibold">
                          Clave de configuración (privada: no fotografiar ni compartir)
                          <input id="secret-key" readOnly type={revealKey ? "text" : "password"}
                            value={totpSecret.secretKey}
                            className="mt-1 w-full rounded-lg border bg-slate-50 p-2 font-mono text-sm" />
                        </label>
                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => setRevealKey((value) => !value)}
                            className="rounded-lg border px-3 py-2 text-sm">
                            {revealKey ? "Ocultar clave" : "Mostrar clave"}
                          </button>
                          <button type="button" disabled={busy} onClick={() => {
                              navigator.clipboard.writeText(totpSecret.secretKey)
                                .then(() => setMessage("Clave copiada. No la compartas; limpia el portapapeles después."))
                                .catch(() => setError("No se pudo copiar; puedes mostrarla e introducirla manualmente."));
                            }}
                            className="rounded-lg border px-3 py-2 text-sm">Copiar clave</button>
                        </div>
                        <form onSubmit={confirmTotpEnrollment} className="space-y-2">
                          <label htmlFor="totp-confirm-code" className="block text-sm font-semibold">
                            Código de seis dígitos que muestra Google Authenticator
                            <input id="totp-confirm-code" inputMode="numeric" autoComplete="one-time-code"
                              type="text" pattern="[0-9]{6}" maxLength={6} required
                              value={totpCode} onChange={(event) => setTotpCode(event.target.value)}
                              className="mt-1 w-full rounded-lg border p-3 font-normal" />
                          </label>
                          <button type="submit" disabled={busy}
                            className="rounded-lg bg-indigo-700 px-4 py-2 font-semibold text-white disabled:opacity-50">
                            {busy ? "Registrando…" : "Confirmar y vincular Google Authenticator"}
                          </button>
                        </form>
                        <p className="text-xs text-amber-900">
                          No cierres ni recargues la pantalla durante el registro.
                          Si pierdes tu autenticador podrías perder acceso a esta cuenta;
                          configura un método seguro de recuperación.
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {!verified && (
                <button type="button" disabled={busy || sent} onClick={sendLink}
                  className="rounded-lg bg-indigo-700 px-4 py-2 font-semibold text-white disabled:opacity-50">
                  {sent ? "Enlace enviado" : "Enviar correo de verificación"}
                </button>
              )}
              {!verified && (
                <button type="button" disabled={busy} onClick={checkVerification}
                  className="rounded-lg border px-4 py-2 font-semibold disabled:opacity-50">
                  Comprobar verificación
                </button>
              )}
              <button type="button" disabled={busy} onClick={logout}
                className="rounded-lg border px-4 py-2 font-semibold disabled:opacity-50">
                Cerrar sesión
              </button>
            </div>
          </div>
        )}
        {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        {message && <p role="status" className="mt-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-900">{message}</p>}
        <p className="mt-6 border-t pt-4 text-xs text-slate-600">
          Nunca compartas tu contraseña o el enlace de verificación. Esta sesión es independiente
          de la sesión anónima utilizada por las evaluaciones ICFG y se conserva solo en memoria.
        </p>
        <a className="mt-4 inline-block text-sm font-semibold text-indigo-700 underline" href="/">
          Volver al ICFG de pruebas
        </a>
      </section>
    </main>
  );
}
