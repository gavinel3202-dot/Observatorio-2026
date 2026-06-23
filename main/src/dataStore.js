import {
  firebaseEnabled,
  signIn,
  evaluacionesRef,
  addDoc,
  onSnapshot,
} from "./firebase";

const LS_KEY = "icfg_evaluaciones";
const LS_EVENT = "icfg_evaluaciones_updated";

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

/**
 * Subscribe to the live list of evaluations.
 * Returns an unsubscribe function.
 */
export function subscribeRecords(callback) {
  if (firebaseEnabled) {
    let cancelled = false;
    let unsubscribe = () => {};
    signIn()
      .then(() => {
        if (cancelled) return;
        unsubscribe = onSnapshot(
          evaluacionesRef(),
          (snap) =>
            callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
          (error) => console.error("Error en el listener de Firestore:", error)
        );
      })
      .catch((error) =>
        console.error("Error de autenticación con Firebase:", error)
      );
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

/**
 * Persist a new evaluation record.
 */
export async function addRecord(record) {
  if (firebaseEnabled) {
    await signIn();
    await addDoc(evaluacionesRef(), record);
    return;
  }
  const records = readLocal();
  records.push({ id: `local-${Date.now()}`, ...record });
  writeLocal(records);
}

/**
 * Update an existing evaluation record.
 */
export async function updateRecord(recordId, updatedData) {
  if (firebaseEnabled) {
    // Firebase update would be handled here if needed
    // For now, we'll work with localStorage for local records
    const records = readLocal();
    const index = records.findIndex(r => r.id === recordId);
    if (index !== -1) {
      records[index] = { ...records[index], ...updatedData };
      writeLocal(records);
    }
    return;
  }
  const records = readLocal();
  const index = records.findIndex(r => r.id === recordId);
  if (index !== -1) {
    records[index] = { ...records[index], ...updatedData };
    writeLocal(records);
  }
}

/**
 * Delete an existing evaluation record.
 */
export async function deleteRecord(recordId) {
  if (firebaseEnabled) {
    // Firebase delete would be handled here if needed
    const records = readLocal();
    const filtered = records.filter(r => r.id !== recordId);
    writeLocal(filtered);
    return;
  }
  const records = readLocal();
  const filtered = records.filter(r => r.id !== recordId);
  writeLocal(filtered);
}

export { firebaseEnabled };
