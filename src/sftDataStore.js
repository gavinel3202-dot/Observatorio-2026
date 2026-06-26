import {
  collection,
  doc,
  addDoc as firestoreAddDoc,
  updateDoc,
  deleteDoc,
  onSnapshot as firestoreOnSnapshot,
} from "firebase/firestore";
import {
  firebaseEnabled,
  signIn,
  db,
  appId,
} from "./firebase";

const LS_KEY = "sft_evaluaciones";
const LS_EVENT = "sft_evaluaciones_updated";
const COLLECTION_PATH = ["artifacts", appId, "public", "data", "evaluaciones_sft"];

function getCollectionRef() {
  return collection(db, ...COLLECTION_PATH);
}

function readLocal() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeLocal(records) {
  localStorage.setItem(LS_KEY, JSON.stringify(records));
  window.dispatchEvent(new Event(LS_EVENT));
}

export function subscribeRecords(callback) {
  if (firebaseEnabled) {
    let cancelled = false;
    let unsubscribe = () => {};
    signIn()
      .then(() => {
        if (cancelled) return;
        unsubscribe = firestoreOnSnapshot(
          getCollectionRef(),
          (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
          (error) => console.error("Error en listener SFT Firestore:", error)
        );
      })
      .catch((error) => console.error("Error auth Firebase SFT:", error));
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }

  const emit = () => callback(readLocal());
  emit();
  window.addEventListener(LS_EVENT, emit);
  window.addEventListener("storage", emit);
  return () => {
    window.removeEventListener(LS_EVENT, emit);
    window.removeEventListener("storage", emit);
  };
}

export async function addRecord(record) {
  if (firebaseEnabled) {
    await signIn();
    await firestoreAddDoc(getCollectionRef(), record);
    return;
  }
  const records = readLocal();
  records.push({ id: `local-${Date.now()}`, ...record });
  writeLocal(records);
}

export async function updateRecord(id, record) {
  if (firebaseEnabled) {
    await signIn();
    const docRef = doc(db, ...COLLECTION_PATH, id);
    await updateDoc(docRef, record);
    return;
  }
  const records = readLocal();
  const index = records.findIndex((r) => r.id === id);
  if (index !== -1) {
    records[index] = { ...records[index], ...record };
    writeLocal(records);
  }
}

export async function deleteRecord(id) {
  if (firebaseEnabled) {
    await signIn();
    const docRef = doc(db, ...COLLECTION_PATH, id);
    await deleteDoc(docRef);
    return;
  }
  const records = readLocal().filter((r) => r.id !== id);
  writeLocal(records);
}

export { firebaseEnabled };
