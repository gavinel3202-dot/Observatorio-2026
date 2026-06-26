import {
  firebaseEnabled,
  signIn,
  evaluacionesRef,
  addDoc,
  onSnapshot,
  updateDocById,
  deleteDocById,
} from "./firebase";

const LS_KEY = "sft_evaluaciones";
const LS_EVENT = "sft_evaluaciones_updated";

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
 * Update an existing record.
 */
export async function updateRecord(id, data) {
  if (firebaseEnabled) {
    await signIn();
    await updateDocById(id, data);
    return;
  }
  const records = readLocal();
  const idx = records.findIndex(r => r.id === id);
  if (idx !== -1) {
    records[idx] = { ...records[idx], ...data };
    writeLocal(records);
  }
}

/**
 * Delete a record.
 */
export async function deleteRecord(id) {
  if (firebaseEnabled) {
    await signIn();
    await deleteDocById(id);
    return;
  }
  const records = readLocal().filter(r => r.id !== id);
  writeLocal(records);
}

export { firebaseEnabled };
