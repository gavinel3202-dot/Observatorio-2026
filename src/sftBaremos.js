/**
 * Baremos del Senior Fitness Test (Rikli & Jones)
 * Intervalos normales (percentil 25 - percentil 75) por sexo y grupo de edad.
 * Fuente: Estudio nacional a más de 7.000 personas mayores (60-94 años).
 *
 * Nota: Los datos de flexibilidad están en pulgadas (original). Los convertimos
 * internamente para comparación; la calculadora recibe datos en cm y los convierte.
 */

// Chair Stand Test - repeticiones en 30 segundos
export const chairStandBaremos = {
  mujeres: {
    "60-64": [12, 17], "65-69": [11, 16], "70-74": [10, 15],
    "75-79": [10, 15], "80-84": [9, 14], "85-89": [8, 13], "90-94": [4, 11],
  },
  hombres: {
    "60-64": [14, 19], "65-69": [12, 18], "70-74": [12, 17],
    "75-79": [11, 17], "80-84": [10, 15], "85-89": [8, 14], "90-94": [7, 12],
  },
};

// Arm Curl Test - repeticiones en 30 segundos
export const armCurlBaremos = {
  mujeres: {
    "60-64": [13, 19], "65-69": [12, 18], "70-74": [12, 17],
    "75-79": [11, 17], "80-84": [10, 16], "85-89": [10, 15], "90-94": [8, 13],
  },
  hombres: {
    "60-64": [16, 22], "65-69": [15, 21], "70-74": [14, 21],
    "75-79": [13, 19], "80-84": [13, 19], "85-89": [11, 17], "90-94": [10, 14],
  },
};

// 6-Minute Walk Test - yardas
export const walkTestBaremos = {
  mujeres: {
    "60-64": [545, 660], "65-69": [500, 635], "70-74": [480, 615],
    "75-79": [435, 585], "80-84": [385, 540], "85-89": [340, 510], "90-94": [275, 440],
  },
  hombres: {
    "60-64": [610, 735], "65-69": [560, 700], "70-74": [545, 680],
    "75-79": [470, 640], "80-84": [445, 605], "85-89": [380, 570], "90-94": [305, 500],
  },
};

// 2-Minute Step Test - pasos
export const stepTestBaremos = {
  mujeres: {
    "60-64": [75, 107], "65-69": [73, 107], "70-74": [68, 101],
    "75-79": [68, 100], "80-84": [60, 90], "85-89": [55, 85], "90-94": [44, 72],
  },
  hombres: {
    "60-64": [87, 115], "65-69": [86, 116], "70-74": [80, 110],
    "75-79": [73, 109], "80-84": [71, 103], "85-89": [59, 91], "90-94": [52, 86],
  },
};

// Chair Sit-and-Reach Test - pulgadas (valores negativos y positivos)
export const sitReachBaremos = {
  mujeres: {
    "60-64": [-0.5, 5.0], "65-69": [-0.5, 4.5], "70-74": [-1.0, 4.0],
    "75-79": [-1.5, 3.5], "80-84": [-2.0, 3.0], "85-89": [-2.5, 2.5], "90-94": [-4.5, 1.0],
  },
  hombres: {
    "60-64": [-2.5, 4.0], "65-69": [-3.0, 3.0], "70-74": [-3.0, 3.0],
    "75-79": [-4.0, 2.0], "80-84": [-5.5, 1.5], "85-89": [-5.5, 0.5], "90-94": [-6.5, -0.5],
  },
};

// Back Scratch Test - pulgadas
export const backScratchBaremos = {
  mujeres: {
    "60-64": [-3.0, 1.5], "65-69": [-3.5, 1.5], "70-74": [-4.0, 1.0],
    "75-79": [-5.0, 0.5], "80-84": [-5.5, 0.0], "85-89": [-7.0, -1.0], "90-94": [-8.0, -1.0],
  },
  hombres: {
    "60-64": [-6.5, 0.0], "65-69": [-7.5, -1.0], "70-74": [-8.0, -1.0],
    "75-79": [-9.0, -2.0], "80-84": [-9.5, -2.0], "85-89": [-9.5, -3.0], "90-94": [-10.5, -4.0],
  },
};

// 8-Foot Up-and-Go Test - segundos (menor es mejor)
export const upAndGoBaremos = {
  mujeres: {
    "60-64": [4.4, 6.0], "65-69": [4.8, 6.4], "70-74": [4.9, 7.1],
    "75-79": [5.2, 7.4], "80-84": [5.7, 8.7], "85-89": [6.2, 9.6], "90-94": [7.3, 11.5],
  },
  hombres: {
    "60-64": [3.8, 5.6], "65-69": [4.3, 5.9], "70-74": [4.4, 6.2],
    "75-79": [4.6, 7.2], "80-84": [5.2, 7.6], "85-89": [5.5, 8.9], "90-94": [6.2, 10.0],
  },
};

/**
 * Determina el grupo de edad para baremos SFT
 */
