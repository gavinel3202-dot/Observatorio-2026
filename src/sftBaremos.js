/**
 * Baremos del Senior Fitness Test (SFT) - Rikli & Jones
 * Rangos normales por edad y sexo (percentiles 25-75)
 * Edades: 60-64, 65-69, 70-74, 75-79, 80-84, 85-89, 90-94
 */

// Mujeres - Rangos normales
const WOMEN = {
  chairStand: [
    [12, 17], [11, 16], [10, 15], [10, 15], [9, 14], [8, 13], [4, 11],
  ],
  armCurl: [
    [13, 19], [12, 18], [12, 17], [11, 17], [10, 16], [10, 15], [8, 13],
  ],
  sixMinWalk: [
    [545, 660], [500, 635], [480, 615], [435, 585], [385, 540], [340, 510], [275, 440],
  ],
  twoMinStep: [
    [75, 107], [73, 107], [68, 101], [68, 100], [60, 90], [55, 85], [44, 72],
  ],
  sitAndReach: [
    [-0.5, 5.0], [-0.5, 4.5], [-1.0, 4.0], [-1.5, 3.5], [-2.0, 3.0], [-2.5, 2.5], [-4.5, 1.0],
  ],
  backScratch: [
    [-3.0, 1.5], [-3.5, 1.5], [-4.0, 1.0], [-5.0, 0.5], [-5.5, 0.0], [-7.0, -1.0], [-8.0, -1.0],
  ],
  upAndGo: [
    [6.0, 4.4], [6.4, 4.8], [7.1, 4.9], [7.4, 5.2], [8.7, 5.7], [9.6, 6.2], [11.5, 7.3],
  ],
};

// Hombres - Rangos normales
const MEN = {
  chairStand: [
    [14, 19], [12, 18], [12, 17], [11, 17], [10, 15], [8, 14], [7, 12],
  ],
  armCurl: [
    [16, 22], [15, 21], [14, 21], [13, 19], [13, 19], [11, 17], [10, 14],
  ],
  sixMinWalk: [
    [610, 735], [560, 700], [545, 680], [470, 640], [445, 605], [380, 570], [305, 500],
  ],
  twoMinStep: [
    [87, 115], [86, 116], [80, 110], [73, 109], [71, 103], [59, 91], [52, 86],
  ],
  sitAndReach: [
    [-2.5, 4.0], [-3.0, 3.0], [-3.0, 3.0], [-4.0, 2.0], [-5.5, 1.5], [-5.5, 0.5], [-6.5, -0.5],
  ],
  backScratch: [
    [-6.5, 0.0], [-7.5, -1.0], [-8.0, -1.0], [-9.0, -2.0], [-9.5, -2.0], [-9.5, -3.0], [-10.5, -4.0],
  ],
  upAndGo: [
    [5.6, 3.8], [5.9, 4.3], [6.2, 4.4], [7.2, 4.6], [7.6, 5.2], [8.9, 5.5], [10.0, 6.2],
  ],
};

const AGE_GROUPS = ["60-64", "65-69", "70-74", "75-79", "80-84", "85-89", "90-94"];

function getAgeIndex(age) {
  const a = Number(age);
  if (a >= 60 && a <= 64) return 0;
  if (a >= 65 && a <= 69) return 1;
  if (a >= 70 && a <= 74) return 2;
  if (a >= 75 && a <= 79) return 3;
  if (a >= 80 && a <= 84) return 4;
  if (a >= 85 && a <= 89) return 5;
  if (a >= 90 && a <= 94) return 6;
  return -1;
}

/**
 * Evalua un test SFT contra los baremos.
 * Retorna: "Por debajo", "Normal", "Por encima" y el rango de referencia.
 */
