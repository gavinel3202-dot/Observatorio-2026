import { useState } from "react";
import { getApp, getApps, initializeApp } from "firebase/app";
import {
  getAuth, setPersistence, inMemoryPersistence,
  signInWithEmailAndPassword, sendEmailVerification, reload, signOut,
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

  async function login(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const auth = await verificationAuth();
      const { user } = await signInWithEmailAndPassword(auth, email.trim(), password);
      setSignedInEmail(user.email || email.trim());
      setVerified(user.emailVerified);
      setSent(false);
      setMessage(user.emailVerified
        ? "Firebase ya indica que este correo está verificado."
        : "Sesión iniciada solo para verificar el correo. Envía el enlace de verificación.");
    } catch (err) {
      setError(safeMessage(err));
      setSignedInEmail("");
      setVerified(false);
    } finally {
      setPassword("");
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
        {!signedInEmail ? (
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
