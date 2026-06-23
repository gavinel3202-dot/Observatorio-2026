import { Activity, HeartPulse, Dumbbell, Gauge, ShieldCheck } from "lucide-react";

// === DEFINICIÓN DE PRUEBAS ===
export const tests = [
  { id: "prension", name: "Fuerza de prensión manual", shortName: "Prensión", dimension: "Longevidad y Autonomía", weight: 10, icon: Dumbbell, unit: "kg", placeholder: "Ej: 42" },
  { id: "salto", name: "Miembros inferiores / Salto Vertical", shortName: "Salto", dimension: "Longevidad y Autonomía", weight: 10, icon: Activity, unit: "cm", placeholder: "Ej: 35" },
  { id: "core", name: "Fuerza abdominal / Core", shortName: "Core", dimension: "Longevidad y Autonomía", weight: 10, icon: ShieldCheck, unit: "reps/min", placeholder: "Ej: 40" },
  { id: "flexiones", name: "Fuerza tren superior / Flexiones", shortName: "Flexiones", dimension: "Longevidad y Autonomía", weight: 10, icon: Dumbbell, unit: "reps", placeholder: "Ej: 20" },
  { id: "trote2k", name: "Resistencia aeróbica / Trote 2K", shortName: "Trote 2K", dimension: "Metabólica y Cardiopulmonar", weight: 25, icon: HeartPulse, unit: "minutos", placeholder: "Ej: 16.5" },
  { id: "perimetro", name: "Perímetro abdominal", shortName: "Perímetro", dimension: "Metabólica y Cardiopulmonar", weight: 15, icon: Gauge, unit: "cm", placeholder: "Ej: 92" },
  { id: "equilibrio", name: "Equilibrio Monopodal (Flamenco)", shortName: "Equilibrio", dimension: "Movilidad y Control Motor", weight: 10, icon: Activity, unit: "segundos", placeholder: "Ej: 45 (Máx 60)" },
  { id: "flexibilidad", name: "Flexibilidad / Test de Wells", shortName: "Flexibilidad", dimension: "Movilidad y Control Motor", weight: 10, icon: Activity, unit: "cm", placeholder: "Ej: 12" },
];

export const dimensions = [
  { name: "Longevidad y Autonomía", weight: 40 },
  { name: "Metabólica y Cardiopulmonar", weight: 40 },
  { name: "Movilidad y Control Motor", weight: 20 },
];

export const initialScores = tests.reduce((acc, test) => {
  acc[test.id] = "";
  return acc;
}, {});

