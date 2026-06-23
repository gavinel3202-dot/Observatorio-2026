import { useMemo, useState, useEffect } from "react";
import {
  UserRound,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  BarChart3,
  ClipboardList,
  BadgeCheck,
  Cloud,
  CloudOff,
  Loader2,
  TrendingUp,
  Edit2,
  Trash2,
  X,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { subscribeRecords, addRecord, firebaseEnabled, updateRecord, deleteRecord } from "./dataStore";
import {
  tests,
  dimensions,
  initialScores,
  evaluateTest,
  getClassificationLabel,
  getScoreColor,
  getIMCData,
  classifyICFG,
} from "./icfg";

// === COMPONENTES UI ===
const Card = ({ children, className = "" }) => (
  <div className={`rounded-2xl border bg-white shadow-sm ${className}`}>{children}</div>
);

const CardContent = ({ children, className = "" }) => (
  <div className={`p-5 ${className}`}>{children}</div>
);

const Button = ({ children, onClick, variant = "primary", className = "", disabled = false }) => {
  const styles =
    variant === "secondary"
      ? "bg-slate-100 text-slate-800 hover:bg-slate-200"
      : variant === "danger"
      ? "bg-red-600 text-white hover:bg-red-700"
      : "bg-indigo-600 text-white hover:bg-indigo-700";

  const disabledStyles = disabled ? "opacity-50 cursor-not-allowed" : "";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${styles} ${disabledStyles} ${className}`}
    >
      {children}
    </button>
  );
};

const initialPerson = () => ({
  nombre: "",
  edad: "",
  sexo: "",
  sede: "",
  fecha: new Date().toISOString().slice(0, 10),
  peso: "",
  talla: "",
});

export default function App() {
  const [activeTab, setActiveTab] = useState("evaluacion");
  const [evaluador, setEvaluador] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [records, setRecords] = useState([]);
  const [busqueda, setBusqueda] = useState("");

  const [person, setPerson] = useState(initialPerson);
  const [scores, setScores] = useState(initialScores);

  // Estados para edición de registros
  const [editingRecord, setEditingRecord] = useState(null);
  const [editData, setEditData] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // === SUSCRIPCIÓN A DATOS (Firebase o localStorage) ===
  useEffect(() => {
    const unsubscribe = subscribeRecords((live) => {
      const sorted = [...live].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      setRecords(sorted);
    });
    return unsubscribe;
  }, []);

  const result = useMemo(() => {
    const detail = tests.map((test) => {
      const rawInput = scores[test.id];
      const score1to5 = evaluateTest(test.id, rawInput, person.edad, person.sexo);

      const validScore = score1to5 > 0 ? score1to5 : 0;
      const weighted = (validScore / 5) * test.weight;

      return { ...test, rawInput, score1to5, validScore, weighted };
    });

    const total = detail.reduce((sum, item) => sum + item.weighted, 0);

    const dimensionScores = dimensions.map((dim) => {
      const items = detail.filter((item) => item.dimension === dim.name);
      const value = items.reduce((sum, item) => sum + item.weighted, 0);
      return { ...dim, value };
    });

    const validTests = detail.filter((d) => d.validScore > 0);
    const weakest =
      validTests.length > 0
        ? [...validTests].sort((a, b) => a.validScore - b.validScore || b.weight - a.weight)[0]
        : { name: "Faltan pruebas" };

    const classification = classifyICFG(total);

    return {
      total: Number(total.toFixed(1)),
      detail,
      dimensionScores,
      weakest,
      classification,
    };
  }, [scores, person.edad, person.sexo]);

  const imcData = useMemo(() => getIMCData(person.peso, person.talla), [person.peso, person.talla]);

  const historial = useMemo(() => {
    const query = busqueda.trim().toLowerCase();
    if (!query) return [];
    return records
      .filter((r) => (r.nombre || "").toLowerCase().includes(query))
      .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
  }, [records, busqueda]);

  const updateScore = (id, value) => {
    setScores((prev) => ({ ...prev, [id]: value }));
  };

  const reset = () => {
    setPerson((prev) => ({ ...prev, nombre: "", edad: "", sexo: "", peso: "", talla: "" }));
    setScores(initialScores);
  };

  const saveRecord = async () => {
    setIsSaving(true);

    const recordToSave = {
      evaluador: evaluador || "No especificado",
      ...person,
      imcValue: imcData ? imcData.value : null,
      imcCategory: imcData ? imcData.category : null,
      scores,
      total: result.total,
      classification: result.classification.label,
      weakest: result.weakest.name,
      timestamp: Date.now(),
      createdAt: new Date().toLocaleString(),
    };

    try {
      await addRecord(recordToSave);
      reset();
    } catch (error) {
      console.error("Error al guardar: ", error);
      alert("Hubo un error al guardar los datos.");
    } finally {
      setIsSaving(false);
    }
  };

  const exportCSV = () => {
    const headers = [
      "FechaRegistro", "Evaluador", "Nombre", "Edad", "Sexo", "Peso(kg)", "Talla(cm)", "IMC", "Categoria_IMC", "Sede", "Puntaje_ICFG", "Clasificacion_ICFG", "Debilidad_Principal",
      ...tests.map((t) => `${t.shortName} (${t.unit})`),
    ];

    const rows = records.map((r) => [
      r.createdAt, r.evaluador, r.nombre, r.edad, r.sexo, r.peso || "", r.talla || "", r.imcValue || "", r.imcCategory || "", r.sede, r.total, r.classification, r.weakest,
      ...tests.map((t) => r.scores?.[t.id] || ""),
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "evaluaciones_completas.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const openEditModal = (record) => {
    setEditingRecord(record);
    setEditData({ ...record });
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    setIsEditModalOpen(false);
    setEditingRecord(null);
    setEditData(null);
    setIsEditing(false);
  };

  const saveEditedRecord = async () => {
    setIsEditing(true);
    try {
      await updateRecord(editingRecord.id, editData);
      closeEditModal();
    } catch (error) {
      console.error("Error al actualizar: ", error);
      alert("Hubo un error al actualizar los datos.");
    } finally {
      setIsEditing(false);
    }
  };

  const deleteRecordHandler = async (recordId) => {
    if (window.confirm("¿Estás seguro de que deseas eliminar este registro?")) {
      try {
        await deleteRecord(recordId);
      } catch (error) {
        console.error("Error al eliminar: ", error);
        alert("Hubo un error al eliminar el registro.");
      }
    }
  };

  const isDemographicMissing = !person.edad || !person.sexo || person.sexo === "Otro / No reporta";
  const isAgeInvalid = person.edad !== "" && (Number(person.edad) < 18 || Number(person.edad) > 69);

  return (
    <div className="min-h-screen bg-slate-50 p-4 text-slate-900 md:p-8 font-sans">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* ENCABEZADO PRINCIPAL */}
        <header className="rounded-3xl bg-gradient-to-r from-indigo-700 to-slate-900 p-6 text-white shadow-lg relative overflow-hidden">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between relative z-10">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm">
                <ClipboardList size={16} /> Evaluación funcional poblacional
              </div>
              <h1 className="text-3xl font-black tracking-tight md:text-4xl">
                Índice de Capacidad Funcional - ICFG
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-indigo-100 md:text-base">
                El sistema calculará automáticamente el baremo (1 al 5) según la edad y el sexo, además del IMC.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <div className="rounded-2xl bg-white/10 p-4 text-center backdrop-blur min-w-[200px]">
                <p className="text-sm text-indigo-100">Resultado actual</p>
                <p className="text-5xl font-black">{result.total}</p>
                <p className="text-xs text-indigo-100">puntos sobre 100</p>
              </div>
              <div
                className={`flex items-center justify-center gap-2 text-xs font-bold rounded-full py-1.5 px-3 backdrop-blur ${
                  firebaseEnabled ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-200"
                }`}
                title={
                  firebaseEnabled
                    ? "Conectado a Firebase"
                    : "Sin Firebase: datos guardados en este navegador (localStorage)"
                }
              >
                {firebaseEnabled ? (
                  <><Cloud size={14} /> Conectado a la nube</>
                ) : (
                  <><CloudOff size={14} /> Almacenamiento local</>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* PESTAÑAS */}
        <div className="flex gap-3">
          {[
            { id: "evaluacion", label: "Nueva Evaluación", icon: ClipboardList },
            { id: "seguimiento", label: "Seguimiento", icon: TrendingUp },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition ${
                  activeTab === tab.id
                    ? "bg-indigo-600 text-white shadow"
                    : "bg-white border text-slate-700 hover:bg-slate-50"
                }`}
              >
                <Icon size={16} /> {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === "seguimiento" ? (
          <Card>
            <CardContent>
              <h2 className="mb-1 flex items-center gap-2 text-xl font-bold">
                <TrendingUp className="text-indigo-600" /> Seguimiento por usuario
              </h2>
              <p className="mb-4 text-sm text-slate-500">
                Busca por nombre para ver la evolución del puntaje ICFG en el tiempo.
              </p>
              <input
                className="mb-6 w-full rounded-xl border p-3 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                placeholder="Buscar por nombre..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
              {busqueda && historial.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No hay evaluaciones para &quot;{busqueda}&quot;.
                </p>
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={historial}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="fecha" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip />
                      <Line type="monotone" dataKey="total" stroke="#4f46e5" strokeWidth={3} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            {/* CASILLA DEL EVALUADOR */}
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4 shadow-sm flex flex-col md:flex-row md:items-center gap-4 transition-all">
              <div className="flex items-center gap-2 text-indigo-900 font-bold whitespace-nowrap">
                <BadgeCheck size={22} className="text-indigo-600" />
                <span>Nombre del Evaluador:</span>
              </div>
              <input
                className="flex-1 rounded-xl border border-indigo-200 bg-white p-3 text-sm font-semibold text-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm"
                placeholder="Ingresa tu nombre o código (se mantendrá en todos los registros de tu sesión)..."
                value={evaluador}
                onChange={(e) => setEvaluador(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <section className="space-y-6 lg:col-span-2">

                {/* DATOS DEL USUARIO + IMC */}
                <Card className={isDemographicMissing || isAgeInvalid ? "ring-2 ring-orange-400" : ""}>
                  <CardContent>
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="flex items-center gap-2 text-xl font-bold">
                        <UserRound className="text-indigo-600" /> Datos del usuario a evaluar
                      </h2>
                      <div className="flex gap-2">
                        {isDemographicMissing && !isAgeInvalid && (
                          <span className="text-xs font-bold bg-orange-100 text-orange-700 px-3 py-1 rounded-full animate-pulse">
                            ¡Requeridos para cálculos!
                          </span>
                        )}
                        {isAgeInvalid && (
                          <span className="text-xs font-bold bg-red-100 text-red-700 px-3 py-1 rounded-full animate-pulse">
                            Rango válido: 18 a 69 años
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
                      <input
                        className="rounded-xl border p-3 md:col-span-2 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition"
                        placeholder="Nombre completo"
                        value={person.nombre}
                        onChange={(e) => setPerson({ ...person, nombre: e.target.value })}
                      />
                      <input
                        className={`rounded-xl border p-3 outline-none transition ${
                          isAgeInvalid
                            ? "bg-red-50 border-red-300 focus:border-red-500 focus:ring-1 focus:ring-red-500 text-red-700"
                            : !person.edad
                            ? "bg-orange-50 border-orange-200"
                            : "focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        }`}
                        placeholder="Edad"
                        type="number"
                        min="18"
                        max="69"
                        value={person.edad}
                        onChange={(e) => setPerson({ ...person, edad: e.target.value })}
                      />
                      <select
                        className={`rounded-xl border p-3 outline-none transition ${
                          !person.sexo || person.sexo === "Otro / No reporta"
                            ? "bg-orange-50 border-orange-200"
                            : "bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        }`}
                        value={person.sexo}
                        onChange={(e) => setPerson({ ...person, sexo: e.target.value })}
                      >
                        <option value="" disabled>Sexo</option>
                        <option value="Mujer">Mujer</option>
                        <option value="Hombre">Hombre</option>
                        <option value="Otro / No reporta">Otro / No reporta</option>
                      </select>
                      <input
                        className="rounded-xl border p-3 md:col-span-2 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition"
                        type="date"
                        value={person.fecha}
                        onChange={(e) => setPerson({ ...person, fecha: e.target.value })}
                      />

                      <input
                        className="rounded-xl border p-3 md:col-span-2 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition"
                        placeholder="Sede, escenario o grupo"
                        value={person.sede}
                        onChange={(e) => setPerson({ ...person, sede: e.target.value })}
                      />

                      <div className="relative">
                        <input
                          type="number"
                          step="0.1"
                          className="w-full rounded-xl border bg-white p-3 pr-8 text-sm font-bold text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 outline-none transition"
                          placeholder="Peso"
                          value={person.peso}
                          onChange={(e) => setPerson({ ...person, peso: e.target.value })}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">kg</span>
                      </div>

                      <div className="relative">
                        <input
                          type="number"
                          step="1"
                          className="w-full rounded-xl border bg-white p-3 pr-8 text-sm font-bold text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 outline-none transition"
                          placeholder="Talla"
                          value={person.talla}
                          onChange={(e) => setPerson({ ...person, talla: e.target.value })}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">cm</span>
                      </div>

                      {imcData ? (
                        <div className={`md:col-span-2 rounded-xl border p-2 flex flex-col justify-center items-center text-center transition-colors ${imcData.color}`}>
                          <div className="text-xs font-bold uppercase tracking-wide opacity-80">IMC: {imcData.value}</div>
                          <div className="text-sm font-black leading-tight">{imcData.category}</div>
                        </div>
                      ) : (
                        <div className="md:col-span-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-2 flex items-center justify-center text-xs font-medium text-slate-400 text-center">
                          Calculadora de IMC
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent>
                    <h2 className="mb-4 flex items-center gap-2 text-xl font-bold">
                      <BarChart3 className="text-indigo-600" /> Pruebas Físicas (Dato Bruto)
                    </h2>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      {result.detail.map((test) => {
                        const Icon = test.icon;
                        let badgeText = "Pendiente";

                        if (test.score1to5 === -1) badgeText = "⚠️ Ingresa Edad/Sexo";
                        else if (test.score1to5 === -2) badgeText = "🚫 Edad fuera de rango";
                        else if (test.score1to5 !== null)
                          badgeText = `${test.score1to5}/5 - ${getClassificationLabel(test.score1to5)}`;

                        return (
                          <div key={test.id} className="rounded-2xl border bg-slate-50 p-4 transition-all hover:border-indigo-200 hover:shadow-md">
                            <div className="mb-3 flex items-start justify-between gap-3">
                              <div>
                                <p className="flex items-center gap-2 font-bold text-slate-800">
                                  <Icon size={18} className="text-indigo-600" /> {test.name}
                                </p>
                                <p className="text-xs font-medium text-slate-500 mt-1">
                                  {test.dimension} · Peso: {test.weight}%
                                </p>
                              </div>
                              {test.validScore > 0 && (
                                <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold text-indigo-800 whitespace-nowrap">
                                  +{test.weighted.toFixed(1)} pts
                                </span>
                              )}
                            </div>

                            <div className="flex gap-2">
                              <div className="relative w-1/2">
                                <input
                                  type="number"
                                  step="0.1"
                                  className="w-full rounded-xl border bg-white p-3 pr-10 text-sm font-bold text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition"
                                  placeholder={test.placeholder}
                                  value={test.rawInput}
                                  onChange={(e) => updateScore(test.id, e.target.value)}
                                  disabled={isAgeInvalid}
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                                  {test.unit}
                                </span>
                              </div>

                              <div className={`w-1/2 rounded-xl border flex items-center justify-center text-xs font-bold text-center px-2 transition-colors ${getScoreColor(test.score1to5)}`}>
                                {badgeText}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </section>

              <aside className="space-y-6">
                <Card className="overflow-hidden border-2 border-indigo-100 shadow-md">
                  <CardContent>
                    <h2 className="mb-2 text-xl font-black text-slate-800">Resultado ICFG</h2>
                    <div className="mb-4 flex items-end gap-3">
                      <span className="text-6xl font-black tracking-tighter text-indigo-900">{result.total}</span>
                      <span className="mb-2 text-sm font-bold text-slate-500">/ 100 puntos</span>
                    </div>

                    <div className="h-4 overflow-hidden rounded-full bg-slate-100 border shadow-inner">
                      <div
                        className={`h-full transition-all duration-500 ease-out ${result.classification.bar}`}
                        style={{ width: `${Math.min(result.total, 100)}%` }}
                      />
                    </div>

                    <div className={`mt-5 rounded-2xl border p-4 shadow-sm ${result.classification.color}`}>
                      <p className="text-lg font-black leading-tight mb-2">
                        {result.classification.emoji} {result.classification.label}
                      </p>
                      <p className="text-sm opacity-90">{result.classification.profile}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent>
                    <h3 className="mb-3 flex items-center gap-2 text-lg font-bold text-slate-800">
                      <AlertTriangle className="text-orange-500" /> Debilidad principal detectada
                    </h3>
                    <p className="rounded-xl bg-orange-50 border border-orange-100 p-3 font-bold text-orange-900 shadow-inner">
                      {result.weakest.name}
                    </p>
                    <p className="mt-3 text-xs font-medium text-slate-500 leading-relaxed">
                      Basado en los baremos calculados, esta prueba demostró la mayor carencia. Prioriza su mejora en el plan de intervención.
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent>
                    <h3 className="mb-3 flex items-center gap-2 text-lg font-bold text-slate-800">
                      <CheckCircle2 className="text-emerald-600" /> Acción sugerida
                    </h3>
                    <p className="text-sm font-medium leading-relaxed text-slate-700 bg-slate-50 p-4 rounded-xl border">
                      {result.classification.action}
                    </p>
                  </CardContent>
                </Card>

                <div className="sticky bottom-4 z-20 bg-slate-50 py-2 space-y-3">
                  <Button
                    className="w-full shadow-md hover:shadow-lg"
                    onClick={saveRecord}
                    disabled={isSaving || isAgeInvalid || result.total === 0}
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="animate-spin" size={18} />
                        Guardando...
                      </>
                    ) : (
                      <>
                        {firebaseEnabled ? <Cloud size={18} /> : <ClipboardList size={18} />}
                        {firebaseEnabled ? "Guardar en la nube" : "Guardar"}
                      </>
                    )}
                  </Button>
                  <Button className="w-full shadow-sm" onClick={reset} variant="secondary" disabled={isSaving}>
                    <RotateCcw size={18} /> Limpiar formulario
                  </Button>
                </div>
              </aside>
            </div>
          </>
        )}

        {/* BASE DE DATOS CONSOLIDADA */}
        <Card className="mt-8 border-indigo-100 shadow-sm">
          <CardContent>
            <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b pb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Base de Datos Consolidada</h2>
                <p className="text-sm font-medium text-slate-500 mt-1">
                  Muestra todas las evaluaciones registradas. Exporta los datos crudos a CSV para el observatorio.
                </p>
              </div>
              <Button
                onClick={exportCSV}
                variant="secondary"
                className="md:w-auto font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200"
                disabled={records.length === 0}
              >
                Descargar Base de Datos (CSV)
              </Button>
            </div>

            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full min-w-[1000px] border-collapse text-sm text-slate-700">
                <thead>
                  <tr className="bg-slate-50 text-left border-b border-slate-200">
                    <th className="p-4 font-bold">Evaluador</th>
                    <th className="p-4 font-bold">Usuario</th>
                    <th className="p-4 font-bold">IMC OMS</th>
                    <th className="p-4 font-bold text-center">Sede/Grupo</th>
                    <th className="p-4 font-black text-indigo-900 bg-indigo-50 text-center">ICFG</th>
                    <th className="p-4 font-bold">Alerta (Debilidad)</th>
                    <th className="p-4 font-bold text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {records.length === 0 ? (
                    <tr>
                      <td className="p-8 text-center text-slate-500 font-medium" colSpan="7">
                        No hay evaluaciones guardadas en la base de datos.<br />
                        <span className="text-xs font-normal">Calcula un índice y presiona &quot;Guardar&quot; para iniciar.</span>
                      </td>
                    </tr>
                  ) : (
                    records.map((record) => (
                      <tr key={record.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-4 font-semibold text-slate-600 whitespace-nowrap">
                          {record.evaluador || "-"}
                        </td>
                        <td className="p-4 font-bold text-slate-900">
                          {record.nombre || "Sin nombre"}
                          <span className="block text-xs font-normal text-slate-500 mt-1">
                            {record.sexo && record.sexo !== "" ? `${record.sexo}, ` : ""}
                            {record.edad ? `${record.edad} años` : ""}
                          </span>
                        </td>
                        <td className="p-4">
                          {record.imcValue ? (
                            <div>
                              <span className="font-black text-slate-800">{record.imcValue}</span>
                              <span className="block text-xs font-semibold text-slate-500 mt-0.5">{record.imcCategory}</span>
                            </div>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="p-4 truncate max-w-[200px] text-center">{record.sede || "-"}</td>
                        <td className="p-4 font-black text-lg text-indigo-600 bg-indigo-50/30 text-center">
                          {record.total}
                        </td>
                        <td className="p-4 font-medium text-orange-700 text-xs">{record.weakest}</td>
                        <td className="p-4 text-center flex gap-2 justify-center">
                          <button
                            onClick={() => openEditModal(record)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-700 font-semibold text-xs transition"
                            title="Editar registro"
                          >
                            <Edit2 size={14} /> Editar
                          </button>
                          <button
                            onClick={() => deleteRecordHandler(record.id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-100 hover:bg-red-200 text-red-700 font-semibold text-xs transition"
                            title="Eliminar registro"
                          >
                            <Trash2 size={14} /> Eliminar
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* MODAL DE EDICIÓN */}
        {isEditModalOpen && editData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
              <CardContent>
                <div className="flex items-center justify-between mb-6 sticky top-0 bg-white pb-4">
                  <h2 className="text-2xl font-bold text-slate-800">Editar Evaluación</h2>
                  <button
                    onClick={closeEditModal}
                    className="p-2 hover:bg-slate-100 rounded-lg transition"
                    title="Cerrar"
                  >
                    <X size={20} className="text-slate-600" />
                  </button>
                </div>

                <div className="space-y-6">
                  {/* Datos del usuario */}
                  <div>
                    <h3 className="font-bold text-slate-800 mb-3">Datos del Usuario</h3>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <input
                        className="rounded-xl border p-3 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition"
                        placeholder="Nombre completo"
                        value={editData.nombre || ""}
                        onChange={(e) => setEditData({ ...editData, nombre: e.target.value })}
                      />
                      <input
                        className="rounded-xl border p-3 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition"
                        placeholder="Edad"
                        type="number"
                        min="18"
                        max="69"
                        value={editData.edad || ""}
                        onChange={(e) => setEditData({ ...editData, edad: e.target.value })}
                      />
                      <select
                        className="rounded-xl border p-3 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition"
                        value={editData.sexo || ""}
                        onChange={(e) => setEditData({ ...editData, sexo: e.target.value })}
                      >
                        <option value="" disabled>Sexo</option>
                        <option value="Mujer">Mujer</option>
                        <option value="Hombre">Hombre</option>
                        <option value="Otro / No reporta">Otro / No reporta</option>
                      </select>
                      <input
                        className="rounded-xl border p-3 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition"
                        placeholder="Sede, escenario o grupo"
                        value={editData.sede || ""}
                        onChange={(e) => setEditData({ ...editData, sede: e.target.value })}
                      />
                      <input
                        className="rounded-xl border p-3 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition"
                        type="date"
                        value={editData.fecha || ""}
                        onChange={(e) => setEditData({ ...editData, fecha: e.target.value })}
                      />
                      <input
                        className="rounded-xl border p-3 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition"
                        placeholder="Evaluador"
                        value={editData.evaluador || ""}
                        onChange={(e) => setEditData({ ...editData, evaluador: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Medidas antropométricas */}
                  <div>
                    <h3 className="font-bold text-slate-800 mb-3">Medidas Antropométricas</h3>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div className="relative">
                        <input
                          type="number"
                          step="0.1"
                          className="w-full rounded-xl border p-3 pr-8 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition"
                          placeholder="Peso"
                          value={editData.peso || ""}
                          onChange={(e) => setEditData({ ...editData, peso: e.target.value })}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">kg</span>
                      </div>
                      <div className="relative">
                        <input
                          type="number"
                          step="1"
                          className="w-full rounded-xl border p-3 pr-8 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition"
                          placeholder="Talla"
                          value={editData.talla || ""}
                          onChange={(e) => setEditData({ ...editData, talla: e.target.value })}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">cm</span>
                      </div>
                    </div>
                  </div>

                  {/* Botones de acción */}
                  <div className="flex gap-3 justify-end pt-4 border-t">
                    <Button
                      onClick={closeEditModal}
                      variant="secondary"
                      disabled={isEditing}
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={saveEditedRecord}
                      disabled={isEditing}
                    >
                      {isEditing ? (
                        <>
                          <Loader2 className="animate-spin" size={16} />
                          Guardando...
                        </>
                      ) : (
                        "Guardar cambios"
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
