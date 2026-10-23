import { useEffect, useState } from "react";
import { firebaseEnabled } from "./firebase";
import {
  beginAdminSignIn, completeAdminTotp, adminIdentityToken, closeAdminSignIn,
} from "./icfgAdminAuth";
import { requestTrainerAdmin, normalizeAdminTrainerCode } from "./icfgAdminClient";

const COMMON_INPUT = "mt-1 w-full rounded-lg border border-slate-300 p-2.5 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none";
const COMMON_BUTTON = "rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed";

function friendlyError(error) {
  if (error?.status) return error.message;
  const authCode = error?.code;
  if (authCode === "auth/invalid-credential" ||
      authCode === "auth/wrong-password" ||
      authCode === "auth/user-not-found") {
    return "Credenciales administrativas no válidas.";
  }
  if (authCode === "auth/too-many-requests") {
    return "Demasiados intentos. Intente nuevamente más tarde.";
  }
  if (authCode?.startsWith("auth/")) {
    return "No se completó la autenticación. Revise las credenciales y el segundo factor.";
  }
  return error?.message || "No se completó la operación.";
}

/**
 * Administración de formadores — fase de ensayo.
 * No realiza operaciones con Firestore directamente desde el navegador.
 * Esta vista solo se monta si VITE_ICFG_ADMIN_UI=true; backend permanece
 * cerrado por defecto con ICFG_ADMIN_ENABLED=false.
 */
