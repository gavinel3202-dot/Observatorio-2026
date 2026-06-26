import { useState, useEffect, useRef } from "react";
import SignatureCanvas from "react-signature-canvas";
import {
  UserRound, Shield, ClipboardList, Activity, AlertTriangle,
  HeartPulse, Download, Edit3, Save, Trash2, Cloud, CloudOff,
  CheckCircle2, XCircle, FileText, BarChart3, ChevronRight,
  ChevronLeft, Loader2,
} from "lucide-react";
import { subscribeRecords, addRecord, updateRecord, deleteRecord, firebaseEnabled } from "./dataStore";
import {
  evaluateSFT, calculateIMC, classifyIMC, waistRisk, getAgeGroup,
} from "./sftBaremos";
import { PATHOLOGIES, calculateECNTRisk, getPathologyRecommendations } from "./ecntRisk";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

// ============ UI COMPONENTS ============
const Card = ({ children, className = "" }) => (
  <div className={`rounded-2xl border bg-white shadow-sm ${className}`}>{children}</div>
);
const CardContent = ({ children, className = "" }) => (
  <div className={`p-5 ${className}`}>{children}</div>
);
const Button = ({ children, onClick, variant = "primary", className = "", disabled = false, type = "button" }) => {
  const styles =
    variant === "secondary" ? "bg-slate-100 text-slate-800 hover:bg-slate-200"
    : variant === "danger" ? "bg-red-600 text-white hover:bg-red-700"
    : variant === "success" ? "bg-green-600 text-white hover:bg-green-700"
    : "bg-blue-600 text-white hover:bg-blue-700";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`px-5 py-3 rounded-xl font-semibold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${styles} ${className}`}
    >
      {children}
    </button>
  );
};

// ============ STEPS ============
const STEPS = [
  { id: "consent", label: "Consentimiento", icon: Shield },
  { id: "anamnesis", label: "Anamnesis", icon: ClipboardList },
  { id: "anthropometry", label: "Antropometría", icon: UserRound },
  { id: "sft", label: "Senior Fitness Test", icon: Activity },
  { id: "safety", label: "Seguridad", icon: AlertTriangle },
  { id: "risk", label: "Riesgo ECNT", icon: HeartPulse },
  { id: "results", label: "Resultados", icon: BarChart3 },
];

