import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  ChevronDown, ChevronRight, FolderOpen, Plus, CheckCircle2, Clock3,
  Users, Shield, Search, BarChart3, X, FolderPlus, Link as LinkIcon,
  Check, Cloud, Wifi, WifiOff, RefreshCw, MessageCircle, Activity,
  Eye, Send,
} from 'lucide-react';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import {
  addDoc, collection, doc, getDoc, getFirestore, onSnapshot,
  orderBy, query, serverTimestamp, setDoc, updateDoc, deleteDoc,
  limit,
} from 'firebase/firestore';

// ─── Config ────────────────────────────────────────────────────────────────
const estructuraBase = [
  { nombre: 'INVESTIGACIÓN', color: 'from-blue-600 to-cyan-400', subcarpetas: ['DYC','HYP','IDAD','EFICIENCIA','ENVEJECIMIENTO ACTIVO','ADRENALINA'] },
  { nombre: 'POLITICA PÚBLICA', color: 'from-emerald-600 to-lime-400', subcarpetas: ['Lineamientos','Seguimiento','Evaluación'] },
  { nombre: 'INTERISTITUCIONAL', color: 'from-amber-500 to-orange-400', subcarpetas: ['Alianzas','Convenios','Articulación'] },
];
const usuariosBase = ['Nelson (Administrador)','Equipo Investigación','Equipo Política Pública','Enlace Interinstitucional','Apoyo Técnico'];
const tareasIniciales = [
  { id:'demo-1', titulo:'Diseñar matriz base de indicadores', descripcion:'Construcción inicial del esquema de seguimiento para el observatorio.', categoria:'INVESTIGACIÓN', subcarpeta:'DYC', responsable:'Equipo Investigación', prioridad:'Alta', progreso:65, estado:'En proceso', fecha:'2026-03-20', createdAtMs: Date.now()-3000 },
  { id:'demo-2', titulo:'Revisión de lineamientos territoriales', descripcion:'Cruce de información normativa y técnica.', categoria:'POLITICA PÚBLICA', subcarpeta:'Lineamientos', responsable:'Equipo Política Pública', prioridad:'Media', progreso:35, estado:'En proceso', fecha:'2026-03-25', createdAtMs: Date.now()-2000 },
  { id:'demo-3', titulo:'Mesa con aliados institucionales', descripcion:'Agenda de articulación y compromisos de seguimiento.', categoria:'INTERISTITUCIONAL', subcarpeta:'Alianzas', responsable:'Enlace Interinstitucional', prioridad:'Alta', progreso:100, estado:'Finalizada', fecha:'2026-03-12', createdAtMs: Date.now()-1000 },
];

// ─── Helpers ────────────────────────────────────────────────────────────────
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function storageKey(base, ws) { return `${base}::${ws}`; }
function safeParse(v, fb) { try { return v ? JSON.parse(v) : fb; } catch { return fb; } }
function estadoDesdeProgreso(p) { if (p >= 100) return 'Finalizada'; if (p > 0) return 'En proceso'; return 'Pendiente'; }
function relTime(ts) {
  if (!ts) return '';
  const d = Date.now() - (ts?.toMillis?.() ?? ts);
  if (d < 60000) return 'ahora';
  if (d < 3600000) return `${Math.floor(d/60000)}m`;
  if (d < 86400000) return `${Math.floor(d/3600000)}h`;
  return `${Math.floor(d/86400000)}d`;
}
function getFirebaseConfig() {
  const env = typeof import.meta !== 'undefined' ? import.meta.env || {} : {};
  const config = {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  };
  return config?.apiKey && config?.projectId && config?.appId ? config : null;
}

// ─── Sub-components ─────────────────────────────────────────────────────────
function ProgressRing({ value }) {
  const v = clamp(Number(value) || 0, 0, 100);
  return (
    <div className="relative flex h-20 w-20 items-center justify-center rounded-full">
      <div className="absolute inset-0 rounded-full" style={{ background: `conic-gradient(#2563eb ${v*3.6}deg, #e2e8f0 0deg)` }} />
      <div className="absolute inset-[6px] rounded-full bg-white" />
      <div className="relative text-center">
        <div className="text-xl font-black text-slate-800">{v}%</div>
        <div className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Logro</div>
      </div>
    </div>
  );
}
function BarraProgreso({ value }) {
  const v = clamp(Number(value) || 0, 0, 100);
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
      <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-400 transition-all duration-500" style={{ width: `${v}%` }} />
    </div>
  );
}

