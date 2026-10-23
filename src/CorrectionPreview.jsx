import { useMemo, useState } from "react";
import { tests } from "./icfg";
import { prepareCorrection, EDITABLE_PERSON_FIELDS } from "./correctionDraft";

/**
 * Vista previa exclusivamente: NO escribe en Firebase.
 * La autenticación y la autorización deben implementarse antes de habilitar guardado.
 */
export default function CorrectionPreview({ records }) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [person, setPerson] = useState({});
  const [scores, setScores] = useState({});
  const [actor, setActor] = useState("");
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 3) return [];
    return records.filter((r) =>
      String(r.numeroDocumento ?? "").toLowerCase().includes(q) ||
      String(r.nombre ?? "").toLowerCase().includes(q)
    ).slice(0, 20);
  }, [records, query]);
  const selected = records.find((r) => r.id === selectedId);

  const selectRecord = (r) => {
    setSelectedId(r.id);
    setPerson(Object.fromEntries(EDITABLE_PERSON_FIELDS.map((k) => [k, r[k] ?? ""])));
    setScores(Object.fromEntries(tests.map((t) => [t.id, r.scores?.[t.id] ?? ""])));
    setPreview(null);
    setError("");
    setReason("");
  };

  const calculate = () => {
    try {
      setPreview(prepareCorrection(selected, { person, scores }, actor, reason));
      setError("");
    } catch (e) {
      setError(e.message);
      setPreview(null);
    }
  };

  const fieldLabels = {
    nombre: "Nombre", edad: "Edad", tipoDocumento: "Tipo de documento",
    numeroDocumento: "Número de documento", sexo: "Sexo", sede: "Sede",
    fecha: "Fecha de evaluación", peso: "Peso (kg)", talla: "Talla (cm)",
  };

  return (
    <section className="rounded-2xl border bg-white p-5 shadow-sm space-y-4">
      <h2 className="text-xl font-bold">Corrección de evaluaciones — vista previa</h2>
      <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
        Modo de prueba: esta pantalla NO guarda cambios. La edición real requiere
        autenticación individual, permisos en servidor y auditoría.
      </p>
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
            <label className="text-sm font-semibold">Identificación del formador (borrador)
              <input className="mt-1 w-full rounded-lg border p-2" value={actor}
                onChange={(e) => { setActor(e.target.value); setPreview(null); }} />
            </label>
            <label className="text-sm font-semibold">Motivo de la corrección
              <input className="mt-1 w-full rounded-lg border p-2" value={reason}
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
              <button type="button" disabled
                className="rounded-lg bg-slate-200 px-4 py-2 text-slate-600">
                Guardar corrección (no disponible en modo de prueba)
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