export function evaluateSFT(testId, rawValue, age, sex) {
  if (rawValue === "" || rawValue === undefined || rawValue === null) return null;
  if (!age || !sex) return null;

  const idx = getAgeIndex(age);
  if (idx === -1) return { classification: "Edad fuera de rango", range: null, score: 0 };

  const val = Number(rawValue);
  const isMan = sex === "Hombre";
  const table = isMan ? MEN : WOMEN;

  let range;
  let isInverse = false;

  switch (testId) {
    case "chairStand":
      range = table.chairStand[idx];
      break;
    case "armCurl":
      range = table.armCurl[idx];
      break;
    case "sixMinWalk":
      range = table.sixMinWalk[idx];
      break;
    case "twoMinStep":
      range = table.twoMinStep[idx];
      break;
    case "sitAndReach":
      range = table.sitAndReach[idx];
      break;
    case "backScratch":
      range = table.backScratch[idx];
      break;
    case "upAndGo":
      range = table.upAndGo[idx];
      isInverse = true;
      break;
    default:
      return null;
  }

  if (!range) return null;

  let classification;
  let score;

  if (isInverse) {
    // En Up-and-Go, menor tiempo es mejor. range = [max_normal, min_normal]
    if (val <= range[1]) {
      classification = "Por encima del rango normal";
      score = 5;
    } else if (val <= range[0]) {
      classification = "Dentro del rango normal";
      score = 3;
    } else {
      classification = "Por debajo del rango normal";
      score = 1;
    }
  } else {
    if (val > range[1]) {
      classification = "Por encima del rango normal";
      score = 5;
    } else if (val >= range[0]) {
      classification = "Dentro del rango normal";
      score = 3;
    } else {
      classification = "Por debajo del rango normal";
      score = 1;
    }
  }

  return { classification, range, score };
}

export const SFT_TESTS = [
  {
    id: "chairStand",
    name: "Chair Stand Test",
    fullName: "Sentarse y levantarse de una silla",
    description: "Evaluar la fuerza del tren inferior",
    unit: "repeticiones",
    placeholder: "Ej: 14",
    instructions: "El participante se levanta y sienta completamente durante 30 segundos.",
  },
  {
    id: "armCurl",
    name: "Arm Curl Test",
    fullName: "Flexiones del brazo",
    description: "Evaluar la fuerza del tren superior",
    unit: "repeticiones",
    placeholder: "Ej: 16",
    instructions: "Flexiones de brazo con mancuerna (5 lb mujeres, 8 lb hombres) durante 30 segundos.",
  },
  {
    id: "twoMinStep",
    name: "2-Minute Step Test",
    fullName: "Marcha en el sitio 2 minutos",
    description: "Evaluacion de la resistencia aerobica",
    unit: "pasos",
    placeholder: "Ej: 85",
    instructions: "Marcha en el sitio durante 2 minutos, elevando rodillas a la altura media del muslo.",
  },
  {
    id: "sitAndReach",
    name: "Sit and Reach Test (Chair)",
    fullName: "Sentado y alcanzar el pie",
    description: "Evaluar la flexibilidad del tren inferior",
    unit: "pulgadas",
    placeholder: "Ej: 2.5",
    instructions: "Sentado en el borde de la silla, extender la pierna y alcanzar los dedos del pie.",
  },
  {
    id: "backScratch",
    name: "Back Scratch Test",
    fullName: "Alcanzar manos tras la espalda",
    description: "Evaluar la flexibilidad del tren superior (hombro)",
    unit: "pulgadas",
    placeholder: "Ej: -2.0",
    instructions: "Intentar que se toquen las manos por detras de la espalda (una por arriba y otra por abajo).",
  },
  {
    id: "upAndGo",
    name: "Foot Up-and-Go Test",
    fullName: "Levantarse, caminar y volverse a sentar",
    description: "Evaluar la agilidad y el equilibrio dinamico",
    unit: "segundos",
    placeholder: "Ej: 5.8",
    instructions: "Levantarse de la silla, caminar 2.44m, dar la vuelta y volver a sentarse.",
  },
  {
    id: "sixMinWalk",
    name: "6-Minute Walk Test",
    fullName: "Caminar 6 minutos",
    description: "Evaluacion de la resistencia aerobica (alternativa)",
    unit: "yardas",
    placeholder: "Ej: 580",
    instructions: "Caminar lo mas rapido posible durante 6 minutos en un circuito rectangular.",
  },
];

export { AGE_GROUPS, getAgeIndex };