// ─── Presence dot ───────────────────────────────────────────────────────────
function PresenceDot({ nombre }) {
  const colors = ['bg-blue-500','bg-emerald-500','bg-amber-500','bg-rose-500','bg-purple-500'];
  const idx = usuariosBase.indexOf(nombre) % colors.length;
  const initials = nombre.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  return (
    <div title={nombre} className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white ${colors[idx < 0 ? 0 : idx]}`}>
      {initials}
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────
export default function TableroControlTareas() {
  const [workspace] = useState(() => {
    if (typeof window === 'undefined') return 'equipo-observatorio';
    return new URL(window.location.href).searchParams.get('workspace') || 'equipo-observatorio';
  });
  const firebaseConfig = useMemo(() => getFirebaseConfig(), []);
  const firebaseServices = useMemo(() => {
    if (!firebaseConfig) return null;
    const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    return { app, auth: getAuth(app), db: getFirestore(app) };
  }, [firebaseConfig]);

  const [usuarioSesion, setUsuarioSesion] = useState(null);
  const [nombreUsuario, setNombreUsuario] = useState(() => {
    if (typeof window === 'undefined') return 'Nelson (Administrador)';
    return localStorage.getItem('obs_nombre') || 'Nelson (Administrador)';
  });
  const [modoConexion, setModoConexion] = useState(firebaseServices ? 'firebase' : 'local');
  const [cargandoNube, setCargandoNube] = useState(Boolean(firebaseServices));
  const [estadoNube, setEstadoNube] = useState(firebaseServices ? 'Conectando…' : 'Modo local');
  const [presencia, setPresencia] = useState([]);
  const [categorias, setCategorias] = useState(() =>
    safeParse(typeof window !== 'undefined' ? localStorage.getItem(storageKey('obs_cats', workspace)) : null, estructuraBase)
  );
  const [tareas, setTareas] = useState(() =>
    safeParse(typeof window !== 'undefined' ? localStorage.getItem(storageKey('obs_tareas', workspace)) : null, tareasIniciales)
  );
  const [actividad, setActividad] = useState([]);
  const [editandoTarea, setEditandoTarea] = useState({}); // tareaId -> { campo, valor, uid }

  // UI state
  const [exploradorAbierto, setExploradorAbierto] = useState(true);
  const [categoriasAbiertas, setCategoriasAbiertas] = useState({ INVESTIGACIÓN: true });
  const [subcarpetasAbiertas, setSubcarpetasAbiertas] = useState({ 'INVESTIGACIÓN::DYC': true });
  const [mostrarModal, setMostrarModal] = useState(false);
  const [mostrarModalSub, setMostrarModalSub] = useState(false);
  const [mostrarChat, setMostrarChat] = useState(null); // tareaId
  const [busqueda, setBusqueda] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('Todas');
  const [filtroResponsable, setFiltroResponsable] = useState('Todos');
  const [copyStatus, setCopyStatus] = useState('idle');
  const [nuevaSubcarpeta, setNuevaSubcarpeta] = useState({ categoria: 'INVESTIGACIÓN', nombre: '' });
  const [nuevaTarea, setNuevaTarea] = useState({
    titulo:'', descripcion:'', categoria:'INVESTIGACIÓN', subcarpeta:'DYC',
    responsable:'Equipo Investigación', prioridad:'Media', progreso:0, estado:'Pendiente', fecha:'',
  });
  const inputEnlaceRef = useRef(null);
  const copyTimerRef = useRef(null);
  const presenceTimerRef = useRef(null);

  const enlaceCompartido = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}?workspace=${workspace}`
    : `?workspace=${workspace}`;

  // ── Local persistence ───────────────────────────────────────────────────
  useEffect(() => {
    if (modoConexion === 'local') {
      localStorage.setItem(storageKey('obs_tareas', workspace), JSON.stringify(tareas));
    }
  }, [tareas, workspace, modoConexion]);

  useEffect(() => {
    if (modoConexion === 'local') {
      localStorage.setItem(storageKey('obs_cats', workspace), JSON.stringify(categorias));
    }
  }, [categorias, workspace, modoConexion]);

  // ── Fix subcarpeta when categoria changes in form ───────────────────────
  useEffect(() => {
    const subs = categorias.find(c => c.nombre === nuevaTarea.categoria)?.subcarpetas ?? [];
    if (!subs.includes(nuevaTarea.subcarpeta)) {
      setNuevaTarea(prev => ({ ...prev, subcarpeta: subs[0] || '' }));
    }
  }, [nuevaTarea.categoria]);

  useEffect(() => () => { if (copyTimerRef.current) clearTimeout(copyTimerRef.current); }, []);

  // ── Firebase connection ─────────────────────────────────────────────────
  useEffect(() => {
    if (!firebaseServices) {
      setModoConexion('local');
      setCargandoNube(false);
      setEstadoNube('Firebase no configurado — modo local activo.');
      return;
    }
    const { auth, db } = firebaseServices;
    let unsubWS = () => {}, unsubTareas = () => {}, unsubActivity = () => {}, unsubPresence = () => {};

    const iniciar = async () => {
      try {
        setCargandoNube(true);
        setEstadoNube('Autenticando…');
        await signInAnonymously(auth);
      } catch (e) {
        console.error(e);
        setModoConexion('local');
        setCargandoNube(false);
        setEstadoNube('Error de autenticación — modo local activo.');
      }
    };

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      setUsuarioSesion(user);
      setModoConexion('firebase');
      setEstadoNube('Sincronizando…');

      // Init workspace
      const wsRef = doc(db, 'workspaces', workspace);
      const snap = await getDoc(wsRef);
      if (!snap.exists()) {
        await setDoc(wsRef, { nombre: workspace, categorias: estructuraBase, creadoPor: user.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        for (const t of tareasIniciales) {
          await addDoc(collection(db, 'workspaces', workspace, 'tareas'), { ...t, createdAt: serverTimestamp(), createdAtMs: t.createdAtMs || Date.now(), createdBy: user.uid });
        }
      }

      // Presence: write own presence
      const presRef = doc(db, 'workspaces', workspace, 'presence', user.uid);
      const updatePresence = () => setDoc(presRef, { uid: user.uid, nombre: nombreUsuario, ts: serverTimestamp(), activo: true }, { merge: true });
      updatePresence();
      presenceTimerRef.current = setInterval(updatePresence, 30000);

      // Cleanup presence on unload
      window.addEventListener('beforeunload', () => deleteDoc(presRef));

      // Subscribe workspace (categorias)
      unsubWS = onSnapshot(wsRef, d => { const data = d.data(); if (data?.categorias?.length) setCategorias(data.categorias); });

      // Subscribe tareas
      unsubTareas = onSnapshot(query(collection(db, 'workspaces', workspace, 'tareas'), orderBy('createdAtMs', 'desc')), snap => {
        setTareas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setCargandoNube(false);
        setEstadoNube('Sincronización en tiempo real activa.');
      });

      // Subscribe activity
      unsubActivity = onSnapshot(query(collection(db, 'workspaces', workspace, 'activity'), orderBy('ts', 'desc'), limit(30)), snap => {
        setActividad(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });

      // Subscribe presence
      unsubPresence = onSnapshot(collection(db, 'workspaces', workspace, 'presence'), snap => {
        const now = Date.now();
        setPresencia(snap.docs.map(d => d.data()).filter(p => {
          const ts = p.ts?.toMillis?.() ?? 0;
          return now - ts < 90000;
        }));
      });
    });

    iniciar();
    return () => {
      unsubAuth(); unsubWS(); unsubTareas(); unsubActivity(); unsubPresence();
      if (presenceTimerRef.current) clearInterval(presenceTimerRef.current);
    };
  }, [firebaseServices, workspace]);

  // Update presence when nombre changes
  useEffect(() => {
    localStorage.setItem('obs_nombre', nombreUsuario);
    if (!firebaseServices || !usuarioSesion) return;
    const { db } = firebaseServices;
    const presRef = doc(db, 'workspaces', workspace, 'presence', usuarioSesion.uid);
    setDoc(presRef, { nombre: nombreUsuario, ts: serverTimestamp(), activo: true }, { merge: true });
  }, [nombreUsuario]);

  // ── Activity logger ─────────────────────────────────────────────────────
  const logActivity = useCallback(async (accion, detalle = '') => {
    const entrada = { usuario: nombreUsuario, accion, detalle, ts: serverTimestamp(), tsMs: Date.now() };
    if (modoConexion === 'firebase' && firebaseServices) {
      await addDoc(collection(firebaseServices.db, 'workspaces', workspace, 'activity'), entrada);
    } else {
      setActividad(prev => [{ id: String(Date.now()), ...entrada, ts: { toMillis: () => Date.now() } }, ...prev].slice(0, 30));
    }
  }, [nombreUsuario, modoConexion, firebaseServices, workspace]);

  // ── Computed ────────────────────────────────────────────────────────────
  const tareasFiltradas = useMemo(() => tareas.filter(t => {
    const q = busqueda.toLowerCase();
    const ok1 = !q || t.titulo.toLowerCase().includes(q) || t.descripcion?.toLowerCase().includes(q) || t.subcarpeta.toLowerCase().includes(q);
    const ok2 = filtroCategoria === 'Todas' || t.categoria === filtroCategoria;
    const ok3 = filtroResponsable === 'Todos' || t.responsable === filtroResponsable;
    return ok1 && ok2 && ok3;
  }), [tareas, busqueda, filtroCategoria, filtroResponsable]);

  const resumen = useMemo(() => {
    const total = tareas.length;
    const fin = tareas.filter(t => t.estado === 'Finalizada').length;
    const pend = tareas.filter(t => t.estado === 'Pendiente').length;
    const avg = total ? Math.round(tareas.reduce((a, t) => a + Number(t.progreso || 0), 0) / total) : 0;
    return { metaGeneral: avg, total, finalizadas: fin, pendientes: pend };
  }, [tareas]);

  const avancePorCategoria = useMemo(() => categorias.map(cat => {
    const tc = tareas.filter(t => t.categoria === cat.nombre);
    const avg = tc.length ? Math.round(tc.reduce((a, t) => a + Number(t.progreso || 0), 0) / tc.length) : 0;
    return { ...cat, totalTareas: tc.length, promedio: avg, tareas: tc };
  }), [categorias, tareas]);

  // ── Actions ─────────────────────────────────────────────────────────────
  const persistirCategorias = async (nuevas) => {
    setCategorias(nuevas);
    if (modoConexion !== 'firebase' || !firebaseServices) return;
    await updateDoc(doc(firebaseServices.db, 'workspaces', workspace), { categorias: nuevas, updatedAt: serverTimestamp() });
  };

  const crearTarea = async () => {
    if (!nuevaTarea.titulo.trim()) return;
    const progreso = clamp(Number(nuevaTarea.progreso) || 0, 0, 100);
    const tarea = { ...nuevaTarea, progreso, estado: estadoDesdeProgreso(progreso), createdAtMs: Date.now(), createdBy: usuarioSesion?.uid || 'local' };
    if (modoConexion === 'firebase' && firebaseServices) {
      await addDoc(collection(firebaseServices.db, 'workspaces', workspace, 'tareas'), { ...tarea, createdAt: serverTimestamp() });
    } else {
      setTareas(prev => [{ ...tarea, id: String(Date.now()) }, ...prev]);
    }
    await logActivity('creó tarea', tarea.titulo);
    setCategoriasAbiertas(p => ({ ...p, [tarea.categoria]: true }));
    setSubcarpetasAbiertas(p => ({ ...p, [`${tarea.categoria}::${tarea.subcarpeta}`]: true }));
    setNuevaTarea({ titulo:'', descripcion:'', categoria:'INVESTIGACIÓN', subcarpeta:'DYC', responsable:'Equipo Investigación', prioridad:'Media', progreso:0, estado:'Pendiente', fecha:'' });
    setMostrarModal(false);
  };

  const crearSubcarpeta = async () => {
    const nombre = nuevaSubcarpeta.nombre.trim();
    if (!nombre) return;
    const nuevas = categorias.map(c => {
      if (c.nombre !== nuevaSubcarpeta.categoria) return c;
      if (c.subcarpetas.some(s => s.toLowerCase() === nombre.toLowerCase())) return c;
      return { ...c, subcarpetas: [...c.subcarpetas, nombre] };
    });
    await persistirCategorias(nuevas);
    await logActivity('creó subcarpeta', `${nuevaSubcarpeta.categoria} → ${nombre}`);
    setCategoriasAbiertas(p => ({ ...p, [nuevaSubcarpeta.categoria]: true }));
    setSubcarpetasAbiertas(p => ({ ...p, [`${nuevaSubcarpeta.categoria}::${nombre}`]: true }));
    setNuevaSubcarpeta({ categoria: nuevaSubcarpeta.categoria, nombre: '' });
    setMostrarModalSub(false);
  };

  const actualizarTarea = async (id, campo, valor) => {
    // Broadcast editing indicator
    if (modoConexion === 'firebase' && firebaseServices && usuarioSesion) {
      const presRef = doc(firebaseServices.db, 'workspaces', workspace, 'presence', usuarioSesion.uid);
      setDoc(presRef, { editando: id, ts: serverTimestamp() }, { merge: true });
      setTimeout(() => setDoc(presRef, { editando: null }, { merge: true }), 3000);
    }

    setTareas(prev => prev.map(t => {
      if (t.id !== id) return t;
      const updated = { ...t, [campo]: valor };
      if (campo === 'progreso') { updated.progreso = clamp(Number(valor)||0,0,100); updated.estado = estadoDesdeProgreso(updated.progreso); }
      if (campo === 'estado') {
        if (valor === 'Finalizada') updated.progreso = 100;
        if (valor === 'Pendiente') updated.progreso = 0;
        if (valor === 'En proceso' && Number(t.progreso||0) === 0) updated.progreso = 5;
      }
      return updated;
    }));

    if (modoConexion === 'firebase' && firebaseServices) {
      const actual = tareas.find(t => t.id === id);
      if (!actual) return;
      const payload = { [campo]: valor, updatedAt: serverTimestamp() };
      if (campo === 'progreso') { payload.progreso = clamp(Number(valor)||0,0,100); payload.estado = estadoDesdeProgreso(payload.progreso); }
      if (campo === 'estado') {
        if (valor === 'Finalizada') payload.progreso = 100;
        if (valor === 'Pendiente') payload.progreso = 0;
        if (valor === 'En proceso' && Number(actual.progreso||0) === 0) payload.progreso = 5;
      }
      await updateDoc(doc(firebaseServices.db, 'workspaces', workspace, 'tareas', id), payload);
    }

    const tarea = tareas.find(t => t.id === id);
    await logActivity(`actualizó ${campo}`, `${tarea?.titulo || id}: ${valor}`);
  };

  // ── Comments ────────────────────────────────────────────────────────────
  const [comentarios, setComentarios] = useState({}); // tareaId -> [{...}]
  const [nuevoComentario, setNuevoComentario] = useState({});

  useEffect(() => {
    if (!firebaseServices || modoConexion !== 'firebase') return;
    const { db } = firebaseServices;
    const unsubs = [];
    tareas.forEach(t => {
      const ref = collection(db, 'workspaces', workspace, 'tareas', t.id, 'comentarios');
      const unsub = onSnapshot(query(ref, orderBy('ts', 'asc')), snap => {
        setComentarios(prev => ({ ...prev, [t.id]: snap.docs.map(d => ({ id: d.id, ...d.data() })) }));
      });
      unsubs.push(unsub);
    });
    return () => unsubs.forEach(u => u());
  }, [tareas.length, firebaseServices, modoConexion, workspace]);

  const enviarComentario = async (tareaId) => {
    const texto = (nuevoComentario[tareaId] || '').trim();
    if (!texto) return;
    const entrada = { autor: nombreUsuario, texto, ts: serverTimestamp(), tsMs: Date.now() };
    if (modoConexion === 'firebase' && firebaseServices) {
      await addDoc(collection(firebaseServices.db, 'workspaces', workspace, 'tareas', tareaId, 'comentarios'), entrada);
    } else {
      setComentarios(prev => ({ ...prev, [tareaId]: [...(prev[tareaId]||[]), { id: String(Date.now()), ...entrada, ts: { toMillis: () => Date.now() } }] }));
    }
    const tarea = tareas.find(t => t.id === tareaId);
    await logActivity('comentó en tarea', tarea?.titulo || tareaId);
    setNuevoComentario(prev => ({ ...prev, [tareaId]: '' }));
  };

  // ── Copy link ───────────────────────────────────────────────────────────
  const copiarEnlace = () => {
    const input = inputEnlaceRef.current;
    if (!input) { setCopyStatus('manual'); return; }
    try { input.select(); document.execCommand('copy'); setCopyStatus('success'); }
    catch { setCopyStatus('manual'); }
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopyStatus('idle'), 2500);
  };

  const firebaseReady = modoConexion === 'firebase';

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#eef0f3] p-4 font-sans text-slate-800 md:p-8">
      <div className="mx-auto max-w-7xl">

        {/* Header */}
        <div className="mb-6 rounded-[32px] bg-[#f5f6f8] px-6 py-6 shadow-[0_15px_40px_rgba(15,23,42,0.08)] md:px-8">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-200">
                <Shield className="h-7 w-7" />
              </div>
              <div>
                <h1 className="text-3xl font-extrabold tracking-tight text-slate-800 md:text-4xl">Observatorio 2026</h1>
                <div className="mt-1 inline-flex items-center rounded-full bg-emerald-100 px-3 py-0.5 text-xs font-semibold uppercase tracking-widest text-emerald-700">
                  {firebaseReady ? 'Firebase activo' : 'Modo local'}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {/* Selector de nombre de usuario */}
              <select
                value={nombreUsuario}
                onChange={e => setNombreUsuario(e.target.value)}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm outline-none"
              >
                {usuariosBase.map(u => <option key={u}>{u}</option>)}
              </select>
              <button
                onClick={() => setMostrarModal(true)}
                className="rounded-full bg-slate-900 px-5 py-2 text-sm font-bold text-white shadow"
              >
                + Nueva tarea
              </button>
              <button
                onClick={() => setMostrarModalSub(true)}
                className="rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-bold text-slate-700 shadow-sm"
              >
                + Subcarpeta
              </button>
            </div>
          </div>

          {/* Estado conexión */}
          <div className={`mt-4 rounded-2xl border p-3 ${firebaseReady ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <div className={`rounded-full p-1.5 ${firebaseReady ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  {firebaseReady ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
                </div>
                <div>
                  <div className={`text-xs font-bold uppercase tracking-widest ${firebaseReady ? 'text-emerald-700' : 'text-amber-700'}`}>Estado de colaboración</div>
                  <div className="text-sm text-slate-700">{estadoNube}</div>
                </div>
              </div>
              {/* Presencia */}
              <div className="flex items-center gap-2">
                {presencia.length > 0 ? (
                  <>
                    <span className="text-xs font-semibold text-slate-500">{presencia.length} en línea:</span>
                    <div className="flex -space-x-1">
                      {presencia.map(p => <PresenceDot key={p.uid} nombre={p.nombre} />)}
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600 shadow-sm">
                    <Cloud className="h-3.5 w-3.5" />
                    {firebaseReady ? 'En línea' : 'Local'}
                    {cargandoNube && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Enlace compartido */}
          <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-3">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div className="text-xs font-bold uppercase tracking-widest text-blue-700">Enlace del workspace</div>
              <div className="flex gap-2">
                <input ref={inputEnlaceRef} readOnly value={enlaceCompartido} onFocus={e => e.target.select()}
                  className="w-full max-w-sm rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs" />
                <button onClick={copiarEnlace} className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white">
                  {copyStatus === 'success' ? <Check className="h-3.5 w-3.5" /> : <LinkIcon className="h-3.5 w-3.5" />}
                  {copyStatus === 'success' ? 'Copiado' : 'Copiar'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Métricas */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Meta general', val: `${resumen.metaGeneral}%`, icon: <ProgressRing value={resumen.metaGeneral} />, color: 'text-blue-600' },
            { label: 'Total tareas', val: resumen.total, icon: <Users className="h-10 w-10 text-slate-300" />, color: 'text-slate-800' },
            { label: 'Finalizadas', val: resumen.finalizadas, icon: <CheckCircle2 className="h-10 w-10 text-emerald-300" />, color: 'text-emerald-600' },
            { label: 'Pendientes', val: resumen.pendientes, icon: <Clock3 className="h-10 w-10 text-amber-300" />, color: 'text-amber-500' },
          ].map(m => (
            <div key={m.label} className="rounded-[24px] bg-[#f7f7f8] p-5 shadow-[0_12px_28px_rgba(15,23,42,0.07)]">
              <div className="mb-3 text-[11px] font-bold uppercase tracking-widest text-slate-400">{m.label}</div>
              <div className="flex items-center justify-between gap-3">
                <div className={`text-4xl font-black ${m.color}`}>{m.val}</div>
                {m.icon}
              </div>
            </div>
          ))}
        </div>

        {/* Main grid */}
        <div className="mb-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">

          {/* Explorador */}
          <section className="rounded-[28px] bg-[#f8f8f9] p-5 shadow-[0_18px_40px_rgba(15,23,42,0.07)]">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-slate-400">Explorador</div>
                <h2 className="mt-1 text-xl font-black">Categorías y subcarpetas</h2>
              </div>
              <button onClick={() => setExploradorAbierto(p => !p)} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 shadow-sm">
                {exploradorAbierto ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
            </div>
            {exploradorAbierto ? (
              <div className="space-y-3">
                {avancePorCategoria.map(cat => (
                  <div key={cat.nombre} className="overflow-hidden rounded-[20px] border border-slate-200 bg-white">
                    <button onClick={() => setCategoriasAbiertas(p => ({ ...p, [cat.nombre]: !p[cat.nombre] }))}
                      className={`flex w-full items-center justify-between bg-gradient-to-r ${cat.color} px-5 py-3 text-left text-white`}>
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-white/70">Categoría</div>
                        <div className="text-lg font-black">{cat.nombre}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-bold">{cat.promedio}%</span>
                        {categoriasAbiertas[cat.nombre] ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                      </div>
                    </button>
                    {categoriasAbiertas[cat.nombre] && (
                      <div className="p-4">
                        <BarraProgreso value={cat.promedio} />
                        <div className="mt-3 space-y-2">
                          {cat.subcarpetas.map(sub => {
                            const ts = cat.tareas.filter(t => t.subcarpeta === sub);
                            const avg = ts.length ? Math.round(ts.reduce((a,t)=>a+Number(t.progreso||0),0)/ts.length) : 0;
                            const clave = `${cat.nombre}::${sub}`;
                            return (
                              <div key={sub} className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                                <button onClick={() => setSubcarpetasAbiertas(p => ({ ...p, [clave]: !p[clave] }))}
                                  className="flex w-full items-center justify-between px-4 py-3">
                                  <div>
                                    <div className="font-extrabold text-slate-800">{sub}</div>
                                    <div className="text-xs text-slate-400">{ts.length} tareas</div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-bold text-slate-600">{avg}%</span>
                                    {subcarpetasAbiertas[clave] ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                                  </div>
                                </button>
                                <div className="px-4 pb-3"><BarraProgreso value={avg} /></div>
                                {subcarpetasAbiertas[clave] && (
                                  <div className="border-t border-slate-200 bg-white px-4 py-3">
                                    {ts.length > 0 ? (
                                      <div className="space-y-2">
                                        {ts.map(t => (
                                          <div key={t.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                            <div className="flex flex-wrap gap-1.5 mb-2">
                                              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">{t.responsable}</span>
                                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">{t.estado}</span>
                                            </div>
                                            <div className="font-bold text-slate-800 text-sm">{t.titulo}</div>
                                            <div className="mt-1.5"><BarraProgreso value={t.progreso} /></div>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-400">Sin tareas asignadas.</div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-400">
                Explorador contraído. Ábrelo para ver categorías.
              </div>
            )}
          </section>

          {/* Panel admin */}
          <section className="rounded-[28px] bg-[#f8f8f9] p-5 shadow-[0_18px_40px_rgba(15,23,42,0.07)]">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-slate-400">Panel administrador</div>
                <h2 className="mt-1 text-xl font-black">Control de tareas</h2>
              </div>
              <Shield className="h-8 w-8 text-slate-300" />
            </div>
            {/* Filtros */}
            <div className="mb-4 grid gap-2 sm:grid-cols-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar…"
                  className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none" />
              </div>
              <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)}
                className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none">
                <option>Todas</option>
                {categorias.map(c => <option key={c.nombre}>{c.nombre}</option>)}
              </select>
              <select value={filtroResponsable} onChange={e => setFiltroResponsable(e.target.value)}
                className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none sm:col-span-2">
                <option>Todos</option>
                {usuariosBase.map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {tareasFiltradas.map(tarea => {
                const editandoEsta = Object.values(presencia).some(p => p.editando === tarea.id && p.uid !== usuarioSesion?.uid);
                const coms = comentarios[tarea.id] || [];
                return (
                  <div key={tarea.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    {editandoEsta && (
                      <div className="mb-2 flex items-center gap-1.5 text-xs text-blue-600">
                        <Eye className="h-3.5 w-3.5 animate-pulse" /> Alguien está editando…
                      </div>
                    )}
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      <span className="rounded-full bg-slate-900 px-2.5 py-0.5 text-[10px] font-bold text-white">{tarea.categoria}</span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-600">{tarea.subcarpeta}</span>
                      <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold text-blue-700">{tarea.responsable}</span>
                    </div>
                    <div className="font-black text-slate-800">{tarea.titulo}</div>
                    <div className="mt-0.5 text-sm text-slate-500">{tarea.descripcion}</div>
                    <div className="mt-3">
                      <div className="mb-1 flex justify-between text-xs font-bold text-slate-400">
                        <span>Progreso</span><span>{tarea.progreso}%</span>
                      </div>
                      <input type="range" min="0" max="100" step="5" value={tarea.progreso}
                        onChange={e => actualizarTarea(tarea.id, 'progreso', e.target.value)}
                        className="w-full mb-1" />
                      <BarraProgreso value={tarea.progreso} />
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <select value={tarea.estado} onChange={e => actualizarTarea(tarea.id, 'estado', e.target.value)}
                        className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-bold text-slate-700 outline-none">
                        <option>Pendiente</option><option>En proceso</option><option>Finalizada</option>
                      </select>
                      <button onClick={() => setMostrarChat(mostrarChat === tarea.id ? null : tarea.id)}
                        className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600">
                        <MessageCircle className="h-3.5 w-3.5" />{coms.length}
                      </button>
                    </div>
                    {/* Chat / Comentarios */}
                    {mostrarChat === tarea.id && (
                      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <div className="max-h-36 overflow-y-auto space-y-2 mb-2">
                          {coms.length === 0 ? (
                            <div className="text-xs text-slate-400 text-center py-2">Sin comentarios aún.</div>
                          ) : coms.map(c => (
                            <div key={c.id} className="flex gap-2">
                              <PresenceDot nombre={c.autor} />
                              <div>
                                <div className="text-xs font-bold text-slate-700">{c.autor} <span className="font-normal text-slate-400">{relTime(c.ts)}</span></div>
                                <div className="text-sm text-slate-600">{c.texto}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <input
                            value={nuevoComentario[tarea.id] || ''}
                            onChange={e => setNuevoComentario(p => ({ ...p, [tarea.id]: e.target.value }))}
                            onKeyDown={e => e.key === 'Enter' && enviarComentario(tarea.id)}
                            placeholder="Escribe un comentario…"
                            className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs outline-none"
                          />
                          <button onClick={() => enviarComentario(tarea.id)}
                            className="rounded-lg bg-blue-600 px-3 py-1.5 text-white">
                            <Send className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {tareasFiltradas.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-slate-400">Sin tareas que coincidan.</div>
              )}
            </div>
          </section>
        </div>

        {/* Actividad en tiempo real + Avance por categoría */}
        <div className="mb-6 grid gap-6 xl:grid-cols-2">
          <section className="rounded-[28px] bg-[#f8f8f9] p-5 shadow-[0_18px_40px_rgba(15,23,42,0.07)]">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-slate-400">Historial</div>
                <h2 className="mt-1 text-xl font-black">Actividad en vivo</h2>
              </div>
              <Activity className="h-7 w-7 text-slate-300" />
            </div>
            <div className="max-h-64 overflow-y-auto space-y-1">
              {actividad.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">Haz un cambio para ver la actividad.</div>
              ) : actividad.map(a => (
                <div key={a.id} className="flex gap-3 rounded-xl bg-white p-3 border border-slate-100">
                  <PresenceDot nombre={a.usuario} />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-bold text-slate-700">{a.usuario}</span>
                    <span className="text-xs text-slate-500"> {a.accion}</span>
                    {a.detalle && <div className="text-xs text-slate-400 truncate">{a.detalle}</div>}
                  </div>
                  <div className="text-xs text-slate-300 whitespace-nowrap">{relTime(a.ts)}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[28px] bg-[#f8f8f9] p-5 shadow-[0_18px_40px_rgba(15,23,42,0.07)]">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-slate-400">Cumplimiento</div>
                <h2 className="mt-1 text-xl font-black">Avance por categoría</h2>
              </div>
              <BarChart3 className="h-7 w-7 text-slate-300" />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {avancePorCategoria.map(cat => (
                <div key={cat.nombre} className="rounded-[20px] bg-white p-4 shadow-sm">
                  <div className={`mb-3 rounded-[16px] bg-gradient-to-r ${cat.color} p-3 text-white`}>
                    <div className="text-[9px] font-bold uppercase tracking-widest text-white/70">Logro</div>
                    <div className="text-sm font-black leading-tight">{cat.nombre}</div>
                  </div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-500">Avance</span>
                    <span className="text-xl font-black text-slate-800">{cat.promedio}%</span>
                  </div>
                  <BarraProgreso value={cat.promedio} />
                  <div className="mt-1.5 text-xs text-slate-400">{cat.totalTareas} tareas</div>
                </div>
              ))}
            </div>
          </section>
        </div>

      </div>

      {/* Modal nueva tarea */}
      {mostrarModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-[28px] bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-black">Nueva responsabilidad</h2>
              <button onClick={() => setMostrarModal(false)} className="rounded-full bg-slate-100 p-2"><X className="h-5 w-5" /></button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <input value={nuevaTarea.titulo} onChange={e => setNuevaTarea(p=>({...p,titulo:e.target.value}))} placeholder="Título de la tarea"
                className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm outline-none md:col-span-2" />
              <textarea value={nuevaTarea.descripcion} onChange={e => setNuevaTarea(p=>({...p,descripcion:e.target.value}))} placeholder="Descripción" rows={3}
                className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm outline-none md:col-span-2" />
              <select value={nuevaTarea.categoria} onChange={e => setNuevaTarea(p=>({...p,categoria:e.target.value}))}
                className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm outline-none">
                {categorias.map(c => <option key={c.nombre}>{c.nombre}</option>)}
              </select>
              <select value={nuevaTarea.subcarpeta} onChange={e => setNuevaTarea(p=>({...p,subcarpeta:e.target.value}))}
                className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm outline-none">
                {(categorias.find(c=>c.nombre===nuevaTarea.categoria)?.subcarpetas||[]).map(s=><option key={s}>{s}</option>)}
              </select>
              <select value={nuevaTarea.responsable} onChange={e => setNuevaTarea(p=>({...p,responsable:e.target.value}))}
                className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm outline-none">
                {usuariosBase.map(u=><option key={u}>{u}</option>)}
              </select>
              <select value={nuevaTarea.prioridad} onChange={e => setNuevaTarea(p=>({...p,prioridad:e.target.value}))}
                className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm outline-none">
                <option>Alta</option><option>Media</option><option>Baja</option>
              </select>
              <input type="date" value={nuevaTarea.fecha} onChange={e => setNuevaTarea(p=>({...p,fecha:e.target.value}))}
                className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm outline-none" />
              <div>
                <div className="mb-1 text-xs font-bold text-slate-400">Progreso inicial: {nuevaTarea.progreso}%</div>
                <input type="range" min="0" max="100" step="5" value={nuevaTarea.progreso}
                  onChange={e => setNuevaTarea(p=>({...p,progreso:Number(e.target.value)}))} className="w-full" />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => setMostrarModal(false)} className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-600">Cancelar</button>
              <button onClick={crearTarea} className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-bold text-white">Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal subcarpeta */}
      {mostrarModalSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-black">Nueva subcarpeta</h2>
              <button onClick={() => setMostrarModalSub(false)} className="rounded-full bg-slate-100 p-2"><X className="h-5 w-5" /></button>
            </div>
            <div className="grid gap-3">
              <select value={nuevaSubcarpeta.categoria} onChange={e => setNuevaSubcarpeta(p=>({...p,categoria:e.target.value}))}
                className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm outline-none">
                {categorias.map(c=><option key={c.nombre}>{c.nombre}</option>)}
              </select>
              <input value={nuevaSubcarpeta.nombre} onChange={e => setNuevaSubcarpeta(p=>({...p,nombre:e.target.value}))}
                placeholder="Nombre de la subcarpeta"
                className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm outline-none" />
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => setMostrarModalSub(false)} className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-600">Cancelar</button>
              <button onClick={crearSubcarpeta} className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-bold text-white">Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