export function getAgeGroup(age) {
  const a = Number(age);
  if (a >= 60 && a <= 64) return "60-64";
  if (a >= 65 && a <= 69) return "65-69";
  if (a >= 70 && a <= 74) return "70-74";
  if (a >= 75 && a <= 79) return "75-79";
  if (a >= 80 && a <= 84) return "80-84";
  if (a >= 85 && a <= 89) return "85-89";
  if (a >= 90 && a <= 94) return "90-94";
  return null;
}

/**
 * Clasifica un resultado según los baremos SFT.
 * Retorna: "below" | "normal" | "above" | null
 */
export function classifyResult(value, baremoTable, sex, age) {
  const group = getAgeGroup(age);
  if (!group) return null;

  const key = sex === "Masculino" ? "hombres" : "mujeres";
  const range = baremoTable[key]?.[group];
  if (!range) return null;

  const v = Number(value);
  if (isNaN(v)) return null;

  if (v < range[0]) return "below";
  if (v > range[1]) return "above";
  return "normal";
}

/**
 * Clasifica Up-and-Go (menor es mejor)
 */
export function classifyUpAndGo(value, sex, age) {
  const group = getAgeGroup(age);
  if (!group) return null;

  const key = sex === "Masculino" ? "hombres" : "mujeres";
  const range = upAndGoBaremos[key]?.[group];
  if (!range) return null;

  const v = Number(value);
  if (isNaN(v)) return null;

  // range[0] is best (P75), range[1] is worst (P25)
  if (v < range[0]) return "above";
  if (v > range[1]) return "below";
  return "normal";
}

/**
 * Convierte cm a pulgadas para comparación con baremos
 */
export function cmToInches(cm) {
  return Number(cm) / 2.54;
}

/**
 * IMC según OMS
 */
export function calculateIMC(weightKg, heightCm) {
  if (!weightKg || !heightCm) return null;
  const h = Number(heightCm) / 100;
  const w = Number(weightKg);
  if (h <= 0 || w <= 0) return null;
  return w / (h * h);
}

export function classifyIMC(imc) {
  if (imc === null) return null;
  if (imc < 18.5) return { label: "Bajo peso", risk: "alto", color: "text-yellow-600" };
  if (imc < 25) return { label: "Normal", risk: "bajo", color: "text-green-600" };
  if (imc < 30) return { label: "Sobrepeso", risk: "moderado", color: "text-orange-500" };
  return { label: "Obesidad", risk: "alto", color: "text-red-600" };
}

/**
 * Riesgo por perímetro de cintura
 */
export function waistRisk(circumference, sex) {
  const v = Number(circumference);
  if (!v || !sex) return null;
  if (sex === "Masculino") {
    return v >= 90 ? { risk: "Elevado", color: "text-red-600" } : { risk: "Normal", color: "text-green-600" };
  }
  return v >= 80 ? { risk: "Elevado", color: "text-red-600" } : { risk: "Normal", color: "text-green-600" };
}

/**
 * Evaluación integral SFT: retorna un resumen con clasificaciones
 */
export function evaluateSFT(data, sex, age) {
  const results = [];

  // Chair Stand
  if (data.chairStand) {
    const cls = classifyResult(data.chairStand, chairStandBaremos, sex, age);
    results.push({ test: "Sentarse y levantarse", value: data.chairStand, unit: "rep", classification: cls });
  }

  // Arm Curl
  if (data.armCurl) {
    const cls = classifyResult(data.armCurl, armCurlBaremos, sex, age);
    results.push({ test: "Flexiones del brazo", value: data.armCurl, unit: "rep", classification: cls });
  }

  // 6-Min Walk
  if (data.walkTest) {
    const cls = classifyResult(data.walkTest, walkTestBaremos, sex, age);
    results.push({ test: "Caminar 6 minutos", value: data.walkTest, unit: "yardas", classification: cls });
  }

  // 2-Min Step
  if (data.stepTest) {
    const cls = classifyResult(data.stepTest, stepTestBaremos, sex, age);
    results.push({ test: "2 minutos marcha", value: data.stepTest, unit: "pasos", classification: cls });
  }

  // Sit-and-Reach (convert cm to inches for comparison)
  if (data.sitReach !== "" && data.sitReach !== undefined) {
    const inchVal = cmToInches(data.sitReach);
    const cls = classifyResult(inchVal, sitReachBaremos, sex, age);
    results.push({ test: "Flexión tronco en silla", value: data.sitReach, unit: "cm", classification: cls });
  }

  // Back Scratch (convert cm to inches)
  if (data.backScratch !== "" && data.backScratch !== undefined) {
    const inchVal = cmToInches(data.backScratch);
    const cls = classifyResult(inchVal, backScratchBaremos, sex, age);
    results.push({ test: "Alcanzar manos espalda", value: data.backScratch, unit: "cm", classification: cls });
  }

  // Up-and-Go
  if (data.upAndGo) {
    const cls = classifyUpAndGo(data.upAndGo, sex, age);
    results.push({ test: "Levantarse, caminar, sentarse", value: data.upAndGo, unit: "seg", classification: cls });
  }

  return results;
}
