import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  ShieldCheck,
  ClipboardList,
  Activity,
  AlertTriangle,
  HeartPulse,
  Download,
  Cloud,
  CloudOff,
  Loader2,
  Pencil,
  Trash2,
} from "lucide-react";
import { subscribeRecords, addRecord, updateRecord, deleteRecord, firebaseEnabled } from "./sftDataStore";
import { SFT_TESTS, evaluateSFT } from "./sftBaremos";
import { getIMCData } from "./icfg";

// === UI Components ===
const Card = ({ children, className = "" }) => (
  <div className={`rounded-2xl border bg-white shadow-sm ${className}`}>{children}</div>
);
const CardContent = ({ children, className = "" }) => (
  <div className={`p-5 ${className}`}>{children}</div>
);
const Button = ({ children, onClick, variant = "primary", className = "", disabled = false, type = "button" }) => {
  const styles =
    variant === "secondary"
      ? "bg-slate-100 text-slate-800 hover:bg-slate-200"
      : variant === "danger"
      ? "bg-red-600 text-white hover:bg-red-700"
      : variant === "success"
      ? "bg-emerald-600 text-white hover:bg-emerald-700"
      : "bg-teal-600 text-white hover:bg-teal-700";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${styles} ${disabled ? "opacity-50 cursor-not-allowed" : ""} ${className}`}
    >
      {children}
    </button>
  );
};

// === PATOLOGIAS DISPONIBLES ===
const PATHOLOGIES = [
  "Artrosis",
  "Hipertension",
  "Diabetes tipo 2",
  "Hipoglucemia",
  "Osteoporosis",
  "Enfermedad cardiovascular",
  "Enfermedad respiratoria cronica",
  "Obesidad",
  "Sedentarismo",
];

// === SAFETY SIGNS ===
const SAFETY_SIGNS = [
  "Dolor inusual",
  "Mareo o vertigo",
  "Fatiga inusual o dificultad para respirar",
  "Dolor en el pecho",
  "Latidos irregulares del corazon",
  "Nauseas o vomitos",
  "Entumecimiento",
  "Perdida de control muscular/equilibrio",
  "Confusion o desorientacion",
  "Vision velada",
];

// === CONSENTIMIENTO INFORMADO ===
function ConsentimientoStep({ data, setData, onNext }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSigned, setHasSigned] = useState(false);

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setHasSigned(false);
      setData((prev) => ({ ...prev, firma: "" }));
    }
  };

  const getCoords = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if (e.touches) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDraw = (e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const { x, y } = getCoords(e, canvas);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const { x, y } = getCoords(e, canvas);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#1e293b";
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSigned(true);
  };

  const endDraw = () => {
    if (isDrawing) {
      setIsDrawing(false);
      const canvas = canvasRef.current;
      setData((prev) => ({ ...prev, firma: canvas.toDataURL() }));
    }
  };

  const canContinue = data.acepta && data.nombreCompleto.trim() && data.documento.trim() && hasSigned;

  return (
    <Card className="border-teal-200">
      <CardContent>
        <h2 className="text-2xl font-black text-teal-800 mb-4 flex items-center gap-2">
          <ShieldCheck size={28} /> Consentimiento Informado
        </h2>

        <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 mb-6 text-sm text-slate-700 leading-relaxed max-h-64 overflow-y-auto">
          <p className="font-bold text-teal-900 mb-2">Observatorio 2026 - INDER Medellin</p>
          <p className="mb-2">
            Como parte de los esfuerzos por promover el envejecimiento activo y fortalecer la calidad de vida en nuestra comunidad, le invitamos a participar en una valoracion de su capacidad funcional mediante el protocolo Senior Fitness Test (SFT).
          </p>
          <p className="mb-2">
            El proposito de esta evaluacion es medir componentes esenciales como su fuerza, flexibilidad, capacidad aerobica y equilibrio, permitiendonos orientar con mayor precision las estrategias y recomendaciones de actividad fisica.
          </p>
          <p className="font-bold mt-3 mb-1">Consideraciones Eticas y de Seguridad:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Voluntariedad:</strong> Su participacion es totalmente libre y voluntaria. Usted tiene derecho de declinar o solicitar la interrupcion de las pruebas en cualquier momento.</li>
            <li><strong>Seguridad:</strong> Ante cualquier sintoma de dolor, mareo o fatiga inusual, la evaluacion se detendra de manera inmediata.</li>
            <li><strong>Confidencialidad:</strong> La informacion sera tratada bajo estrictos principios de reserva academica con fines exclusivamente estadisticos y de investigacion.</li>
          </ul>
          <p className="mt-3">
            Confirmo que he recibido una explicacion clara y comprensible sobre el proposito y el procedimiento de esta evaluacion. Entiendo que se me realizara una entrevista de salud y una serie de pruebas fisicas adaptadas. Autorizo el uso de mis datos exclusivamente para fines estadisticos y de investigacion.
          </p>
        </div>

        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer bg-amber-50 border border-amber-200 rounded-xl p-4">
            <input
              type="checkbox"
              checked={data.acepta}
              onChange={(e) => setData((prev) => ({ ...prev, acepta: e.target.checked }))}
              className="w-5 h-5 accent-teal-600"
            />
            <span className="font-bold text-amber-900 text-base">Acepto el consentimiento informado</span>
          </label>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Nombre completo del participante</label>
              <input
                className="w-full rounded-xl border p-3 text-lg focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
                placeholder="Nombre completo"
                value={data.nombreCompleto}
                onChange={(e) => setData((prev) => ({ ...prev, nombreCompleto: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Documento de identidad</label>
              <input
                className="w-full rounded-xl border p-3 text-lg focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
                placeholder="Numero de documento"
                value={data.documento}
                onChange={(e) => setData((prev) => ({ ...prev, documento: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Firma digital (use el mouse, dedo o lapiz tactil)</label>
            <div className="border-2 border-dashed border-slate-300 rounded-xl overflow-hidden bg-white">
              <canvas
                ref={canvasRef}
                width={600}
                height={150}
                className="w-full cursor-crosshair touch-none"
                onMouseDown={startDraw}
                onMouseMove={draw}
                onMouseUp={endDraw}
                onMouseLeave={endDraw}
                onTouchStart={startDraw}
                onTouchMove={draw}
                onTouchEnd={endDraw}
              />
            </div>
            <button
              onClick={clearSignature}
              className="mt-2 text-sm text-red-600 font-bold hover:underline"
            >
              Limpiar firma
            </button>
          </div>
        </div>

        {!canContinue && (
          <p className="mt-4 text-sm text-orange-700 bg-orange-50 border border-orange-200 rounded-lg p-3 font-medium">
            Debe aceptar el consentimiento, escribir su nombre, documento y firmar para continuar.
          </p>
        )}

        <div className="mt-6 flex justify-end">
          <Button onClick={onNext} disabled={!canContinue} className="text-base px-6 py-3">
            Continuar a Anamnesis
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// === ANAMNESIS ===
function AnamnesisStep({ data, setData, onNext, onBack }) {
  const addPathology = (name) => {
    setData((prev) => {
      const existing = prev.patologias.find((p) => p.nombre === name);
      if (existing) {
        return { ...prev, patologias: prev.patologias.filter((p) => p.nombre !== name) };
      }
      return { ...prev, patologias: [...prev.patologias, { nombre: name, medicamento: "" }] };
    });
  };

  const updateMedicamento = (name, medicamento) => {
    setData((prev) => ({
      ...prev,
      patologias: prev.patologias.map((p) => (p.nombre === name ? { ...p, medicamento } : p)),
    }));
  };

  const hasOtra = data.patologias.some((p) => p.nombre === "Otra");

  const isValid = () => {
    for (const p of data.patologias) {
      if (!p.medicamento.trim()) return false;
      if (p.nombre === "Otra" && !data.otraCual.trim()) return false;
    }
    return true;
  };

  return (
    <Card className="border-teal-200">
      <CardContent>
        <h2 className="text-2xl font-black text-teal-800 mb-2 flex items-center gap-2">
          <ClipboardList size={28} /> Anamnesis - Historial de Salud
        </h2>
        <p className="text-sm text-slate-600 mb-6">
          Seleccione las patologias que presenta. Si marca una condicion, es <strong>obligatorio</strong> indicar el medicamento.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Edad (anos)</label>
            <input
              type="number"
              min="60"
              max="94"
              className="w-full rounded-xl border p-3 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
              placeholder="Ej: 68"
              value={data.edad}
              onChange={(e) => setData((prev) => ({ ...prev, edad: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Sexo</label>
            <select
              className="w-full rounded-xl border p-3 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
              value={data.sexo}
              onChange={(e) => setData((prev) => ({ ...prev, sexo: e.target.value }))}
            >
              <option value="">Seleccionar</option>
              <option value="Mujer">Mujer</option>
              <option value="Hombre">Hombre</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Peso (kg)</label>
            <input
              type="number"
              step="0.1"
              className="w-full rounded-xl border p-3 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
              placeholder="Ej: 72.5"
              value={data.peso}
              onChange={(e) => setData((prev) => ({ ...prev, peso: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Talla (cm)</label>
            <input
              type="number"
              step="1"
              className="w-full rounded-xl border p-3 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
              placeholder="Ej: 165"
              value={data.talla}
              onChange={(e) => setData((prev) => ({ ...prev, talla: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Perimetro abdominal (cm)</label>
            <input
              type="number"
              step="0.1"
              className="w-full rounded-xl border p-3 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
              placeholder="Ej: 92"
              value={data.perimetroAbdominal}
              onChange={(e) => setData((prev) => ({ ...prev, perimetroAbdominal: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Perimetro de pantorrilla (cm)</label>
            <input
              type="number"
              step="0.1"
              className="w-full rounded-xl border p-3 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
              placeholder="Ej: 34"
              value={data.perimetroPantorrilla}
              onChange={(e) => setData((prev) => ({ ...prev, perimetroPantorrilla: e.target.value }))}
            />
          </div>
        </div>

        <h3 className="font-bold text-slate-800 mb-3 text-lg">Patologias y Medicamentos</h3>
        <div className="space-y-3">
          {PATHOLOGIES.map((name) => {
            const selected = data.patologias.find((p) => p.nombre === name);
            return (
              <div key={name} className={`rounded-xl border p-3 transition ${selected ? "bg-teal-50 border-teal-300" : "bg-white"}`}>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(selected)}
                    onChange={() => addPathology(name)}
                    className="w-5 h-5 accent-teal-600"
                  />
                  <span className="font-semibold text-slate-800">{name}</span>
                </label>
                {selected && (
                  <input
                    className="mt-2 w-full rounded-lg border p-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
                    placeholder="Detalle de medicamentos (obligatorio)"
                    value={selected.medicamento}
                    onChange={(e) => updateMedicamento(name, e.target.value)}
                  />
                )}
              </div>
            );
          })}

          {/* Otra patologia */}
          <div className={`rounded-xl border p-3 transition ${hasOtra ? "bg-teal-50 border-teal-300" : "bg-white"}`}>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={hasOtra}
                onChange={() => addPathology("Otra")}
                className="w-5 h-5 accent-teal-600"
              />
              <span className="font-semibold text-slate-800">Otra (Especificar)</span>
            </label>
            {hasOtra && (
              <div className="mt-2 space-y-2">
                <input
                  className="w-full rounded-lg border p-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
                  placeholder="Cual patologia (obligatorio)"
                  value={data.otraCual}
                  onChange={(e) => setData((prev) => ({ ...prev, otraCual: e.target.value }))}
                />
                <input
                  className="w-full rounded-lg border p-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
                  placeholder="Que medicamento toma (obligatorio)"
                  value={data.patologias.find((p) => p.nombre === "Otra")?.medicamento || ""}
                  onChange={(e) => updateMedicamento("Otra", e.target.value)}
                />
              </div>
            )}
          </div>
        </div>

        {data.patologias.length > 0 && !isValid() && (
          <p className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 font-medium">
            Debe completar los medicamentos de todas las patologias seleccionadas. Si selecciono &quot;Otra&quot;, indique cual patologia y que medicamento toma.
          </p>
        )}

        <div className="mt-6 flex justify-between">
          <Button onClick={onBack} variant="secondary">Atras</Button>
          <Button
            onClick={onNext}
            disabled={!data.edad || !data.sexo || (data.patologias.length > 0 && !isValid())}
          >
            Continuar a Pruebas SFT
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// === PRUEBAS SFT ===
function PruebasSftStep({ data, setData, onNext, onBack }) {
  const [safetyAlert, setSafetyAlert] = useState([]);

  const updateTest = (testId, value) => {
    setData((prev) => ({
      ...prev,
      pruebas: { ...prev.pruebas, [testId]: value },
    }));
  };

  const toggleSafety = (sign) => {
    setSafetyAlert((prev) =>
      prev.includes(sign) ? prev.filter((s) => s !== sign) : [...prev, sign]
    );
  };

  const hasAnyTest = Object.values(data.pruebas).some((v) => v !== "");

  return (
    <Card className="border-teal-200">
      <CardContent>
        <h2 className="text-2xl font-black text-teal-800 mb-2 flex items-center gap-2">
          <Activity size={28} /> Protocolo Senior Fitness Test (SFT)
        </h2>
        <p className="text-sm text-slate-600 mb-4">
          Registre los resultados de cada prueba. Los baremos se calcularan automaticamente segun edad ({data.edad} anos) y sexo ({data.sexo}).
        </p>

        {/* Safety Validations */}
        {safetyAlert.length > 0 && (
          <div className="mb-6 bg-red-50 border-2 border-red-300 rounded-xl p-4">
            <h3 className="font-bold text-red-800 flex items-center gap-2 mb-2">
              <AlertTriangle size={20} /> ALERTA DE SEGURIDAD - Detener evaluacion
            </h3>
            <p className="text-sm text-red-700 mb-2">
              Se han reportado los siguientes signos de riesgo. La evaluacion debe detenerse inmediatamente:
            </p>
            <ul className="list-disc pl-5 text-sm text-red-800 font-medium">
              {safetyAlert.map((s) => <li key={s}>{s}</li>)}
            </ul>
          </div>
        )}

        <details className="mb-6 bg-orange-50 border border-orange-200 rounded-xl p-4">
          <summary className="font-bold text-orange-800 cursor-pointer flex items-center gap-2">
            <AlertTriangle size={18} /> Validaciones de seguridad durante las pruebas
          </summary>
          <p className="mt-2 text-sm text-slate-600 mb-3">
            Marque si el participante presenta alguno de estos signos. La evaluacion se detendra.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {SAFETY_SIGNS.map((sign) => (
              <label key={sign} className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={safetyAlert.includes(sign)}
                  onChange={() => toggleSafety(sign)}
                  className="w-4 h-4 accent-red-600"
                />
                <span className={safetyAlert.includes(sign) ? "font-bold text-red-700" : "text-slate-700"}>{sign}</span>
              </label>
            ))}
          </div>
        </details>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {SFT_TESTS.map((test) => {
            const raw = data.pruebas[test.id] || "";
            const result = evaluateSFT(test.id, raw, data.edad, data.sexo);

            let badgeColor = "bg-slate-100 text-slate-500";
            let badgeText = "Pendiente";
            if (result) {
              if (result.score === 5) {
                badgeColor = "bg-emerald-100 text-emerald-800";
                badgeText = "Por encima";
              } else if (result.score === 3) {
                badgeColor = "bg-green-100 text-green-800";
                badgeText = "Normal";
              } else if (result.score === 1) {
                badgeColor = "bg-red-100 text-red-800";
                badgeText = "Por debajo";
              }
            }

            return (
              <div key={test.id} className="rounded-xl border bg-slate-50 p-4 hover:border-teal-200 transition">
                <div className="mb-2">
                  <p className="font-bold text-slate-800 text-sm">{test.name}</p>
                  <p className="text-xs text-slate-500">{test.fullName} - {test.description}</p>
                </div>
                <div className="flex gap-2 items-center">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      step="0.1"
                      className="w-full rounded-lg border p-2.5 pr-16 text-sm font-bold focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
                      placeholder={test.placeholder}
                      value={raw}
                      onChange={(e) => updateTest(test.id, e.target.value)}
                      disabled={safetyAlert.length > 0}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium">
                      {test.unit}
                    </span>
                  </div>
                  <span className={`rounded-lg px-2 py-1 text-xs font-bold whitespace-nowrap ${badgeColor}`}>
                    {badgeText}
                  </span>
                </div>
                {result && result.range && (
                  <p className="mt-1 text-xs text-slate-500">
                    Rango normal: {result.range[0]} - {result.range[1]} {test.unit}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-6 flex justify-between">
          <Button onClick={onBack} variant="secondary">Atras</Button>
          <Button onClick={onNext} disabled={!hasAnyTest || safetyAlert.length > 0}>
            Ver Resultados
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// === RESULTADOS Y RIESGO ECNT ===
function ResultadosStep({ consentimiento, anamnesis, pruebas, onSave, onBack, isSaving }) {
  const imcData = useMemo(() => getIMCData(anamnesis.peso, anamnesis.talla), [anamnesis.peso, anamnesis.talla]);

  const results = useMemo(() => {
    return SFT_TESTS.map((test) => {
      const raw = pruebas.pruebas[test.id] || "";
      const evaluation = evaluateSFT(test.id, raw, anamnesis.edad, anamnesis.sexo);
      return { ...test, raw, evaluation };
    }).filter((t) => t.raw !== "");
  }, [pruebas.pruebas, anamnesis.edad, anamnesis.sexo]);

  const overallScore = useMemo(() => {
    const evaluated = results.filter((r) => r.evaluation && r.evaluation.score > 0);
    if (evaluated.length === 0) return 0;
    const total = evaluated.reduce((sum, r) => sum + r.evaluation.score, 0);
    return (total / (evaluated.length * 5)) * 100;
  }, [results]);

  const classifyOverall = (score) => {
    if (score >= 80) return { label: "Condicion Fisica Excelente", color: "bg-emerald-100 text-emerald-800", emoji: "🟢" };
    if (score >= 60) return { label: "Condicion Fisica Normal", color: "bg-green-100 text-green-800", emoji: "🟡" };
    if (score >= 40) return { label: "Riesgo de Perdida Funcional", color: "bg-orange-100 text-orange-800", emoji: "🟠" };
    return { label: "Alto Riesgo - Fragilidad", color: "bg-red-100 text-red-800", emoji: "🔴" };
  };

  const classification = classifyOverall(overallScore);

  // ECNT Risk Assessment
  const ecntRisks = useMemo(() => {
    const risks = [];
    const pathNames = anamnesis.patologias.map((p) => p.nombre);

    if (pathNames.includes("Hipertension")) {
      risks.push({
        condition: "Hipertension Arterial",
        level: "Alto",
        color: "text-red-700",
        recommendation: "Monitoreo constante de presion arterial. Ejercicio aerobico de baja intensidad. Evitar actividades con maniobra de Valsalva.",
      });
    }
    if (pathNames.includes("Diabetes tipo 2")) {
      risks.push({
        condition: "Diabetes Tipo 2",
        level: "Alto",
        color: "text-red-700",
        recommendation: "Control glucemico antes y despues del ejercicio. Ejercicio combinado (aerobico + resistencia). Hidratacion adecuada.",
      });
    }
    if (pathNames.includes("Obesidad") || (imcData && Number(imcData.value) >= 30)) {
      risks.push({
        condition: "Obesidad",
        level: "Moderado-Alto",
        color: "text-orange-700",
        recommendation: "Programa de ejercicio progresivo. Combinar actividad aerobica con control nutricional. Bajo impacto articular.",
      });
    }
    if (pathNames.includes("Sedentarismo")) {
      risks.push({
        condition: "Sedentarismo",
        level: "Moderado",
        color: "text-orange-700",
        recommendation: "Inicio gradual de actividad fisica. 150 min/semana de actividad moderada. Reducir periodos de inactividad.",
      });
    }
    if (pathNames.includes("Artrosis")) {
      risks.push({
        condition: "Artrosis",
        level: "Moderado",
        color: "text-orange-700",
        recommendation: "Ejercicios de bajo impacto (natacion, bicicleta). Fortalecimiento muscular periarticular. Flexibilidad y movilidad articular.",
      });
    }
    if (pathNames.includes("Osteoporosis")) {
      risks.push({
        condition: "Osteoporosis",
        level: "Alto",
        color: "text-red-700",
        recommendation: "Evitar ejercicios de alto impacto y flexion vertebral. Ejercicios de carga axial y equilibrio. Prevencion de caidas.",
      });
    }
    if (pathNames.includes("Enfermedad cardiovascular")) {
      risks.push({
        condition: "Enfermedad Cardiovascular",
        level: "Alto",
        color: "text-red-700",
        recommendation: "Ejercicio supervisado. Monitoreo de frecuencia cardiaca. Progresion lenta y controlada. Evitar ejercicio en temperaturas extremas.",
      });
    }
    if (pathNames.includes("Enfermedad respiratoria cronica")) {
      risks.push({
        condition: "Enfermedad Respiratoria Cronica",
        level: "Moderado-Alto",
        color: "text-orange-700",
        recommendation: "Programa de rehabilitacion pulmonar. Ejercicios de respiracion. Actividad aerobica adaptada con control de disnea.",
      });
    }

    // Additional risks from test results
    const belowNormal = results.filter((r) => r.evaluation && r.evaluation.score === 1);
    if (belowNormal.length >= 3) {
      risks.push({
        condition: "Fragilidad Multidimensional (3+ pruebas por debajo del rango)",
        level: "Alto",
        color: "text-red-700",
        recommendation: "Evaluacion geriatrica integral. Programa multicomponente supervisado. Prevencion de caidas y perdida de independencia.",
      });
    }

    return risks;
  }, [anamnesis.patologias, results, imcData]);

  return (
    <Card className="border-teal-200">
      <CardContent>
        <h2 className="text-2xl font-black text-teal-800 mb-4 flex items-center gap-2">
          <HeartPulse size={28} /> Resultados de la Valoracion
        </h2>

        {/* Datos generales */}
        <div className="bg-slate-50 border rounded-xl p-4 mb-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div><span className="text-slate-500">Nombre:</span> <strong>{consentimiento.nombreCompleto}</strong></div>
            <div><span className="text-slate-500">Documento:</span> <strong>{consentimiento.documento}</strong></div>
            <div><span className="text-slate-500">Edad:</span> <strong>{anamnesis.edad} anos</strong></div>
            <div><span className="text-slate-500">Sexo:</span> <strong>{anamnesis.sexo}</strong></div>
            {imcData && (
              <>
                <div><span className="text-slate-500">IMC:</span> <strong>{imcData.value}</strong></div>
                <div><span className="text-slate-500">Categoria:</span> <strong>{imcData.category}</strong></div>
              </>
            )}
          </div>
        </div>

        {/* Score General */}
        <div className={`rounded-xl border p-5 mb-6 text-center ${classification.color}`}>
          <p className="text-4xl font-black">{classification.emoji} {overallScore.toFixed(0)}%</p>
          <p className="text-xl font-bold mt-1">{classification.label}</p>
        </div>

        {/* Resultados por prueba */}
        <h3 className="font-bold text-lg text-slate-800 mb-3">Detalle por Prueba</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
          {results.map((test) => {
            let bgColor = "bg-slate-50";
            if (test.evaluation) {
              if (test.evaluation.score === 5) bgColor = "bg-emerald-50 border-emerald-200";
              else if (test.evaluation.score === 3) bgColor = "bg-green-50 border-green-200";
              else if (test.evaluation.score === 1) bgColor = "bg-red-50 border-red-200";
            }
            return (
              <div key={test.id} className={`rounded-lg border p-3 ${bgColor}`}>
                <p className="font-bold text-sm text-slate-800">{test.name}</p>
                <p className="text-sm">
                  Resultado: <strong>{test.raw} {test.unit}</strong>
                </p>
                {test.evaluation && (
                  <>
                    <p className="text-xs text-slate-600 mt-1">
                      {test.evaluation.classification}
                    </p>
                    {test.evaluation.range && (
                      <p className="text-xs text-slate-500">
                        Rango normal: {test.evaluation.range[0]} - {test.evaluation.range[1]}
                      </p>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Modulo de Riesgo ECNT */}
        {ecntRisks.length > 0 && (
          <>
            <h3 className="font-bold text-lg text-slate-800 mb-3 flex items-center gap-2">
              <AlertTriangle className="text-orange-500" size={20} /> Modulo de Riesgo por ECNT
            </h3>
            <div className="space-y-3 mb-6">
              {ecntRisks.map((risk) => (
                <div key={risk.condition} className="rounded-xl border bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`font-bold ${risk.color}`}>{risk.condition}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${risk.level === "Alto" ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"}`}>
                      Riesgo {risk.level}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600">{risk.recommendation}</p>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Patologias registradas */}
        {anamnesis.patologias.length > 0 && (
          <>
            <h3 className="font-bold text-lg text-slate-800 mb-3">Patologias y Medicamentos Registrados</h3>
            <div className="bg-slate-50 border rounded-xl p-4 mb-6">
              {anamnesis.patologias.map((p) => (
                <div key={p.nombre} className="flex justify-between items-center py-2 border-b last:border-b-0">
                  <span className="font-semibold text-slate-800">{p.nombre === "Otra" ? `Otra: ${anamnesis.otraCual}` : p.nombre}</span>
                  <span className="text-sm text-slate-600">Medicamento: {p.medicamento}</span>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="mt-6 flex justify-between">
          <Button onClick={onBack} variant="secondary">Atras (editar pruebas)</Button>
          <Button onClick={onSave} variant="success" disabled={isSaving}>
            {isSaving ? (
              <><Loader2 className="animate-spin" size={18} /> Guardando...</>
            ) : (
              <>{firebaseEnabled ? <Cloud size={18} /> : <ClipboardList size={18} />} Guardar Evaluacion</>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// === MAIN SFT APP ===
export default function SftApp() {
  const [step, setStep] = useState(0); // 0=consent, 1=anamnesis, 2=tests, 3=results
  const [activeView, setActiveView] = useState("evaluacion"); // evaluacion | basedatos
  const [records, setRecords] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [consentimiento, setConsentimiento] = useState({
    acepta: false,
    nombreCompleto: "",
    documento: "",
    firma: "",
  });

  const [anamnesis, setAnamnesis] = useState({
    edad: "",
    sexo: "",
    peso: "",
    talla: "",
    perimetroAbdominal: "",
    perimetroPantorrilla: "",
    patologias: [],
    otraCual: "",
  });

  const [pruebas, setPruebas] = useState({
    pruebas: SFT_TESTS.reduce((acc, t) => ({ ...acc, [t.id]: "" }), {}),
  });

  useEffect(() => {
    const unsubscribe = subscribeRecords((live) => {
      const sorted = [...live].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      setRecords(sorted);
    });
    return unsubscribe;
  }, []);

  const resetForm = useCallback(() => {
    setStep(0);
    setConsentimiento({ acepta: false, nombreCompleto: "", documento: "", firma: "" });
    setAnamnesis({ edad: "", sexo: "", peso: "", talla: "", perimetroAbdominal: "", perimetroPantorrilla: "", patologias: [], otraCual: "" });
    setPruebas({ pruebas: SFT_TESTS.reduce((acc, t) => ({ ...acc, [t.id]: "" }), {}) });
    setEditingId(null);
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    const imcData = getIMCData(anamnesis.peso, anamnesis.talla);

    const evaluatedTests = SFT_TESTS.map((test) => {
      const raw = pruebas.pruebas[test.id] || "";
      const evaluation = evaluateSFT(test.id, raw, anamnesis.edad, anamnesis.sexo);
      return { testId: test.id, testName: test.name, raw, evaluation };
    }).filter((t) => t.raw !== "");

    const evaluated = evaluatedTests.filter((r) => r.evaluation && r.evaluation.score > 0);
    const overallScore = evaluated.length > 0
      ? (evaluated.reduce((sum, r) => sum + r.evaluation.score, 0) / (evaluated.length * 5)) * 100
      : 0;

    const recordData = {
      consentimiento: {
        nombreCompleto: consentimiento.nombreCompleto,
        documento: consentimiento.documento,
        acepta: consentimiento.acepta,
        firmaPresente: Boolean(consentimiento.firma),
      },
      anamnesis,
      pruebas: pruebas.pruebas,
      resultados: evaluatedTests,
      overallScore: Number(overallScore.toFixed(1)),
      imcValue: imcData ? imcData.value : null,
      imcCategory: imcData ? imcData.category : null,
      timestamp: Date.now(),
      createdAt: new Date().toLocaleString(),
      fecha: new Date().toISOString().slice(0, 10),
    };

    try {
      if (editingId) {
        await updateRecord(editingId, recordData);
      } else {
        await addRecord(recordData);
      }
      resetForm();
      setActiveView("basedatos");
    } catch (error) {
      console.error("Error al guardar:", error);
      alert("Error al guardar la evaluacion.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (record) => {
    setEditingId(record.id);
    setConsentimiento({
      acepta: true,
      nombreCompleto: record.consentimiento?.nombreCompleto || "",
      documento: record.consentimiento?.documento || "",
      firma: "",
    });
    setAnamnesis(record.anamnesis || {
      edad: "", sexo: "", peso: "", talla: "",
      perimetroAbdominal: "", perimetroPantorrilla: "",
      patologias: [], otraCual: "",
    });
    setPruebas({ pruebas: record.pruebas || {} });
    setStep(2);
    setActiveView("evaluacion");
  };

  const handleDelete = async (id) => {
    if (window.confirm("Esta seguro de eliminar este registro?")) {
      await deleteRecord(id);
    }
  };

  const exportData = (format) => {
    if (records.length === 0) return;

    const headers = [
      "Fecha", "Nombre", "Documento", "Edad", "Sexo", "Peso", "Talla", "IMC", "Categoria_IMC",
      "Perimetro_Abdominal", "Perimetro_Pantorrilla", "Patologias", "Medicamentos",
      ...SFT_TESTS.map((t) => t.name),
      ...SFT_TESTS.map((t) => `${t.name}_Clasificacion`),
      "Puntaje_General", "Clasificacion_General",
    ];

    const rows = records.map((r) => {
      const pathNames = (r.anamnesis?.patologias || []).map((p) => p.nombre === "Otra" ? `Otra: ${r.anamnesis.otraCual}` : p.nombre).join("; ");
      const meds = (r.anamnesis?.patologias || []).map((p) => p.medicamento).join("; ");

      return [
        r.createdAt || r.fecha || "",
        r.consentimiento?.nombreCompleto || "",
        r.consentimiento?.documento || "",
        r.anamnesis?.edad || "",
        r.anamnesis?.sexo || "",
        r.anamnesis?.peso || "",
        r.anamnesis?.talla || "",
        r.imcValue || "",
        r.imcCategory || "",
        r.anamnesis?.perimetroAbdominal || "",
        r.anamnesis?.perimetroPantorrilla || "",
        pathNames,
        meds,
        ...SFT_TESTS.map((t) => r.pruebas?.[t.id] || ""),
        ...SFT_TESTS.map((t) => {
          const ev = (r.resultados || []).find((re) => re.testId === t.id);
          return ev?.evaluation?.classification || "";
        }),
        r.overallScore || "",
        r.overallScore >= 80 ? "Excelente" : r.overallScore >= 60 ? "Normal" : r.overallScore >= 40 ? "Riesgo" : "Fragilidad",
      ];
    });

    if (format === "csv") {
      const csv = [headers, ...rows]
        .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
        .join("\n");
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "evaluaciones_sft_observatorio2026.csv";
      link.click();
      URL.revokeObjectURL(url);
    } else {
      import("xlsx").then((XLSX) => {
        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Evaluaciones SFT");
        XLSX.writeFile(wb, "evaluaciones_sft_observatorio2026.xlsx");
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 text-slate-900 md:p-8 font-sans">
      <div className="mx-auto max-w-5xl space-y-6">

        {/* Header */}
        <header className="rounded-3xl bg-gradient-to-r from-teal-700 to-slate-900 p-6 text-white shadow-lg">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm">
                <Activity size={16} /> Adultos Mayores 60-94 anos
              </div>
              <h1 className="text-3xl font-black tracking-tight md:text-4xl">
                Senior Fitness Test (SFT)
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-teal-100">
                Protocolo de valoracion funcional para personas mayores - Observatorio 2026
              </p>
            </div>
            <div className="flex flex-col gap-2 items-end">
              <div className={`flex items-center gap-2 text-xs font-bold rounded-full py-1.5 px-3 backdrop-blur ${firebaseEnabled ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-200"}`}>
                {firebaseEnabled ? <><Cloud size={14} /> Nube activa</> : <><CloudOff size={14} /> Almacenamiento local</>}
              </div>
            </div>
          </div>
        </header>

        {/* Navigation */}
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={() => setActiveView("evaluacion")}
            className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition ${activeView === "evaluacion" ? "bg-teal-600 text-white shadow" : "bg-white border text-slate-700 hover:bg-slate-50"}`}
          >
            <ClipboardList size={16} /> Nueva Valoracion
          </button>
          <button
            onClick={() => setActiveView("basedatos")}
            className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition ${activeView === "basedatos" ? "bg-teal-600 text-white shadow" : "bg-white border text-slate-700 hover:bg-slate-50"}`}
          >
            <Download size={16} /> Base de Datos ({records.length})
          </button>
        </div>

        {activeView === "evaluacion" ? (
          <>
            {/* Progress bar */}
            <div className="flex items-center gap-2">
              {["Consentimiento", "Anamnesis", "Pruebas SFT", "Resultados"].map((label, i) => (
                <div key={label} className="flex-1">
                  <div className={`h-2 rounded-full transition-colors ${i <= step ? "bg-teal-500" : "bg-slate-200"}`} />
                  <p className={`text-xs font-medium mt-1 text-center ${i <= step ? "text-teal-700" : "text-slate-400"}`}>{label}</p>
                </div>
              ))}
            </div>

            {step === 0 && (
              <ConsentimientoStep data={consentimiento} setData={setConsentimiento} onNext={() => setStep(1)} />
            )}
            {step === 1 && (
              <AnamnesisStep data={anamnesis} setData={setAnamnesis} onNext={() => setStep(2)} onBack={() => setStep(0)} />
            )}
            {step === 2 && (
              <PruebasSftStep data={pruebas} setData={setPruebas} onNext={() => setStep(3)} onBack={() => setStep(1)} />
            )}
            {step === 3 && (
              <ResultadosStep
                consentimiento={consentimiento}
                anamnesis={anamnesis}
                pruebas={pruebas}
                onSave={handleSave}
                onBack={() => setStep(2)}
                isSaving={isSaving}
              />
            )}
          </>
        ) : (
          /* BASE DE DATOS */
          <Card>
            <CardContent>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 border-b pb-4">
                <div>
                  <h2 className="text-xl font-bold">Base de Datos - Evaluaciones SFT</h2>
                  <p className="text-sm text-slate-500">{records.length} evaluaciones registradas</p>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => exportData("csv")} variant="secondary" disabled={records.length === 0} className="text-teal-700 border-teal-200">
                    <Download size={16} /> CSV
                  </Button>
                  <Button onClick={() => exportData("xlsx")} variant="secondary" disabled={records.length === 0} className="text-teal-700 border-teal-200">
                    <Download size={16} /> XLSX
                  </Button>
                </div>
              </div>

              {records.length === 0 ? (
                <p className="text-center text-slate-500 py-8">No hay evaluaciones guardadas. Realice una nueva valoracion.</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border">
                  <table className="w-full min-w-[900px] border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b">
                        <th className="p-3 text-left font-bold">Fecha</th>
                        <th className="p-3 text-left font-bold">Nombre</th>
                        <th className="p-3 text-center font-bold">Edad/Sexo</th>
                        <th className="p-3 text-center font-bold">IMC</th>
                        <th className="p-3 text-center font-bold">Puntaje</th>
                        <th className="p-3 text-center font-bold">Clasificacion</th>
                        <th className="p-3 text-center font-bold">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {records.map((r) => {
                        const score = r.overallScore || 0;
                        const cls = score >= 80 ? "text-emerald-700" : score >= 60 ? "text-green-700" : score >= 40 ? "text-orange-700" : "text-red-700";
                        return (
                          <tr key={r.id} className="hover:bg-slate-50">
                            <td className="p-3 text-slate-600">{r.createdAt || r.fecha}</td>
                            <td className="p-3 font-bold">{r.consentimiento?.nombreCompleto || "-"}</td>
                            <td className="p-3 text-center">{r.anamnesis?.edad || "-"} / {r.anamnesis?.sexo || "-"}</td>
                            <td className="p-3 text-center">{r.imcValue || "-"}</td>
                            <td className={`p-3 text-center font-black ${cls}`}>{score.toFixed(0)}%</td>
                            <td className="p-3 text-center text-xs font-medium">
                              {score >= 80 ? "Excelente" : score >= 60 ? "Normal" : score >= 40 ? "Riesgo" : "Fragilidad"}
                            </td>
                            <td className="p-3 text-center">
                              <div className="flex justify-center gap-1">
                                <button onClick={() => handleEdit(r)} className="p-1.5 rounded-lg hover:bg-teal-100 text-teal-700" title="Editar">
                                  <Pencil size={16} />
                                </button>
                                <button onClick={() => handleDelete(r.id)} className="p-1.5 rounded-lg hover:bg-red-100 text-red-600" title="Eliminar">
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