export default function AdminFormadores() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [mfaChallenge, setMfaChallenge] = useState(null);
  const [admin, setAdmin] = useState(null);
  const [code, setCode] = useState("");
  const [loadedCode, setLoadedCode] = useState("");
  const [formador, setFormador] = useState(null);
  const [displayName, setDisplayName] = useState("");
  const [active, setActive] = useState(true);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // No mantener la sesión privilegiada cuando se abandona la pestaña.
  useEffect(() => () => { void closeAdminSignIn(); }, []);

  const clearFormador = () => {
    setLoadedCode("");
    setFormador(null);
    setDisplayName("");
    setActive(true);
    setReason("");
  };

  const clearFeedback = () => {
    setError("");
    setMessage("");
  };

  const signIn = async (event) => {
    event.preventDefault();
    setBusy(true);
    clearFeedback();
    try {
      const challenge = await beginAdminSignIn(email, password);
      setMfaChallenge(challenge);
      setMessage("Primer factor validado. Introduzca el código de su aplicación autenticadora.");
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setPassword("");
      setBusy(false);
    }
  };

  const confirmTotp = async (event) => {
    event.preventDefault();
    if (!mfaChallenge) return;
    setBusy(true);
    clearFeedback();
    try {
      const user = await completeAdminTotp(
        mfaChallenge.resolver, mfaChallenge.enrollmentId, totp
      );
      setAdmin(user);
      setMfaChallenge(null);
      setMessage("Autenticación de dos factores completada. Los permisos se verificarán en el servidor.");
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setTotp("");
      setBusy(false);
    }
  };

  const logout = async () => {
    setBusy(true);
    try {
      await closeAdminSignIn();
    } finally {
      setAdmin(null);
      setMfaChallenge(null);
      setTotp("");
      setEmail("");
      setPassword("");
      setCode("");
      clearFormador();
      clearFeedback();
      setBusy(false);
    }
  };

  const invoke = async (payload) => {
    const token = await adminIdentityToken();
    return requestTrainerAdmin(token, payload);
  };

  const consult = async (event) => {
    event.preventDefault();
    const normalized = normalizeAdminTrainerCode(code);
    clearFormador();
    clearFeedback();
    if (!/^[A-Z0-9_-]{3,64}$/.test(normalized)) {
      setError("Ingrese un código institucional válido de al menos tres caracteres.");
      return;
    }
    setBusy(true);
    try {
      const response = await invoke({ action: "get", code: normalized });
      setLoadedCode(response.code);
      setFormador(response);
      setDisplayName(response.displayName || "");
      setActive(response.exists ? response.active : true);
      setMessage(response.exists
        ? "Registro consultado. Verifique los datos antes de modificarlo."
        : "Código disponible. Complete el nombre para registrar un nuevo formador.");
    } catch (err) {
      setError(friendlyError(err));
      if ([401, 403].includes(err.status)) await logout();
    } finally {
      setBusy(false);
    }
  };

  const save = async (event) => {
    event.preventDefault();
    clearFeedback();
    if (!formador || !loadedCode || loadedCode !== normalizeAdminTrainerCode(code)) {
      setError("Consulte primero el código institucional que desea administrar.");
      return;
    }
    if (!window.confirm(
      `¿Confirma ${active ? "activar" : "suspender"} el código ${loadedCode}? Esta operación quedará auditada.`
    )) return;
    setBusy(true);
    try {
      const result = await invoke({
        action: "set",
        code: loadedCode,
        displayName: displayName.trim(),
        active,
        expectedRevision: formador.revision,
        reason: reason.trim(),
      });
      setFormador({ ...result, exists: true });
      setReason("");
      setMessage(`Autorización de ${result.code} actualizada. Revisión ${result.revision}. Se registró auditoría.`);
    } catch (err) {
      setError(friendlyError(err));
      if (err.status === 409) clearFormador();
      if ([401, 403].includes(err.status)) await logout();
    } finally {
      setBusy(false);
    }
  };

  if (!firebaseEnabled) {
    return <p role="alert" className="rounded-xl border p-4 text-red-700">
      Firebase no está configurado. La administración institucional no está disponible.
    </p>;
  }

  return (
    <section className="space-y-5 rounded-2xl border bg-white p-5 shadow-sm">
      <div className="space-y-1">
        <h2 className="text-xl font-bold text-slate-900">Administración de formadores</h2>
        <p className="text-sm text-slate-600">
          Acceso exclusivo del administrador autorizado mediante contraseña personal y segundo factor TOTP.
          La contraseña institucional compartida no da acceso a esta sección.
        </p>
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Módulo en desarrollo. La función de servidor permanece bloqueada hasta configurar
          un entorno de pruebas independiente y aprobar la habilitación institucional.
        </p>
      </div>

      {!admin && !mfaChallenge && (
        <form onSubmit={signIn} className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-semibold">
            Correo institucional del administrador
            <input type="email" required autoComplete="username"
              className={COMMON_INPUT} value={email} disabled={busy}
              onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="text-sm font-semibold">
            Contraseña personal
            <input type="password" required autoComplete="current-password"
              className={COMMON_INPUT} value={password} disabled={busy}
              onChange={(e) => setPassword(e.target.value)} />
          </label>
          <button type="submit" disabled={busy} className={COMMON_BUTTON}>
            {busy ? "Verificando…" : "Continuar al segundo factor"}
          </button>
        </form>
      )}

      {!admin && mfaChallenge && (
        <form onSubmit={confirmTotp} className="space-y-3">
          <label className="block text-sm font-semibold">
            Código de aplicación autenticadora (TOTP)
            <input type="text" inputMode="numeric" pattern="[0-9]{6,8}"
              minLength={6} maxLength={8} required autoComplete="one-time-code"
              className={COMMON_INPUT} value={totp} disabled={busy}
              onChange={(e) => setTotp(e.target.value.replace(/\D/g, "").slice(0, 8))} />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className={COMMON_BUTTON} disabled={busy}>
              {busy ? "Verificando…" : "Verificar segundo factor"}
            </button>
            <button type="button" className="rounded-xl border px-4 py-2 text-sm"
              onClick={() => { setMfaChallenge(null); setTotp(""); clearFeedback(); }}
              disabled={busy}>Volver</button>
          </div>
        </form>
      )}

      {admin && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
            <p className="text-sm text-slate-700">
              Sesión administrativa: <strong>{admin.email || "Cuenta institucional"}</strong>
            </p>
            <button type="button" onClick={logout} disabled={busy}
              className="rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50">
              Cerrar sesión
            </button>
          </div>

          <form onSubmit={consult} className="flex flex-wrap items-end gap-3">
            <label className="block flex-1 text-sm font-semibold">
              Código individual del formador
              <input type="text" required minLength={3} maxLength={64}
                className={COMMON_INPUT} value={code} disabled={busy}
                placeholder="Ej.: F001"
                onChange={(e) => {
                  setCode(e.target.value);
                  clearFormador();
                  clearFeedback();
                }} />
            </label>
            <button type="submit" disabled={busy} className={COMMON_BUTTON}>
              {busy ? "Consultando…" : "Consultar código"}
            </button>
          </form>

          {formador && loadedCode === normalizeAdminTrainerCode(code) && (
            <form onSubmit={save} className="space-y-4 rounded-xl border bg-slate-50 p-4">
              <p className="text-sm">
                <strong>{formador.exists ? "Formador registrado" : "Nuevo formador"}</strong>
                {" · Código: "}{loadedCode}{" · Revisión: "}{formador.revision}
              </p>
              <label className="block text-sm font-semibold">
                Nombre institucional
                <input type="text" required minLength={3} maxLength={120}
                  value={displayName} disabled={busy}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className={COMMON_INPUT} />
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" checked={active} disabled={busy}
                  onChange={(e) => setActive(e.target.checked)} />
                Formador activo y autorizado
              </label>
              <label className="block text-sm font-semibold">
                Motivo obligatorio (mínimo 8 caracteres)
                <textarea required minLength={8} maxLength={500} rows={3}
                  className={COMMON_INPUT} value={reason} disabled={busy}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Justificación administrativa de esta modificación" />
              </label>
              <button type="submit" disabled={busy || reason.trim().length < 8}
                className={COMMON_BUTTON}>
                {busy ? "Registrando…" : "Guardar autorización con auditoría"}
              </button>
              <p className="text-xs text-slate-600">
                Suspender conserva el registro y su historial. El administrador no puede eliminarlo físicamente.
              </p>
            </form>
          )}
        </>
      )}

      {message && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{message}</p>}
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    </section>
  );
}
