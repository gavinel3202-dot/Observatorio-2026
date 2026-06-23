# Guía: Nube en vivo (Firebase) + Compartir (Deploy)

Esta guía te lleva de "Almacenamiento local" a una app pública donde **cada
registro nuevo de cualquier usuario aparece en vivo** en la "Base de Datos
Consolidada" de todos.

> Por qué: en modo local cada navegador guarda solo sus datos. Con Firebase
> Firestore + el listener `onSnapshot` (ya implementado), los datos se comparten
> y se actualizan en tiempo real sin recargar.

---

## Parte 1 — Conectar Firebase (ver en vivo en la nube)

### 1. Crear el proyecto
1. Entra a https://console.firebase.google.com y pulsa **Agregar proyecto**.
2. Ponle un nombre (ej. `icfg-observatorio`) y créalo (puedes desactivar Analytics).

### 2. Activar autenticación anónima
1. Menú izquierdo → **Build → Authentication → Get started**.
2. Pestaña **Sign-in method** → **Anonymous** → **Enable** → **Save**.

### 3. Activar Firestore
1. Menú izquierdo → **Build → Firestore Database → Create database**.
2. Elige ubicación y crea en **modo producción**.

### 4. Reglas de seguridad
En **Firestore Database → Rules**, pega esto y publica (**Publish**):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /artifacts/{appId}/public/data/evaluaciones_icfg/{doc} {
      allow read, write: if request.auth != null;
    }
  }
}
```

> Esto permite que cualquier usuario autenticado (anónimo) lea y escriba el
> observatorio. Es lo apropiado para captura masiva compartida. Si luego quieres
> impedir borrados o aislar por evaluador, se endurece aquí.

### 5. Copiar la configuración Web
1. Engranaje ⚙️ (arriba izq.) → **Project settings**.
2. Baja a **Tus apps** → icono Web **</>** → registra una app (sin Hosting por ahora).
3. Copia el objeto `firebaseConfig` que te muestra. Se ve así:

```js
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "icfg-observatorio.firebaseapp.com",
  projectId: "icfg-observatorio",
  storageBucket: "icfg-observatorio.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123...:web:abc..."
};
```

### 6. Pegarlo en el proyecto
1. Copia `.env.example` a `.env`.
2. Convierte el objeto a **JSON en una sola línea** (comillas en las claves) y
   pégalo en `VITE_FIREBASE_CONFIG`. Ejemplo:

```
VITE_FIREBASE_CONFIG={"apiKey":"AIza...","authDomain":"icfg-observatorio.firebaseapp.com","projectId":"icfg-observatorio","storageBucket":"icfg-observatorio.appspot.com","messagingSenderId":"123456789","appId":"1:123...:web:abc..."}
VITE_APP_ID=icfg-app-id
```

3. Reinicia el dev server (`Ctrl+C` y `npm run dev`). El badge del header debe
   cambiar a **"Conectado a la nube"**.

### 7. Probar el "en vivo"
- Abre la app en **dos navegadores/pestañas** distintas.
- Guarda una evaluación en una; aparece **al instante** en la tabla de la otra.

> Nota: `VITE_FIREBASE_CONFIG` es configuración pública del cliente (no es un
> secreto). La seguridad real la dan las **reglas de Firestore**, no ocultar la
> config. Aun así, no subas `.env` al repo (ya está en `.gitignore`).

---

## Parte 2 — Compartir la app (deploy a una URL pública)

### Opción A — Vercel (recomendada, más simple)
1. Sube el proyecto a un repositorio de GitHub.
2. Entra a https://vercel.com → **Add New → Project** → importa el repo.
3. Framework: **Vite** (autodetectado). Build: `npm run build`. Output: `dist`.
4. En **Environment Variables** agrega:
   - `VITE_FIREBASE_CONFIG` = el JSON de una línea.
   - `VITE_APP_ID` = `icfg-app-id`.
5. **Deploy**. Tendrás una URL `https://tu-app.vercel.app` para compartir.
6. En Firebase → Authentication → **Settings → Authorized domains**, agrega el
   dominio de Vercel.

### Opción B — Netlify
Igual que Vercel: importas el repo, build `npm run build`, publish dir `dist`,
y agregas las mismas variables de entorno.

### Opción C — Firebase Hosting (todo en Google)
```bash
npm install -g firebase-tools
firebase login
firebase init hosting        # public dir: dist ; SPA: Yes ; no sobreescribir index
npm run build
firebase deploy
```
Como aquí no usas variables de entorno del proveedor, asegúrate de tener `.env`
con `VITE_FIREBASE_CONFIG` **antes** de `npm run build` (Vite las incrusta en el
build). URL final: `https://<tu-proyecto>.web.app`.

---

## Checklist rápido
- [ ] Auth Anonymous activado
- [ ] Firestore creado + reglas publicadas
- [ ] `VITE_FIREBASE_CONFIG` en `.env` (local) y en variables del hosting (deploy)
- [ ] Badge dice "Conectado a la nube"
- [ ] Probado en 2 pestañas: aparece en vivo
- [ ] Dominio del deploy agregado a Authorized domains en Firebase
