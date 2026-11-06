import { useState } from "react";
import { createTrainerSession } from "./icfgCorrectionClient";

export default function TrainerAccessTest() {
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  async function verify(event) {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setResult(null);

    try {
      const response = await createTrainerSession(
        code.trim(),
        password
      );

      if (!response?.token || !response?.code) {
        throw new Error("Respuesta de acceso invalida.");
      }

      // No conservar el token ni iniciar una sesion operativa.
      setResult({
        success: true,
        message:
          "Acceso de prueba autorizado para " +
          response.code +
          ". No se habilitaron correcciones.",
      });
    } catch (error) {
      setResult({
        success: false,
        message:
          error?.message ||
          "No se pudo comprobar el acceso.",
      });
    } finally {
      setPassword("");
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border bg-white p-5 shadow-sm space-y-4">
      <h2 className="text-xl font-bold">
        Acceso de formadores (ensayo)
      </h2>

      <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm">
        Esta pantalla solo comprueba la autorizacion del
        formador. No permite crear, editar ni eliminar
        evaluaciones.
      </p>

      <form onSubmit={verify} autoComplete="off"
        className="grid gap-4">

        <label className="font-semibold">
          Codigo individual del formador
          <input
            type="text"
            className="mt-1 w-full rounded-lg border p-3"
            value={code}
            maxLength={64}
            onChange={(e) => setCode(e.target.value)}
            placeholder="DEMO-FORMADOR-02"
            required
            autoComplete="off"
          />
        </label>

        <label className="font-semibold">
          Contrasena institucional de ensayos
          <input
            type="password"
            className="mt-1 w-full rounded-lg border p-3"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="off"
          />
        </label>

        <button
          type="submit"
          disabled={busy || !code.trim() || !password}
          className="rounded-lg bg-indigo-600 p-3 font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Comprobando..." : "Comprobar acceso"}
        </button>
      </form>

      {result && (
        <p
          role={result.success ? "status" : "alert"}
          className={
            "rounded-lg p-3 " +
            (result.success
              ? "bg-green-50 text-green-800"
              : "bg-red-50 text-red-800")
          }
        >
          {result.message}
        </p>
      )}

      <p className="text-sm text-slate-600">
        El codigo identifica una autorizacion, no verifica
        por si solo la identidad fisica del formador.
        Los intentos fallidos pueden producir un bloqueo
        temporal de seguridad.
      </p>
    </section>
  );
}