// --- LÓGICA DE BAREMOS (CRUCE POR EDAD Y SEXO) ---
export const evaluateTest = (testId, rawValue, ageStr, sex) => {
  if (rawValue === "" || rawValue === undefined) return null;
  if (!ageStr || !sex || sex === "Otro / No reporta") return -1;

  const val = Number(rawValue);
  const age = Number(ageStr);
  const isHombre = sex === "Hombre";

  if (age < 18 || age > 69) return -2;

  switch (testId) {
    case "flexiones":
      if (isHombre) {
        if (age <= 29) return val >= 45 ? 5 : val >= 35 ? 4 : val >= 25 ? 3 : val >= 15 ? 2 : 1;
        if (age <= 39) return val >= 36 ? 5 : val >= 25 ? 4 : val >= 17 ? 3 : val >= 10 ? 2 : 1;
        if (age <= 49) return val >= 30 ? 5 : val >= 20 ? 4 : val >= 13 ? 3 : val >= 8 ? 2 : 1;
        if (age <= 59) return val >= 26 ? 5 : val >= 15 ? 4 : val >= 10 ? 3 : val >= 5 ? 2 : 1;
        return val >= 21 ? 5 : val >= 10 ? 4 : val >= 6 ? 3 : val >= 3 ? 2 : 1;
      } else {
        if (age <= 29) return val >= 34 ? 5 : val >= 25 ? 4 : val >= 15 ? 3 : val >= 7 ? 2 : 1;
        if (age <= 39) return val >= 28 ? 5 : val >= 19 ? 4 : val >= 11 ? 3 : val >= 5 ? 2 : 1;
        if (age <= 49) return val >= 23 ? 5 : val >= 15 ? 4 : val >= 8 ? 3 : val >= 3 ? 2 : 1;
        if (age <= 59) return val >= 19 ? 5 : val >= 11 ? 4 : val >= 5 ? 3 : val >= 2 ? 2 : 1;
        return val >= 15 ? 5 : val >= 8 ? 4 : val >= 3 ? 3 : val >= 1 ? 2 : 1;
      }
    case "core":
      if (isHombre) {
        if (age <= 25) return val >= 38 ? 5 : val >= 34 ? 4 : val >= 30 ? 3 : val >= 25 ? 2 : 1;
        if (age <= 35) return val >= 39 ? 5 : val >= 30 ? 4 : val >= 28 ? 3 : val >= 22 ? 2 : 1;
        if (age <= 45) return val >= 29 ? 5 : val >= 26 ? 4 : val >= 22 ? 3 : val >= 17 ? 2 : 1;
        if (age <= 55) return val >= 24 ? 5 : val >= 21 ? 4 : val >= 17 ? 3 : val >= 13 ? 2 : 1;
        if (age <= 65) return val >= 20 ? 5 : val >= 16 ? 4 : val >= 12 ? 3 : val >= 9 ? 2 : 1;
        return val >= 18 ? 5 : val >= 14 ? 4 : val >= 10 ? 3 : val >= 7 ? 2 : 1;
      } else {
        if (age <= 25) return val >= 32 ? 5 : val >= 28 ? 4 : val >= 24 ? 3 : val >= 18 ? 2 : 1;
        if (age <= 35) return val >= 28 ? 5 : val >= 24 ? 4 : val >= 20 ? 3 : val >= 13 ? 2 : 1;
        if (age <= 45) return val >= 22 ? 5 : val >= 18 ? 4 : val >= 14 ? 3 : val >= 7 ? 2 : 1;
        if (age <= 55) return val >= 17 ? 5 : val >= 13 ? 4 : val >= 9 ? 3 : val >= 5 ? 2 : 1;
        if (age <= 65) return val >= 12 ? 5 : val >= 9 ? 4 : val >= 6 ? 3 : val >= 3 ? 2 : 1;
        return val >= 13 ? 5 : val >= 10 ? 4 : val >= 4 ? 3 : val >= 2 ? 2 : 1;
      }
    case "trote2k":
      if (isHombre) {
        if (age <= 29) return val <= 14 ? 5 : val <= 15.5 ? 4 : val <= 17 ? 3 : val <= 18 ? 2 : 1;
        if (age <= 39) return val <= 15 ? 5 : val <= 16.5 ? 4 : val <= 18 ? 3 : val <= 19 ? 2 : 1;
        if (age <= 49) return val <= 16 ? 5 : val <= 17.5 ? 4 : val <= 19 ? 3 : val <= 20 ? 2 : 1;
        return val <= 17 ? 5 : val <= 18.5 ? 4 : val <= 20 ? 3 : val <= 21 ? 2 : 1;
      } else {
        if (age <= 29) return val <= 17 ? 5 : val <= 18.5 ? 4 : val <= 19 ? 3 : val <= 20 ? 2 : 1;
        if (age <= 39) return val <= 18 ? 5 : val <= 19.5 ? 4 : val <= 20 ? 3 : val <= 21 ? 2 : 1;
        if (age <= 49) return val <= 19 ? 5 : val <= 20.5 ? 4 : val <= 21 ? 3 : val <= 22 ? 2 : 1;
        return val <= 20 ? 5 : val <= 21.5 ? 4 : val <= 22 ? 3 : val <= 23 ? 2 : 1;
      }
    case "prension":
      if (isHombre) {
        if (age <= 29) return val >= 60 ? 5 : val >= 52 ? 4 : val >= 40 ? 3 : val >= 27 ? 2 : 1;
        if (age <= 39) return val >= 58 ? 5 : val >= 50 ? 4 : val >= 39 ? 3 : val >= 26 ? 2 : 1;
        if (age <= 49) return val >= 55 ? 5 : val >= 48 ? 4 : val >= 37 ? 3 : val >= 25 ? 2 : 1;
        return val >= 52 ? 5 : val >= 45 ? 4 : val >= 35 ? 3 : val >= 23 ? 2 : 1;
      } else {
        if (age <= 29) return val >= 34 ? 5 : val >= 30 ? 4 : val >= 24 ? 3 : val >= 16 ? 2 : 1;
        if (age <= 39) return val >= 33 ? 5 : val >= 29 ? 4 : val >= 23 ? 3 : val >= 15 ? 2 : 1;
        if (age <= 49) return val >= 31 ? 5 : val >= 27 ? 4 : val >= 21 ? 3 : val >= 14 ? 2 : 1;
        return val >= 29 ? 5 : val >= 25 ? 4 : val >= 20 ? 3 : val >= 13 ? 2 : 1;
      }
    case "salto":
      if (isHombre) {
        if (age <= 29) return val >= 55 ? 5 : val >= 45 ? 4 : val >= 35 ? 3 : val >= 25 ? 2 : 1;
        if (age <= 39) return val >= 50 ? 5 : val >= 40 ? 4 : val >= 30 ? 3 : val >= 20 ? 2 : 1;
        if (age <= 49) return val >= 45 ? 5 : val >= 35 ? 4 : val >= 25 ? 3 : val >= 15 ? 2 : 1;
        return val >= 40 ? 5 : val >= 30 ? 4 : val >= 20 ? 3 : val >= 10 ? 2 : 1;
      } else {
        if (age <= 29) return val >= 45 ? 5 : val >= 35 ? 4 : val >= 25 ? 3 : val >= 15 ? 2 : 1;
        if (age <= 39) return val >= 40 ? 5 : val >= 30 ? 4 : val >= 20 ? 3 : val >= 12 ? 2 : 1;
        if (age <= 49) return val >= 35 ? 5 : val >= 25 ? 4 : val >= 15 ? 3 : val >= 10 ? 2 : 1;
        return val >= 30 ? 5 : val >= 20 ? 4 : val >= 12 ? 3 : val >= 7 ? 2 : 1;
      }
    case "perimetro":
      if (isHombre) return val < 90 ? 5 : val <= 102 ? 3 : 1;
      return val < 80 ? 5 : val <= 88 ? 3 : 1;
    case "equilibrio":
      if (age <= 39) return val >= 50 ? 5 : val >= 40 ? 4 : val >= 25 ? 3 : val >= 15 ? 2 : 1;
      if (age <= 49) return val >= 45 ? 5 : val >= 35 ? 4 : val >= 20 ? 3 : val >= 10 ? 2 : 1;
      if (age <= 59) return val >= 40 ? 5 : val >= 30 ? 4 : val >= 15 ? 3 : val >= 8 ? 2 : 1;
      return val >= 30 ? 5 : val >= 20 ? 4 : val >= 10 ? 3 : val >= 5 ? 2 : 1;
    case "flexibilidad":
      return val >= 15 ? 5 : val >= 11 ? 4 : val >= 6 ? 3 : val >= 0 ? 2 : 1;
    default:
      return 3;
  }
};

