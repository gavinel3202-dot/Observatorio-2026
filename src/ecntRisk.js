/**
 * Módulo de evaluación de riesgo por Enfermedades Crónicas No Transmisibles (ECNT)
 * para personas mayores (adultos mayores 60+).
 *
 * Factores de riesgo evaluados:
 * - Hipertensión arterial
 * - Diabetes tipo 2 / Hipoglucemia
 * - Obesidad (IMC >= 30)
 * - Sedentarismo
 * - Enfermedades respiratorias crónicas
 * - Enfermedades cardiovasculares
 * - Artrosis
 * - Osteoporosis
 */

export const PATHOLOGIES = [
  { id: "artrosis", label: "Artrosis" },
  { id: "hipertension", label: "Hipertensión arterial" },
  { id: "diabetes", label: "Diabetes tipo 2" },
  { id: "hipoglucemia", label: "Hipoglucemia" },
  { id: "osteoporosis", label: "Osteoporosis" },
  { id: "cardiovascular", label: "Enfermedad cardiovascular" },
  { id: "respiratoria", label: "Enfermedad respiratoria crónica" },
  { id: "obesidad", label: "Obesidad diagnosticada" },
  { id: "sedentarismo", label: "Sedentarismo (< 150 min/semana de actividad)" },
  { id: "otra", label: "Otra (Especificar)" },
];

/**
 * Calcula el nivel de riesgo general basado en las patologías seleccionadas,
 * el IMC, el perímetro de cintura y los resultados SFT.
 */
export function calculateECNTRisk(selectedPathologies, imc, waistCirc, sex, sftResults) {
  let riskScore = 0;
  const factors = [];

  // Riesgo por número de patologías
  const pathCount = selectedPathologies.length;
  if (pathCount >= 4) {
    riskScore += 3;
    factors.push("Múltiples comorbilidades (4+)");
  } else if (pathCount >= 2) {
    riskScore += 2;
    factors.push("Comorbilidades múltiples (2-3)");
  } else if (pathCount >= 1) {
    riskScore += 1;
  }

  // Riesgo por patologías específicas de alto impacto
  if (selectedPathologies.includes("hipertension")) {
    riskScore += 2;
    factors.push("Hipertensión arterial");
  }
  if (selectedPathologies.includes("diabetes")) {
    riskScore += 2;
    factors.push("Diabetes tipo 2");
  }
  if (selectedPathologies.includes("cardiovascular")) {
    riskScore += 3;
    factors.push("Enfermedad cardiovascular");
  }
  if (selectedPathologies.includes("respiratoria")) {
    riskScore += 2;
    factors.push("Enfermedad respiratoria crónica");
  }
  if (selectedPathologies.includes("osteoporosis")) {
    riskScore += 1;
    factors.push("Osteoporosis");
  }
  if (selectedPathologies.includes("sedentarismo")) {
    riskScore += 2;
    factors.push("Sedentarismo");
  }

  // Riesgo por IMC
  if (imc) {
    if (imc >= 30) {
      riskScore += 2;
      factors.push("Obesidad (IMC ≥ 30)");
    } else if (imc >= 25) {
      riskScore += 1;
      factors.push("Sobrepeso (IMC 25-29.9)");
    }
  }

  // Riesgo por perímetro de cintura
  if (waistCirc && sex) {
    const limit = sex === "Masculino" ? 90 : 80;
    if (Number(waistCirc) >= limit) {
      riskScore += 1;
      factors.push("Perímetro de cintura elevado");
    }
  }

  // Riesgo por resultados SFT bajos
  if (sftResults && sftResults.length > 0) {
    const belowCount = sftResults.filter(r => r.classification === "below").length;
    if (belowCount >= 4) {
      riskScore += 3;
      factors.push("Condición física muy baja (4+ pruebas por debajo)");
    } else if (belowCount >= 2) {
      riskScore += 2;
      factors.push("Condición física baja (2-3 pruebas por debajo)");
    } else if (belowCount >= 1) {
      riskScore += 1;
    }
  }

  // Clasificación del riesgo
  let level, color, recommendation;
  if (riskScore >= 10) {
    level = "Muy Alto";
    color = "bg-red-600";
    recommendation = "Se requiere supervisión médica permanente. Actividad física solo bajo prescripción médica individualizada. Priorizar control de factores de riesgo cardiovascular.";
  } else if (riskScore >= 7) {
    level = "Alto";
    color = "bg-red-500";
    recommendation = "Requiere valoración médica antes de iniciar programa de ejercicio. Se recomienda actividad supervisada de baja intensidad con monitoreo de signos vitales.";
  } else if (riskScore >= 4) {
    level = "Moderado";
    color = "bg-orange-500";
    recommendation = "Puede realizar actividad física moderada con supervisión. Se recomienda programa progresivo y control periódico de patologías.";
  } else if (riskScore >= 2) {
    level = "Bajo";
    color = "bg-yellow-500";
    recommendation = "Puede participar en programas de actividad física grupal con las precauciones estándar. Mantener controles de salud periódicos.";
  } else {
    level = "Mínimo";
    color = "bg-green-500";
    recommendation = "Perfil favorable para actividad física regular. Se recomienda mantener hábitos saludables y evaluaciones anuales.";
  }

  return {
    score: riskScore,
    level,
    color,
    factors,
    recommendation,
  };
}