// ============ MAIN APP ============
export default function App() {
  const [currentStep, setCurrentStep] = useState(0);
  const [records, setRecords] = useState([]);
  const [view, setView] = useState("form"); // form | database | edit
  const [editingRecord, setEditingRecord] = useState(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [consent, setConsent] = useState({ accepted: false, name: "", document: "", signed: false });
  const [anamnesis, setAnamnesis] = useState({ pathologies: {}, medications: {}, otherName: "", otherMed: "" });
  const [anthropometry, setAnthropometry] = useState({ weight: "", height: "", waist: "", calf: "" });
  const [sftData, setSftData] = useState({
    chairStand: "", armCurl: "", walkTest: "", stepTest: "",
    sitReach: "", backScratch: "", upAndGo: "",
  });
  const [demographics, setDemographics] = useState({ age: "", sex: "", sede: "", comuna: "", grupo: "" });
  const [safety, setSafety] = useState({ pain: false, dizziness: false, fatigue: false, notes: "" });

  const sigCanvas = useRef(null);

  useEffect(() => {
    const unsub = subscribeRecords(setRecords);
    return unsub;
  }, []);

  // ===== CONSENT VALIDATION =====
  const isConsentValid = consent.accepted && consent.name.trim() && consent.document.trim() && consent.signed;

  // ===== ANAMNESIS VALIDATION =====
  const isAnamnesisValid = () => {
    const selected = Object.entries(anamnesis.pathologies).filter(([, v]) => v);
    for (const [key] of selected) {
      if (key === "otra") {
        if (!anamnesis.otherName.trim() || !anamnesis.otherMed.trim()) return false;
      } else {
        if (!anamnesis.medications[key]?.trim()) return false;
      }
    }
    return true;
  };

  // ===== SAFETY CHECK =====
  const hasSafetyAlert = safety.pain || safety.dizziness || safety.fatigue;

  // ===== SAVE EVALUATION =====
  const handleSave = async () => {
    setSaving(true);
    const imc = calculateIMC(anthropometry.weight, anthropometry.height);
    const sftResults = evaluateSFT(sftData, demographics.sex, demographics.age);
    const selectedPaths = Object.entries(anamnesis.pathologies).filter(([, v]) => v).map(([k]) => k);
    const ecntRisk = calculateECNTRisk(selectedPaths, imc, anthropometry.waist, demographics.sex, sftResults);

    const record = {
      timestamp: new Date().toISOString(),
      consent: { name: consent.name, document: consent.document },
      demographics,
      anamnesis: {
        pathologies: selectedPaths,
        medications: anamnesis.medications,
        otherName: anamnesis.otherName,
        otherMed: anamnesis.otherMed,
      },
      anthropometry,
      imc: imc ? imc.toFixed(1) : null,
      imcClass: classifyIMC(imc)?.label || null,
      sftData,
      sftResults,
      safety,
      ecntRisk: { score: ecntRisk.score, level: ecntRisk.level },
      hasSafetyAlert,
    };

    try {
      await addRecord(record);
      resetForm();
      setView("database");
    } catch (err) {
      console.error("Error guardando:", err);
      alert("Error al guardar la evaluación. Intente nuevamente.");
    }
    setSaving(false);
  };

  const resetForm = () => {
    setCurrentStep(0);
    setConsent({ accepted: false, name: "", document: "", signed: false });
    setAnamnesis({ pathologies: {}, medications: {}, otherName: "", otherMed: "" });
    setAnthropometry({ weight: "", height: "", waist: "", calf: "" });
    setSftData({ chairStand: "", armCurl: "", walkTest: "", stepTest: "", sitReach: "", backScratch: "", upAndGo: "" });
    setDemographics({ age: "", sex: "", sede: "", comuna: "", grupo: "" });
    setSafety({ pain: false, dizziness: false, fatigue: false, notes: "" });
    if (sigCanvas.current) sigCanvas.current.clear();
  };

  // ===== EXPORT =====
  const exportData = (format) => {
    if (records.length === 0) return alert("No hay datos para exportar.");
    const rows = records.map(r => ({
      Fecha: r.timestamp ? new Date(r.timestamp).toLocaleDateString("es-CO") : "",
      Nombre: r.consent?.name || "",
      Documento: r.consent?.document || "",
      Edad: r.demographics?.age || "",
      Sexo: r.demographics?.sex || "",
      Sede: r.demographics?.sede || "",
      Comuna: r.demographics?.comuna || "",
      Grupo: r.demographics?.grupo || "",
      Peso_kg: r.anthropometry?.weight || "",
      Talla_cm: r.anthropometry?.height || "",
      IMC: r.imc || "",
      Clasificacion_IMC: r.imcClass || "",
      Perimetro_cintura: r.anthropometry?.waist || "",
      Perimetro_pantorrilla: r.anthropometry?.calf || "",
      Chair_Stand: r.sftData?.chairStand || "",
      Arm_Curl: r.sftData?.armCurl || "",
      Walk_6min: r.sftData?.walkTest || "",
      Step_2min: r.sftData?.stepTest || "",
      Sit_Reach: r.sftData?.sitReach || "",
      Back_Scratch: r.sftData?.backScratch || "",
      Up_And_Go: r.sftData?.upAndGo || "",
      Riesgo_ECNT: r.ecntRisk?.level || "",
      Patologias: r.anamnesis?.pathologies?.join(", ") || "",
      Alerta_Seguridad: r.hasSafetyAlert ? "SÍ" : "NO",
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Evaluaciones_SFT");

    if (format === "xlsx") {
      const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      saveAs(new Blob([buf], { type: "application/octet-stream" }), "evaluaciones_sft.xlsx");
    } else {
      const csv = XLSX.utils.sheet_to_csv(ws);
      saveAs(new Blob([csv], { type: "text/csv;charset=utf-8" }), "evaluaciones_sft.csv");
    }
  };

  // ===== EDIT RECORD =====
  const handleEdit = (record) => {
    setEditingRecord({ ...record });
    setView("edit");
  };

  const handleDeleteRecord = async (id) => {
    if (!window.confirm("¿Está seguro de eliminar este registro?")) return;
    await deleteRecord(id);
  };

  const handleUpdateRecord = async () => {
    if (!editingRecord) return;
    setSaving(true);
    try {
      await updateRecord(editingRecord.id, editingRecord);
      setView("database");
      setEditingRecord(null);
    } catch (err) {
      console.error(err);
      alert("Error al actualizar.");
    }
    setSaving(false);
  };

  // ===== NAVIGATION =====
  const canAdvance = () => {
    if (currentStep === 0) return isConsentValid;
    if (currentStep === 1) return isAnamnesisValid();
    return true;
  };

  const nextStep = () => {
    if (currentStep < STEPS.length - 1) setCurrentStep(currentStep + 1);
  };
  const prevStep = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  // ===== RENDER =====
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* HEADER */}
      <header className="bg-white shadow-md px-4 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Activity className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-slate-800">
                Calculadora Senior Fitness Test
              </h1>
              <p className="text-sm text-slate-500">Observatorio 2026 — Protocolo de Valoración Funcional</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {firebaseEnabled ? (
              <span className="flex items-center gap-1 text-sm text-green-600"><Cloud className="w-4 h-4" /> Nube</span>
            ) : (
              <span className="flex items-center gap-1 text-sm text-slate-400"><CloudOff className="w-4 h-4" /> Local</span>
            )}
            <Button variant="secondary" onClick={() => { setView("form"); resetForm(); }} className="!text-base !px-3 !py-2">
              <FileText className="w-4 h-4 inline mr-1" />Nueva
            </Button>
            <Button variant="secondary" onClick={() => setView("database")} className="!text-base !px-3 !py-2">
              <BarChart3 className="w-4 h-4 inline mr-1" />Base de Datos
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 md:p-6">
        {view === "form" && (
          <>
            {/* STEP INDICATOR */}
            <div className="flex overflow-x-auto gap-1 mb-6 pb-2">
              {STEPS.map((step, i) => {
                const Icon = step.icon;
                const active = i === currentStep;
                const done = i < currentStep;
                return (
                  <button
                    key={step.id}
                    onClick={() => { if (i <= currentStep || canAdvance()) setCurrentStep(i); }}
                    className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all
                      ${active ? "bg-blue-600 text-white shadow" : done ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden sm:inline">{step.label}</span>
                  </button>
                );
              })}
            </div>

            {/* STEP CONTENT */}
            <Card className="mb-6">
              <CardContent>
                {currentStep === 0 && (
                  <ConsentStep
                    consent={consent}
                    setConsent={setConsent}
                    sigCanvas={sigCanvas}
                  />
                )}
                {currentStep === 1 && (
                  <AnamnesisStep
                    anamnesis={anamnesis}
                    setAnamnesis={setAnamnesis}
                    demographics={demographics}
                    setDemographics={setDemographics}
                  />
                )}
                {currentStep === 2 && (
                  <AnthropometryStep
                    anthropometry={anthropometry}
                    setAnthropometry={setAnthropometry}
                    demographics={demographics}
                  />
                )}
                {currentStep === 3 && (
                  <SFTStep sftData={sftData} setSftData={setSftData} demographics={demographics} />
                )}
                {currentStep === 4 && (
                  <SafetyStep safety={safety} setSafety={setSafety} />
                )}
                {currentStep === 5 && (
                  <RiskStep
                    anamnesis={anamnesis}
                    anthropometry={anthropometry}
                    demographics={demographics}
                    sftData={sftData}
                  />
                )}
                {currentStep === 6 && (
                  <ResultsStep
                    consent={consent}
                    demographics={demographics}
                    anamnesis={anamnesis}
                    anthropometry={anthropometry}
                    sftData={sftData}
                    onSave={handleSave}
                    saving={saving}
                    hasSafetyAlert={hasSafetyAlert}
                  />
                )}
              </CardContent>
            </Card>

            {/* NAVIGATION */}
            <div className="flex justify-between">
              <Button variant="secondary" onClick={prevStep} disabled={currentStep === 0}>
                <ChevronLeft className="w-5 h-5 inline" /> Anterior
              </Button>
              {currentStep < STEPS.length - 1 ? (
                <Button onClick={nextStep} disabled={!canAdvance()}>
                  Siguiente <ChevronRight className="w-5 h-5 inline" />
                </Button>
              ) : null}
            </div>
          </>
        )}

        {view === "database" && (
          <DatabaseView
            records={records}
            onEdit={handleEdit}
            onDelete={handleDeleteRecord}
            onExport={exportData}
            onNew={() => { setView("form"); resetForm(); }}
          />
        )}

        {view === "edit" && editingRecord && (
          <EditView
            record={editingRecord}
            setRecord={setEditingRecord}
            onSave={handleUpdateRecord}
            onCancel={() => { setView("database"); setEditingRecord(null); }}
            saving={saving}
          />
        )}
      </main>
    </div>
  );
}

// ============ STEP 1: CONSENTIMIENTO ============
function ConsentStep({ consent, setConsent, sigCanvas }) {
  const clearSignature = () => {
    if (sigCanvas.current) sigCanvas.current.clear();
    setConsent(c => ({ ...c, signed: false }));
  };

  const handleSignEnd = () => {
    if (sigCanvas.current && !sigCanvas.current.isEmpty()) {
      setConsent(c => ({ ...c, signed: true }));
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
        <Shield className="w-7 h-7 text-blue-600" /> Consentimiento Informado
      </h2>

      {/* Consent text */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 max-h-64 overflow-y-auto text-base leading-relaxed text-slate-700">
        <p className="font-semibold mb-2">Documento de Consentimiento Informado</p>
        <p className="mb-2">
          Como parte de los esfuerzos por promover el envejecimiento activo y fortalecer la calidad de vida en nuestra comunidad, le invitamos a participar en una valoración de su capacidad funcional mediante el protocolo Senior Fitness Test (SFT).
        </p>
        <p className="mb-2">
          El propósito de esta evaluación es medir componentes esenciales como su fuerza, flexibilidad, capacidad aeróbica y equilibrio, permitiéndonos orientar con mayor precisión las estrategias y recomendaciones de actividad física que favorezcan su autonomía y bienestar diario.
        </p>
        <p className="mb-2 font-semibold">Consideraciones Éticas y de Seguridad:</p>
        <ul className="list-disc pl-5 space-y-1 mb-2">
          <li><strong>Voluntariedad:</strong> Su participación es totalmente libre y voluntaria. Puede declinar o solicitar la interrupción en cualquier momento.</li>
          <li><strong>Seguridad:</strong> Ante cualquier síntoma de dolor, mareo o fatiga inusual, la evaluación se detendrá de manera inmediata.</li>
          <li><strong>Confidencialidad:</strong> La información será tratada bajo estrictos principios de reserva académica, con fines exclusivamente estadísticos y de investigación.</li>
        </ul>
        <p>
          Confirmo que he recibido una explicación clara y comprensible sobre el propósito y el procedimiento de esta evaluación. Autorizo el uso de mis datos exclusivamente para fines estadísticos y de investigación en el marco de los proyectos de salud y recreación de INDER Medellín y la Universidad de Antioquia.
        </p>
      </div>

      {/* Checkbox */}
      <label className="flex items-center gap-3 cursor-pointer p-3 bg-slate-50 rounded-xl border-2 border-slate-200 hover:border-blue-400 transition-colors">
        <input
          type="checkbox"
          checked={consent.accepted}
          onChange={e => setConsent(c => ({ ...c, accepted: e.target.checked }))}
          className="w-6 h-6 accent-blue-600"
        />
        <span className="text-lg font-medium text-slate-700">Acepto el consentimiento informado</span>
      </label>

      {/* Name & Document */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-base font-medium text-slate-700 mb-1">Nombre completo *</label>
          <input
            type="text"
            value={consent.name}
            onChange={e => setConsent(c => ({ ...c, name: e.target.value }))}
            className="w-full px-4 py-3 text-lg border-2 border-slate-300 rounded-xl focus:border-blue-500 focus:outline-none"
            placeholder="Nombre completo del participante"
          />
        </div>
        <div>
          <label className="block text-base font-medium text-slate-700 mb-1">Documento de identidad *</label>
          <input
            type="text"
            value={consent.document}
            onChange={e => setConsent(c => ({ ...c, document: e.target.value }))}
            className="w-full px-4 py-3 text-lg border-2 border-slate-300 rounded-xl focus:border-blue-500 focus:outline-none"
            placeholder="Número de documento"
          />
        </div>
      </div>

      {/* Signature */}
      <div>
        <label className="block text-base font-medium text-slate-700 mb-2">Firma del participante (Digital) *</label>
        <div className="border-2 border-slate-300 rounded-xl overflow-hidden bg-white">
          <SignatureCanvas
            ref={sigCanvas}
            canvasProps={{ className: "w-full h-40 md:h-48" }}
            onEnd={handleSignEnd}
          />
        </div>
        <div className="flex items-center gap-4 mt-2">
          <Button variant="secondary" onClick={clearSignature} className="!text-sm !px-3 !py-2">
            Limpiar firma
          </Button>
          {consent.signed && (
            <span className="flex items-center gap-1 text-green-600 text-sm font-medium">
              <CheckCircle2 className="w-4 h-4" /> Firma registrada
            </span>
          )}
        </div>
      </div>

      {/* Validation message */}
      {!isConsentValid(consent) && (
        <div className="bg-yellow-50 border border-yellow-300 rounded-xl p-3 text-yellow-800 text-base">
          <AlertTriangle className="w-5 h-5 inline mr-2" />
          Debe aceptar el consentimiento, escribir su nombre y documento, y firmar para continuar.
        </div>
      )}
    </div>
  );
}

function isConsentValid(consent) {
  return consent.accepted && consent.name.trim() && consent.document.trim() && consent.signed;
}

// ============ STEP 2: ANAMNESIS ============
function AnamnesisStep({ anamnesis, setAnamnesis, demographics, setDemographics }) {
  const togglePathology = (id) => {
    setAnamnesis(a => ({
      ...a,
      pathologies: { ...a.pathologies, [id]: !a.pathologies[id] },
    }));
  };

  const setMedication = (id, value) => {
    setAnamnesis(a => ({
      ...a,
      medications: { ...a.medications, [id]: value },
    }));
  };

  const selectedPaths = Object.entries(anamnesis.pathologies).filter(([, v]) => v);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
        <ClipboardList className="w-7 h-7 text-blue-600" /> Anamnesis — Datos del Participante
      </h2>

      {/* Demographics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl">
        <div>
          <label className="block text-base font-medium text-slate-700 mb-1">Edad *</label>
          <input
            type="number"
            min="60" max="100"
            value={demographics.age}
            onChange={e => setDemographics(d => ({ ...d, age: e.target.value }))}
            className="w-full px-4 py-3 text-lg border-2 border-slate-300 rounded-xl focus:border-blue-500 focus:outline-none"
            placeholder="Ej: 68"
          />
        </div>
        <div>
          <label className="block text-base font-medium text-slate-700 mb-1">Sexo *</label>
          <select
            value={demographics.sex}
            onChange={e => setDemographics(d => ({ ...d, sex: e.target.value }))}
            className="w-full px-4 py-3 text-lg border-2 border-slate-300 rounded-xl focus:border-blue-500 focus:outline-none bg-white"
          >
            <option value="">Seleccionar...</option>
            <option value="Masculino">Masculino</option>
            <option value="Femenino">Femenino</option>
          </select>
        </div>
        <div>
          <label className="block text-base font-medium text-slate-700 mb-1">Sede / Comuna</label>
          <input
            type="text"
            value={demographics.sede}
            onChange={e => setDemographics(d => ({ ...d, sede: e.target.value }))}
            className="w-full px-4 py-3 text-lg border-2 border-slate-300 rounded-xl focus:border-blue-500 focus:outline-none"
            placeholder="Ej: Comuna 10"
          />
        </div>
        <div>
          <label className="block text-base font-medium text-slate-700 mb-1">Grupo / Código</label>
          <input
            type="text"
            value={demographics.grupo}
            onChange={e => setDemographics(d => ({ ...d, grupo: e.target.value }))}
            className="w-full px-4 py-3 text-lg border-2 border-slate-300 rounded-xl focus:border-blue-500 focus:outline-none"
            placeholder="Código de grupo"
          />
        </div>
      </div>

      {/* Pathologies */}
      <div>
        <h3 className="text-lg font-semibold text-slate-700 mb-3">Selección de Patologías</h3>
        <p className="text-sm text-slate-500 mb-3">
          Si selecciona una patología, el campo de medicamento es obligatorio.
        </p>
        <div className="space-y-3">
          {PATHOLOGIES.map(path => (
            <div key={path.id} className={`p-3 rounded-xl border-2 transition-colors ${
              anamnesis.pathologies[path.id] ? "border-blue-400 bg-blue-50" : "border-slate-200 bg-white"
            }`}>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!anamnesis.pathologies[path.id]}
                  onChange={() => togglePathology(path.id)}
                  className="w-5 h-5 accent-blue-600"
                />
                <span className="text-base font-medium text-slate-700">{path.label}</span>
              </label>

              {anamnesis.pathologies[path.id] && path.id !== "otra" && (
                <div className="mt-2 ml-8">
                  <input
                    type="text"
                    value={anamnesis.medications[path.id] || ""}
                    onChange={e => setMedication(path.id, e.target.value)}
                    className="w-full px-3 py-2 text-base border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none"
                    placeholder="Detalle de medicamentos (obligatorio)"
                  />
                  {!anamnesis.medications[path.id]?.trim() && (
                    <p className="text-red-500 text-sm mt-1">* Medicamento obligatorio</p>
                  )}
                </div>
              )}

              {anamnesis.pathologies[path.id] && path.id === "otra" && (
                <div className="mt-2 ml-8 space-y-2">
                  <input
                    type="text"
                    value={anamnesis.otherName}
                    onChange={e => setAnamnesis(a => ({ ...a, otherName: e.target.value }))}
                    className="w-full px-3 py-2 text-base border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none"
                    placeholder="¿Cuál patología? (obligatorio)"
                  />
                  {!anamnesis.otherName.trim() && (
                    <p className="text-red-500 text-sm">* Especifique la patología</p>
                  )}
                  <input
                    type="text"
                    value={anamnesis.otherMed}
                    onChange={e => setAnamnesis(a => ({ ...a, otherMed: e.target.value }))}
                    className="w-full px-3 py-2 text-base border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none"
                    placeholder="¿Qué medicamento toma? (obligatorio)"
                  />
                  {!anamnesis.otherMed.trim() && (
                    <p className="text-red-500 text-sm">* Especifique el medicamento</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {selectedPaths.length > 0 && !isAnamnesisStepValid(anamnesis) && (
        <div className="bg-red-50 border border-red-300 rounded-xl p-3 text-red-700 text-base">
          <XCircle className="w-5 h-5 inline mr-2" />
          Debe completar el campo de medicamentos para cada patología seleccionada.
        </div>
      )}
    </div>
  );
}

function isAnamnesisStepValid(anamnesis) {
  const selected = Object.entries(anamnesis.pathologies).filter(([, v]) => v);
  for (const [key] of selected) {
    if (key === "otra") {
      if (!anamnesis.otherName.trim() || !anamnesis.otherMed.trim()) return false;
    } else {
      if (!anamnesis.medications[key]?.trim()) return false;
    }
  }
  return true;
}

// ============ STEP 3: ANTHROPOMETRY ============
function AnthropometryStep({ anthropometry, setAnthropometry, demographics }) {
  const imc = calculateIMC(anthropometry.weight, anthropometry.height);
  const imcData = classifyIMC(imc);
  const waist = waistRisk(anthropometry.waist, demographics.sex);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
        <UserRound className="w-7 h-7 text-blue-600" /> Pruebas Antropométricas
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-base font-medium text-slate-700 mb-1">Peso (kg)</label>
          <input
            type="number" step="0.1"
            value={anthropometry.weight}
            onChange={e => setAnthropometry(a => ({ ...a, weight: e.target.value }))}
            className="w-full px-4 py-3 text-lg border-2 border-slate-300 rounded-xl focus:border-blue-500 focus:outline-none"
            placeholder="Ej: 72.5"
          />
        </div>
        <div>
          <label className="block text-base font-medium text-slate-700 mb-1">Talla (cm)</label>
          <input
            type="number" step="0.1"
            value={anthropometry.height}
            onChange={e => setAnthropometry(a => ({ ...a, height: e.target.value }))}
            className="w-full px-4 py-3 text-lg border-2 border-slate-300 rounded-xl focus:border-blue-500 focus:outline-none"
            placeholder="Ej: 165"
          />
        </div>
        <div>
          <label className="block text-base font-medium text-slate-700 mb-1">Perímetro de cintura (cm)</label>
          <input
            type="number" step="0.1"
            value={anthropometry.waist}
            onChange={e => setAnthropometry(a => ({ ...a, waist: e.target.value }))}
            className="w-full px-4 py-3 text-lg border-2 border-slate-300 rounded-xl focus:border-blue-500 focus:outline-none"
            placeholder="Ej: 88.5"
          />
        </div>
        <div>
          <label className="block text-base font-medium text-slate-700 mb-1">Perímetro de pantorrilla (cm)</label>
          <input
            type="number" step="0.1"
            value={anthropometry.calf}
            onChange={e => setAnthropometry(a => ({ ...a, calf: e.target.value }))}
            className="w-full px-4 py-3 text-lg border-2 border-slate-300 rounded-xl focus:border-blue-500 focus:outline-none"
            placeholder="Ej: 34.0"
          />
        </div>
      </div>

      {/* IMC Result */}
      {imc && (
        <div className="bg-slate-50 p-4 rounded-xl border">
          <h3 className="text-lg font-semibold text-slate-700 mb-2">Índice de Masa Corporal (IMC)</h3>
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-3xl font-bold text-slate-800">{imc.toFixed(1)}</span>
            <span className={`text-lg font-semibold ${imcData?.color}`}>{imcData?.label}</span>
            <span className="text-sm text-slate-500">Riesgo: {imcData?.risk}</span>
          </div>
          <p className="text-sm text-slate-500 mt-1">OMS: Normal 18.5-24.9 | Sobrepeso 25-29.9 | Obesidad ≥30</p>
        </div>
      )}

      {/* Waist Risk */}
      {waist && (
        <div className="bg-slate-50 p-4 rounded-xl border">
          <h3 className="text-lg font-semibold text-slate-700 mb-1">Riesgo por Perímetro de Cintura</h3>
          <p className={`text-lg font-semibold ${waist.color}`}>
            {waist.risk} {demographics.sex === "Masculino" ? "(Límite: 90 cm)" : "(Límite: 80 cm)"}
          </p>
        </div>
      )}
    </div>
  );
}

// ============ STEP 4: SENIOR FITNESS TEST ============
function SFTStep({ sftData, setSftData, demographics }) {
  const tests = [
    { id: "chairStand", name: "Sentarse y levantarse de una silla", desc: "Repeticiones en 30 segundos", unit: "rep", placeholder: "Ej: 14" },
    { id: "armCurl", name: "Flexiones del brazo (Arm Curl)", desc: "Repeticiones en 30 seg. Mujeres: 5 lb / Hombres: 8 lb", unit: "rep", placeholder: "Ej: 16" },
    { id: "walkTest", name: "Caminar 6 minutos (6-Min Walk)", desc: "Distancia total en yardas", unit: "yardas", placeholder: "Ej: 580" },
    { id: "stepTest", name: "2 Minutos Marcha (2-Min Step)", desc: "Total de pasos completos en 2 minutos", unit: "pasos", placeholder: "Ej: 85" },
    { id: "sitReach", name: "Flexión del tronco en silla (Sit & Reach)", desc: "Distancia en cm (+/-) desde la punta del zapato", unit: "cm", placeholder: "Ej: +3.5 o -2.0" },
    { id: "backScratch", name: "Alcanzar manos tras la espalda (Back Scratch)", desc: "Distancia en cm (+/-) entre dedos medios", unit: "cm", placeholder: "Ej: -5.0 o +1.5" },
    { id: "upAndGo", name: "Levantarse, caminar y sentarse (8-Foot Up & Go)", desc: "Tiempo en segundos (menor es mejor)", unit: "seg", placeholder: "Ej: 5.8" },
  ];

  const sftResults = evaluateSFT(sftData, demographics.sex, demographics.age);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
        <Activity className="w-7 h-7 text-blue-600" /> Protocolo Senior Fitness Test (SFT)
      </h2>

      {demographics.age && demographics.sex && (
        <div className="bg-blue-50 p-3 rounded-xl text-sm text-blue-800">
          Baremos aplicados: {demographics.sex} — Grupo de edad: {getAgeGroup(Number(demographics.age)) || "No aplica"}
        </div>
      )}

      <div className="space-y-4">
        {tests.map(test => {
          return (
            <div key={test.id} className="p-4 bg-slate-50 rounded-xl border">
              <label className="block text-base font-semibold text-slate-700 mb-1">{test.name}</label>
              <p className="text-sm text-slate-500 mb-2">{test.desc}</p>
              <div className="flex items-center gap-3">
                <input
                  type="number" step="0.1"
                  value={sftData[test.id]}
                  onChange={e => setSftData(d => ({ ...d, [test.id]: e.target.value }))}
                  className="flex-1 px-4 py-3 text-lg border-2 border-slate-300 rounded-xl focus:border-blue-500 focus:outline-none"
                  placeholder={test.placeholder}
                />
                <span className="text-sm text-slate-500 font-medium">{test.unit}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Results Preview */}
      {sftResults.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold text-slate-700 mb-3">Clasificación Preliminar</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {sftResults.map((r, i) => (
              <div key={i} className={`flex items-center justify-between p-3 rounded-lg border ${
                r.classification === "above" ? "bg-green-50 border-green-300" :
                r.classification === "normal" ? "bg-blue-50 border-blue-300" :
                r.classification === "below" ? "bg-red-50 border-red-300" :
                "bg-slate-50 border-slate-200"
              }`}>
                <span className="text-sm font-medium">{r.test}</span>
                <span className={`text-sm font-bold ${
                  r.classification === "above" ? "text-green-700" :
                  r.classification === "normal" ? "text-blue-700" :
                  r.classification === "below" ? "text-red-700" : "text-slate-500"
                }`}>
                  {r.value} {r.unit} — {
                    r.classification === "above" ? "Superior" :
                    r.classification === "normal" ? "Normal" :
                    r.classification === "below" ? "Por debajo" : "—"
                  }
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============ STEP 5: SAFETY ============
function SafetyStep({ safety, setSafety }) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
        <AlertTriangle className="w-7 h-7 text-orange-500" /> Validaciones de Seguridad
      </h2>

      <div className="bg-orange-50 border border-orange-300 rounded-xl p-4 text-orange-800">
        <p className="font-semibold mb-2">Importante:</p>
        <p>Si el participante presenta alguno de los siguientes síntomas durante la evaluación, la sesión debe detenerse inmediatamente.</p>
      </div>

      <div className="space-y-3">
        <label className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors ${
          safety.pain ? "border-red-400 bg-red-50" : "border-slate-200 bg-white hover:border-slate-300"
        }`}>
          <input
            type="checkbox"
            checked={safety.pain}
            onChange={e => setSafety(s => ({ ...s, pain: e.target.checked }))}
            className="w-6 h-6 accent-red-600"
          />
          <div>
            <span className="text-lg font-medium text-slate-700">Dolor</span>
            <p className="text-sm text-slate-500">Dolor de cualquier clase, entumecimiento, dolor torácico</p>
          </div>
        </label>

        <label className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors ${
          safety.dizziness ? "border-red-400 bg-red-50" : "border-slate-200 bg-white hover:border-slate-300"
        }`}>
          <input
            type="checkbox"
            checked={safety.dizziness}
            onChange={e => setSafety(s => ({ ...s, dizziness: e.target.checked }))}
            className="w-6 h-6 accent-red-600"
          />
          <div>
            <span className="text-lg font-medium text-slate-700">Mareo / Vértigo</span>
            <p className="text-sm text-slate-500">Vértigo, confusión, desorientación, visión velada</p>
          </div>
        </label>

        <label className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors ${
          safety.fatigue ? "border-red-400 bg-red-50" : "border-slate-200 bg-white hover:border-slate-300"
        }`}>
          <input
            type="checkbox"
            checked={safety.fatigue}
            onChange={e => setSafety(s => ({ ...s, fatigue: e.target.checked }))}
            className="w-6 h-6 accent-red-600"
          />
          <div>
            <span className="text-lg font-medium text-slate-700">Fatiga Inusual</span>
            <p className="text-sm text-slate-500">Dificultad para respirar, latidos irregulares, náuseas, pérdida de control muscular</p>
          </div>
        </label>
      </div>

      <div>
        <label className="block text-base font-medium text-slate-700 mb-1">Observaciones de seguridad</label>
        <textarea
          value={safety.notes}
          onChange={e => setSafety(s => ({ ...s, notes: e.target.value }))}
          className="w-full px-4 py-3 text-base border-2 border-slate-300 rounded-xl focus:border-blue-500 focus:outline-none"
          rows={3}
          placeholder="Observaciones adicionales sobre la seguridad del participante..."
        />
      </div>

      {(safety.pain || safety.dizziness || safety.fatigue) && (
        <div className="bg-red-100 border-2 border-red-400 rounded-xl p-4 text-red-800">
          <p className="font-bold text-lg flex items-center gap-2">
            <AlertTriangle className="w-6 h-6" /> ALERTA DE SEGURIDAD
          </p>
          <p className="mt-1">Se ha detectado un síntoma de riesgo. La evaluación debe ser suspendida o adaptada según criterio del evaluador.</p>
        </div>
      )}
    </div>
  );
}

// ============ STEP 6: ECNT RISK ============
function RiskStep({ anamnesis, anthropometry, demographics, sftData }) {
  const imc = calculateIMC(anthropometry.weight, anthropometry.height);
  const selectedPaths = Object.entries(anamnesis.pathologies).filter(([, v]) => v).map(([k]) => k);
  const sftResults = evaluateSFT(sftData, demographics.sex, demographics.age);
  const risk = calculateECNTRisk(selectedPaths, imc, anthropometry.waist, demographics.sex, sftResults);
  const recommendations = getPathologyRecommendations(selectedPaths);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
        <HeartPulse className="w-7 h-7 text-red-500" /> Evaluación de Riesgo ECNT
      </h2>

      {/* Risk Level */}
      <div className={`p-6 rounded-2xl text-white ${risk.color}`}>
        <p className="text-sm uppercase font-medium opacity-90">Nivel de Riesgo</p>
        <p className="text-4xl font-bold mt-1">{risk.level}</p>
        <p className="mt-2 text-base opacity-90">Puntaje: {risk.score} puntos</p>
      </div>

      {/* Risk Factors */}
      {risk.factors.length > 0 && (
        <div className="bg-slate-50 p-4 rounded-xl border">
          <h3 className="text-lg font-semibold text-slate-700 mb-2">Factores de Riesgo Identificados</h3>
          <ul className="space-y-1">
            {risk.factors.map((f, i) => (
              <li key={i} className="flex items-center gap-2 text-base text-slate-700">
                <span className="w-2 h-2 rounded-full bg-red-400"></span>
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommendation */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <h3 className="text-lg font-semibold text-blue-800 mb-1">Recomendación General</h3>
        <p className="text-base text-blue-700">{risk.recommendation}</p>
      </div>

      {/* Specific Recommendations */}
      {recommendations.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-slate-700">Recomendaciones por Patología</h3>
          {recommendations.map((rec, i) => (
            <div key={i} className="bg-white p-4 rounded-xl border">
              <h4 className="font-bold text-slate-800">{rec.pathology}</h4>
              <p className="text-sm text-red-600 mt-1"><strong>Precauciones:</strong> {rec.precautions}</p>
              <p className="text-sm text-green-700 mt-1"><strong>Recomendado:</strong> {rec.recommended}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ STEP 7: RESULTS ============
function ResultsStep({ consent, demographics, anamnesis, anthropometry, sftData, onSave, saving, hasSafetyAlert }) {
  const imc = calculateIMC(anthropometry.weight, anthropometry.height);
  const imcData = classifyIMC(imc);
  const sftResults = evaluateSFT(sftData, demographics.sex, demographics.age);
  const selectedPaths = Object.entries(anamnesis.pathologies).filter(([, v]) => v).map(([k]) => k);
  const risk = calculateECNTRisk(selectedPaths, imc, anthropometry.waist, demographics.sex, sftResults);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
        <BarChart3 className="w-7 h-7 text-blue-600" /> Resumen de Resultados
      </h2>

      {/* Participant info */}
      <div className="bg-slate-50 p-4 rounded-xl border">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div><strong>Nombre:</strong> {consent.name}</div>
          <div><strong>Documento:</strong> {consent.document}</div>
          <div><strong>Edad:</strong> {demographics.age} años</div>
          <div><strong>Sexo:</strong> {demographics.sex}</div>
        </div>
      </div>

      {/* IMC */}
      {imc && (
        <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-xl border">
          <span className="font-semibold">IMC:</span>
          <span className="text-2xl font-bold">{imc.toFixed(1)}</span>
          <span className={`font-semibold ${imcData?.color}`}>{imcData?.label}</span>
        </div>
      )}

      {/* SFT Results */}
      {sftResults.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-slate-700 mb-2">Resultados SFT</h3>
          <div className="space-y-2">
            {sftResults.map((r, i) => (
              <div key={i} className={`flex items-center justify-between p-3 rounded-lg border ${
                r.classification === "above" ? "bg-green-50 border-green-300" :
                r.classification === "normal" ? "bg-blue-50 border-blue-300" :
                r.classification === "below" ? "bg-red-50 border-red-300" :
                "bg-slate-50 border-slate-200"
              }`}>
                <span className="font-medium text-sm">{r.test}</span>
                <span className="font-bold text-sm">
                  {r.value} {r.unit} — {
                    r.classification === "above" ? "SUPERIOR" :
                    r.classification === "normal" ? "NORMAL" :
                    r.classification === "below" ? "POR DEBAJO" : "—"
                  }
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Risk Summary */}
      <div className={`p-4 rounded-xl text-white ${risk.color}`}>
        <span className="text-sm uppercase">Riesgo ECNT:</span>
        <span className="text-2xl font-bold ml-3">{risk.level}</span>
      </div>

      {/* Safety Alert */}
      {hasSafetyAlert && (
        <div className="bg-red-100 border-2 border-red-400 rounded-xl p-3 text-red-800 font-semibold">
          <AlertTriangle className="w-5 h-5 inline mr-2" />
          Se registraron alertas de seguridad durante la evaluación.
        </div>
      )}

      {/* Save Button */}
      <div className="flex justify-center pt-4">
        <Button variant="success" onClick={onSave} disabled={saving} className="!text-xl !px-8 !py-4">
          {saving ? <Loader2 className="w-6 h-6 animate-spin inline mr-2" /> : <Save className="w-6 h-6 inline mr-2" />}
          Guardar Evaluación
        </Button>
      </div>
    </div>
  );
}

// ============ DATABASE VIEW ============
function DatabaseView({ records, onEdit, onDelete, onExport, onNew }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold text-slate-800">Base de Datos — Evaluaciones SFT</h2>
        <div className="flex gap-2 flex-wrap">
          <Button variant="success" onClick={onNew} className="!text-base !px-3 !py-2">
            + Nueva Evaluación
          </Button>
          <Button variant="secondary" onClick={() => onExport("csv")} className="!text-base !px-3 !py-2">
            <Download className="w-4 h-4 inline mr-1" /> CSV
          </Button>
          <Button variant="secondary" onClick={() => onExport("xlsx")} className="!text-base !px-3 !py-2">
            <Download className="w-4 h-4 inline mr-1" /> XLSX
          </Button>
        </div>
      </div>

      {records.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12 text-slate-500">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-lg">No hay evaluaciones registradas.</p>
            <p>Realice una nueva evaluación para comenzar.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {records.sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || "")).map(record => (
            <Card key={record.id}>
              <CardContent className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <p className="font-bold text-lg text-slate-800">{record.consent?.name || "Sin nombre"}</p>
                  <p className="text-sm text-slate-500">
                    Doc: {record.consent?.document} | {record.demographics?.age} años | {record.demographics?.sex}
                    {record.timestamp && ` | ${new Date(record.timestamp).toLocaleDateString("es-CO")}`}
                  </p>
                  <div className="flex gap-2 mt-1 flex-wrap">
                    {record.imcClass && (
                      <span className="text-xs bg-slate-100 px-2 py-0.5 rounded">IMC: {record.imc} ({record.imcClass})</span>
                    )}
                    {record.ecntRisk && (
                      <span className={`text-xs text-white px-2 py-0.5 rounded ${
                        record.ecntRisk.level === "Muy Alto" || record.ecntRisk.level === "Alto" ? "bg-red-500" :
                        record.ecntRisk.level === "Moderado" ? "bg-orange-500" :
                        record.ecntRisk.level === "Bajo" ? "bg-yellow-500" : "bg-green-500"
                      }`}>
                        Riesgo: {record.ecntRisk.level}
                      </span>
                    )}
                    {record.hasSafetyAlert && (
                      <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">Alerta Seguridad</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => onEdit(record)} className="!text-sm !px-3 !py-2">
                    <Edit3 className="w-4 h-4" />
                  </Button>
                  <Button variant="danger" onClick={() => onDelete(record.id)} className="!text-sm !px-3 !py-2">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <p className="text-center text-sm text-slate-400">
        Total: {records.length} evaluaciones
      </p>
    </div>
  );
}

// ============ EDIT VIEW ============
function EditView({ record, setRecord, onSave, onCancel, saving }) {
  const updateField = (path, value) => {
    setRecord(r => {
      const copy = { ...r };
      const keys = path.split(".");
      let ref = copy;
      for (let i = 0; i < keys.length - 1; i++) {
        ref[keys[i]] = { ...ref[keys[i]] };
        ref = ref[keys[i]];
      }
      ref[keys[keys.length - 1]] = value;
      return copy;
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800">Editar Registro</h2>
        <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
      </div>

      <Card>
        <CardContent className="space-y-4">
          <h3 className="font-semibold text-lg">Datos del Participante</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Nombre</label>
              <input
                type="text"
                value={record.consent?.name || ""}
                onChange={e => updateField("consent.name", e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Documento</label>
              <input
                type="text"
                value={record.consent?.document || ""}
                onChange={e => updateField("consent.document", e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Edad</label>
              <input
                type="number"
                value={record.demographics?.age || ""}
                onChange={e => updateField("demographics.age", e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Sexo</label>
              <select
                value={record.demographics?.sex || ""}
                onChange={e => updateField("demographics.sex", e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="">Seleccionar</option>
                <option value="Masculino">Masculino</option>
                <option value="Femenino">Femenino</option>
              </select>
            </div>
          </div>

          <h3 className="font-semibold text-lg mt-4">Antropometría</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Peso (kg)</label>
              <input
                type="number" step="0.1"
                value={record.anthropometry?.weight || ""}
                onChange={e => updateField("anthropometry.weight", e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Talla (cm)</label>
              <input
                type="number" step="0.1"
                value={record.anthropometry?.height || ""}
                onChange={e => updateField("anthropometry.height", e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">P. Cintura (cm)</label>
              <input
                type="number" step="0.1"
                value={record.anthropometry?.waist || ""}
                onChange={e => updateField("anthropometry.waist", e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">P. Pantorrilla (cm)</label>
              <input
                type="number" step="0.1"
                value={record.anthropometry?.calf || ""}
                onChange={e => updateField("anthropometry.calf", e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
          </div>

          <h3 className="font-semibold text-lg mt-4">Datos SFT</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { key: "chairStand", label: "Chair Stand" },
              { key: "armCurl", label: "Arm Curl" },
              { key: "walkTest", label: "Walk 6min" },
              { key: "stepTest", label: "Step 2min" },
              { key: "sitReach", label: "Sit & Reach" },
              { key: "backScratch", label: "Back Scratch" },
              { key: "upAndGo", label: "Up & Go" },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-sm font-medium mb-1">{f.label}</label>
                <input
                  type="number" step="0.1"
                  value={record.sftData?.[f.key] || ""}
                  onChange={e => {
                    const newSft = { ...(record.sftData || {}), [f.key]: e.target.value };
                    setRecord(r => ({ ...r, sftData: newSft }));
                  }}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button variant="success" onClick={onSave} disabled={saving}>
          {saving ? <Loader2 className="w-5 h-5 animate-spin inline mr-2" /> : <Save className="w-5 h-5 inline mr-2" />}
          Guardar Cambios
        </Button>
      </div>
    </div>
  );
}