export const getClassificationLabel = (score) => {
  switch (score) {
    case 5: return "Excelente";
    case 4: return "Muy Bueno";
    case 3: return "Normal/Bien";
    case 2: return "Regular/Riesgo";
    case 1: return "Bajo/Crítico";
    default: return "Pendiente";
  }
};

export const getScoreColor = (score) => {
  if (score === -1) return "bg-slate-100 text-orange-600 border-orange-200";
  if (score === -2) return "bg-red-50 text-red-600 border-red-200";
  switch (score) {
    case 5: return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case 4: return "bg-green-100 text-green-800 border-green-200";
    case 3: return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case 2: return "bg-orange-100 text-orange-800 border-orange-200";
    case 1: return "bg-red-100 text-red-800 border-red-200";
    default: return "bg-slate-100 text-slate-500 border-slate-200";
  }
};

// --- CÁLCULO DE IMC SEGÚN TABLA OMS ---
export const getIMCData = (peso, talla) => {
  if (!peso || !talla) return null;
  const p = parseFloat(peso);
  const t = parseFloat(talla) / 100; // Convertir cm a metros

  if (p <= 0 || t <= 0) return null;

  const imc = p / (t * t);
  let category = "";
  let risk = "";
  let color = "";

  if (imc < 16.0) {
    category = "Delgadez Severa"; risk = "Riesgo Alto"; color = "bg-red-100 text-red-800 border-red-300";
  } else if (imc >= 16.0 && imc < 17.0) {
    category = "Delgadez Moderada"; risk = "Riesgo Moderado"; color = "bg-orange-100 text-orange-800 border-orange-300";
  } else if (imc >= 17.0 && imc < 18.5) {
    category = "Delgadez Aceptable"; risk = "Riesgo Leve"; color = "bg-yellow-100 text-yellow-800 border-yellow-300";
  } else if (imc >= 18.5 && imc < 25.0) {
    category = "Peso Saludable"; risk = "Riesgo Promedio/Mínimo"; color = "bg-emerald-100 text-emerald-800 border-emerald-300";
  } else if (imc >= 25.0 && imc < 30.0) {
    category = "Preobesidad"; risk = "Riesgo Aumentado"; color = "bg-yellow-100 text-yellow-800 border-yellow-300";
  } else if (imc >= 30.0 && imc < 35.0) {
    category = "Obesidad Grado I"; risk = "Riesgo Moderadamente alto"; color = "bg-orange-100 text-orange-800 border-orange-300";
  } else if (imc >= 35.0 && imc < 40.0) {
    category = "Obesidad Grado II (Severa)"; risk = "Riesgo Muy alto"; color = "bg-red-100 text-red-800 border-red-300";
  } else {
    category = "Obesidad Grado III (Mórbida)"; risk = "Riesgo Extremadamente alto"; color = "bg-red-200 text-red-900 border-red-400";
  }

  return { value: imc.toFixed(1), category, risk, color };
};

