import { useMemo, useState } from "react";
import { tests } from "./icfg";
import { prepareCorrection, EDITABLE_PERSON_FIELDS } from "./correctionDraft";
import {
  createTrainerSession, submitCorrection, changedFieldsFromAudit,
} from "./icfgCorrectionClient";

// Solo un interruptor de interfaz. La autorización REAL sigue en el servidor.
// No habilitar VITE_ICFG_CORRECTION_ACCESS hasta las pruebas institucionales.
const ACCESS_UI_ENABLED = import.meta.env.VITE_ICFG_CORRECTION_ACCESS === "true";

export default function CorrectionPreview({ records }) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [person, setPerson] = useState({});
  const [scores, setScores] = useState({});
  const [actorDraft, setActorDraft] = useState("");
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [session, setSession] = useState(null);
  const [busy, setBusy] = useState(false);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 3) return [];
    return records.filter((r) =>
      String(r.numeroDocumento ?? "").toLowerCase().includes(q) ||
      String(r.nombre ?? "").toLowerCase().includes(q)
    ).slice(0, 20);
  }, [records, query]);
  const selected = records.find((r) => r.id === selectedId);
  const hasSession = Boolean(session && session.expiresAt > Date.now());

  const selectRecord = (r) => {
    setSelectedId(r.id);
    setPerson(Object.fromEntries(EDITABLE_PERSON_FIELDS.map((k) => [k, r[k] ?? ""])));
    setScores(Object.fromEntries(tests.map((t) => [t.id, r.scores?.[t.id] ?? ""])));
    setPreview(null);
    setError("");
    setNotice("");
    setReason("");
  };

  const calculate = () => {
    try {
      const actor = ACCESS_UI_ENABLED ? (session?.code || "BORRADOR") : actorDraft;
      const proposal = prepareCorrection(selected, { person, scores }, actor, reason);
      setPreview({ ...proposal, expectedRevision: selected.revision ?? 0 });
      setError("");
      setNotice("");
    } catch (e) {
      setError(e.message);
      setPreview(null);
    }
  };

  const login = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await createTrainerSession(code.trim(), password);
      if (!result?.token || !result?.code) throw new Error("Respuesta de sesión inválida.");
      setSession({
        token: result.token, code: result.code,
        expiresAt: Date.now() + Number(result.expiresInSeconds || 900) * 1000,
      });
      setPreview(null);
      setNotice("Formador autorizado. La sesión es temporal.");
    } catch (e) {
      setSession(null);
      setError(e.message);
    } finally {
      setPassword("");
      setBusy(false);
    }
  };

  const save = async () => {
    if (!ACCESS_UI_ENABLED || !hasSession || !preview || !selected) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const saved = await submitCorrection(session.token, {
        documentId: selected.id,
        expectedRevision: preview.expectedRevision,
        changes: changedFieldsFromAudit(preview.auditDraft.after),
        reason,
      });
      setNotice(`Corrección guardada con auditoría. Revisión: ${saved.revision}.`);
      setPreview(null);
      setSelectedId("");
      setReason("");
    } catch (e) {
      if (e.status === 401 || e.status === 403) setSession(null);
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const fieldLabels = {
    nombre: "Nombre", edad: "Edad", tipoDocumento: "Tipo de documento",
    numeroDocumento: "Número de documento", sexo: "Sexo", sede: "Sede",
    fecha: "Fecha de evaluación", peso: "Peso (kg)", talla: "Talla (cm)",
  };

  return (
    <section className="rounded-2xl border bg-white p-5 shadow-sm space-y-4">
      <h2 className="text-xl font-bold">
        {ACCESS_UI_ENABLED ? "Corrección de evaluaciones" : "Corrección de evaluaciones — vista previa"}
      </h2>
      {!ACCESS_UI_ENABLED && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Modo de prueba: esta pantalla NO guarda cambios. La edición real requiere
          contraseña institucional, identificación del formador, permisos del servidor y auditoría.
        </p>
      )}
      {ACCESS_UI_ENABLED && (
        <div className="rounded-xl border border-slate-200 p-4 space-y-3">
          {hasSession ? (
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>Sesión de formador: <strong>{session.code}</strong> (vigencia máxima 15 minutos)</span>
              <button type="button" className="rounded-lg border px-3 py-1"
                onClick={() => { setSession(null); setPreview(null); setNotice("Sesión cerrada."); }}>
                Cerrar sesión
              </button>
            </div>
          ) : (
            <form className="grid grid-cols-1 gap-3 sm:grid-cols-3" onSubmit={login}>
              <label className="text-sm font-semibold">Código institucional individual
                <input className="mt-1 w-full rounded-lg border p-2" required
                  value={code} autoComplete="username"
                  onChange={(e) => setCode(e.target.value)} />
              </label>
              <label className="text-sm font-semibold">Contraseña institucional compartida
                <input type="password" className="mt-1 w-full rounded-lg border p-2" required
                  value={password} autoComplete="off"
                  onChange={(e) => setPassword(e.target.value)} />
              </label>
              <button type="submit" disabled={busy}
                className="self-end rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white disabled:opacity-50">
                {busy ? "Verificando…" : "Ingresar"}
              </button>
            </form>
          )}
        </div>
      )}
      {notice && <p role="status" className="rounded-lg bg-green-50 p-3 text-green-800">{notice}</p>}
      <label className="block text-sm font-semibold">
        Buscar evaluación por documento o nombre
        <input className="mt-1 w-full rounded-xl border p-3" value={query}
          placeholder="Escribe al menos 3 caracteres"
          onChange={(e) => { setQuery(e.target.value); setSelectedId(""); setPreview(null); }} />
      </label>
      <div className="max-h-44 space-y-1 overflow-auto">
        {matches.map((r) => (
          <button type="button" key={r.id} onClick={() => selectRecord(r)}
            className="block w-full rounded-lg border p-2 text-left hover:bg-indigo-50">
            {r.nombre || "Sin nombre"} — {r.tipoDocumento || ""} {r.numeroDocumento || ""}
            {" · "}{r.fecha || "Sin fecha"} · ICFG {r.total ?? "—"}
          </button>
        ))}
      </div>
      {selected && (
        <>
          <p className="text-sm font-semibold">Evaluación seleccionada: {selected.fecha || "Sin fecha"}</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {EDITABLE_PERSON_FIELDS.map((key) => (
              <label key={key} className="text-sm font-semibold">
                {fieldLabels[key]}
                <input className="mt-1 w-full rounded-lg border p-2"
                  value={person[key] ?? ""}
                  onChange={(e) => {
                    setPerson((old) => ({ ...old, [key]: e.target.value }));
                    setPreview(null);
                  }} />
              </label>
            ))}
            {tests.map((test) => (
              <label key={test.id} className="text-sm font-semibold">
                {test.name} ({test.unit})
                <input type="number" step="any" className="mt-1 w-full rounded-lg border p-2"
                  value={scores[test.id] ?? ""}
                  onChange={(e) => {
                    setScores((old) => ({ ...old, [test.id]: e.target.value }));
                    setPreview(null);
                  }} />
              </label>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {!ACCESS_UI_ENABLED && (
              <label className="text-sm font-semibold">Identificación del formador (borrador)
                <input className="mt-1 w-full rounded-lg border p-2" value={actorDraft}
                  onChange={(e) => { setActorDraft(e.target.value); setPreview(null); }} />
              </label>
            )}
            <label className="text-sm font-semibold">Motivo de la corrección
              <input className="mt-1 w-full rounded-lg border p-2" value={reason} maxLength={500}
                onChange={(e) => { setReason(e.target.value); setPreview(null); }} />
            </label>
          </div>
          <button type="button" onClick={calculate}
            className="rounded-xl bg-indigo-600 px-4 py-2 font-semibold text-white">
            Previsualizar corrección
          </button>
          {error && <p role="alert" className="text-red-700">{error}</p>}
          {preview && (
            <div className="space-y-2 rounded-xl border bg-slate-50 p-4">
              <p className="font-bold">ICFG propuesto: {preview.proposedRecord.total} / 100</p>
              <p>IMC propuesto: {preview.proposedRecord.imcValue ?? "Sin datos"}</p>
              <p className="font-semibold">Cambios detectados:</p>
              <ul className="list-disc pl-5 text-sm">
                {Object.keys(preview.auditDraft.after).map((key) => (
                  <li key={key}>
                    {key}: {String(preview.auditDraft.before[key] ?? "—")}
                    {" → "}{String(preview.auditDraft.after[key])}
                  </li>
                ))}
              </ul>
              <button type="button"
                disabled={!ACCESS_UI_ENABLED || !hasSession || busy}
                onClick={save}
                className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white disabled:bg-slate-200 disabled:text-slate-600">
                {!ACCESS_UI_ENABLED
                  ? "Guardar corrección (no disponible en modo de prueba)"
                  : !hasSession
                  ? "Ingresa con tu código para guardar"
                  : busy ? "Guardando…" : "Guardar corrección con auditoría"}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