/**
 * Genera recomendaciones específicas según las patologías
 */
export function getPathologyRecommendations(selectedPathologies) {
  const recs = [];

  if (selectedPathologies.includes("hipertension")) {
    recs.push({
      pathology: "Hipertensión",
      precautions: "Evitar ejercicios isométricos intensos. Controlar presión arterial antes y después del ejercicio. No realizar actividad si PA > 160/100 mmHg.",
      recommended: "Caminata, natación, ejercicios aeróbicos de baja-moderada intensidad.",
    });
  }

  if (selectedPathologies.includes("diabetes")) {
    recs.push({
      pathology: "Diabetes tipo 2",
      precautions: "Monitorear glucemia antes del ejercicio. Llevar fuente de glucosa rápida. Evitar ejercicio en ayunas prolongado.",
      recommended: "Ejercicio aeróbico regular (150 min/semana), ejercicios de resistencia 2-3 veces/semana.",
    });
  }

  if (selectedPathologies.includes("osteoporosis")) {
    recs.push({
      pathology: "Osteoporosis",
      precautions: "Evitar flexiones de tronco pronunciadas, torsiones bruscas y ejercicios de alto impacto. Cuidar riesgo de caídas.",
      recommended: "Ejercicios de equilibrio, caminata, ejercicios de fuerza con carga moderada.",
    });
  }

  if (selectedPathologies.includes("artrosis")) {
    recs.push({
      pathology: "Artrosis",
      precautions: "Evitar ejercicios de alto impacto articular. Respetar el dolor como señal de detención. Calentamiento prolongado.",
      recommended: "Ejercicios acuáticos, bicicleta estática, ejercicios de rango de movimiento.",
    });
  }

  if (selectedPathologies.includes("cardiovascular")) {
    recs.push({
      pathology: "Enfermedad cardiovascular",
      precautions: "Requiere autorización médica. Monitoreo de frecuencia cardíaca continuo. Detener ante dolor torácico, disnea o arritmia.",
      recommended: "Caminata supervisada, ejercicio aeróbico de baja intensidad con progresión gradual.",
    });
  }

  if (selectedPathologies.includes("respiratoria")) {
    recs.push({
      pathology: "Enfermedad respiratoria",
      precautions: "Monitorear saturación de oxígeno. Tener broncodilatador disponible. Evitar ambientes contaminados o extremos.",
      recommended: "Ejercicios respiratorios, caminata con pausas, ejercicio aeróbico intervalado de baja intensidad.",
    });
  }

  if (selectedPathologies.includes("sedentarismo")) {
    recs.push({
      pathology: "Sedentarismo",
      precautions: "Inicio muy gradual. Aumentar duración antes que intensidad. Vigilar respuesta cardiovascular.",
      recommended: "Comenzar con 10-15 min de caminata diaria e ir progresando. Meta: 150 min/semana de actividad moderada.",
    });
  }

  return recs;
}