export function classifyICFG(score) {
  if (score === 0) {
    return {
      label: "Esperando datos...",
      color: "bg-slate-100 text-slate-500 border-slate-200",
      bar: "bg-slate-300",
      emoji: "⏳",
      profile: "Completa las pruebas físicas para obtener la valoración general.",
      action: "Inicia el ingreso de los resultados brutos de cada prueba.",
    };
  }
  if (score < 40) {
    return {
      label: "Nivel de Fragilidad / Dependencia",
      color: "bg-red-100 text-red-800 border-red-200",
      bar: "bg-red-500",
      emoji: "🔴",
      profile: "Alto riesgo cardiovascular, debilidad muscular y alto riesgo de caídas.",
      action: "Derivar a ejercicios de bajo impacto, trabajo acuático, propiocepción y equilibrio estático.",
    };
  }
  if (score < 60) {
    return {
      label: "Nivel de Riesgo Funcional",
      color: "bg-orange-100 text-orange-800 border-orange-200",
      bar: "bg-orange-500",
      emoji: "🟠",
      profile: "Presenta deficiencias funcionales claras en alguna dimensión clave.",
      action: "Plan de transición enfocado en la debilidad principal (cardio, equilibrio o fuerza estructural).",
    };
  }
  if (score < 80) {
    return {
      label: "Nivel de Funcionalidad Autónoma",
      color: "bg-yellow-100 text-yellow-800 border-yellow-200",
      bar: "bg-yellow-500",
      emoji: "🟡",
      profile: "Cumple estándares mínimos de funcionalidad con independencia física y buen control motor.",
      action: "Mantener entrenamiento funcional, trabajo de fuerza, resistencia y seguimiento.",
    };
  }
  return {
    label: "Nivel de Plenitud Física / Atlética",
    color: "bg-emerald-100 text-emerald-800 border-emerald-200",
    bar: "bg-emerald-500",
    emoji: "🟢",
    profile: "Condición física superior, alta capacidad cardiopulmonar y excelente equilibrio estático.",
    action: "Programas avanzados, HIIT, fuerza hipertrófica y posible liderazgo deportivo.",
  };
}
