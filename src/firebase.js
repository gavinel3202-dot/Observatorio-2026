import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
} from "firebase/firestore";

function readConfig() {
  const env = import.meta.env;

  // Opción A: configuración como un único JSON en VITE_FIREBASE_CONFIG.
  if (env.VITE_FIREBASE_CONFIG) {
    try {
      return JSON.parse(env.VITE_FIREBASE_CONFIG);
    } catch (err) {
      console.error("VITE_FIREBASE_CONFIG no es un JSON válido:", err);
    }
  }

  // Opción B: variables sueltas (compatible con el deploy existente en Vercel).
  if (env.VITE_FIREBASE_API_KEY && env.VITE_FIREBASE_PROJECT_ID) {
    return {
      apiKey: env.VITE_FIREBASE_API_KEY,
      authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: env.VITE_FIREBASE_APP_ID,
    };
  }

  return null;
}

const firebaseConfig = readConfig();
const app = firebaseConfig ? initializeApp(firebaseConfig) : null;

export const firebaseEnabled = Boolean(app);
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
export const appId = import.meta.env.VITE_APP_ID || "icfg-app-id";

const COLLECTION_PATH = [
  "artifacts",
  appId,
  "public",
  "data",
  "evaluaciones_icfg",
];

let signInPromise = null;

export function signIn() {
  if (!auth) return Promise.resolve();
  if (auth.currentUser) return Promise.resolve(auth.currentUser);
  if (!signInPromise) {
    signInPromise = signInAnonymously(auth).catch((err) => {
      signInPromise = null;
      throw err;
    });
  }
  return signInPromise;
}

export function evaluacionesRef() {
  return collection(db, ...COLLECTION_PATH);
}

export { addDoc, onSnapshot };
