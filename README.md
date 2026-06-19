# ICFG — Índice de Capacidad Funcional

Aplicación web (Vite + React + Tailwind) para registrar evaluaciones de
capacidad funcional, calcular el índice ICFG y consultar la evolución de cada
usuario.

## Características

- **Nueva Evaluación**: captura datos demográficos (nombre, edad, sexo, sede,
  peso, talla) y los resultados brutos de las 8 pruebas físicas.
- **Baremos automáticos por edad y sexo**: cada prueba se convierte a una escala
  1–5 según tablas cruzadas por edad/sexo y se pondera por su peso para obtener
  el ICFG (0–100), clasificado en 5 niveles (Fragilidad → Plenitud).
- **IMC OMS** calculado en vivo a partir de peso y talla, con categoría y riesgo.
- **Debilidad principal y acción sugerida**: detecta la prueba más débil y
  recomienda una intervención según la clasificación.
- **Base de datos consolidada** con todas las evaluaciones y **exportación CSV**.
- **Seguimiento**: busca por nombre y muestra la evolución del puntaje ICFG en
  una gráfica de líneas.
- **Persistencia flexible**: usa Firebase/Firestore si está configurado; de lo
  contrario guarda en el navegador (`localStorage`), por lo que funciona sin
  credenciales.

## Requisitos

- Node.js 18+ (probado con Node 22)

## Puesta en marcha

```bash
npm install
npm run dev
```

Abre la URL que imprime Vite (por defecto http://localhost:5173).

## Configurar Firebase (opcional)

Sin configuración, la app funciona con almacenamiento local. Para sincronizar
en la nube:

1. Copia `.env.example` a `.env`.
2. Rellena `VITE_FIREBASE_CONFIG` con el JSON de configuración de tu proyecto
   Firebase (en una sola línea) y, si quieres, `VITE_APP_ID`.
3. Habilita **Authentication → Anonymous** y **Cloud Firestore** en tu proyecto
   Firebase.

Los datos se guardan en la colección:
`artifacts/{VITE_APP_ID}/public/data/evaluaciones_icfg`.

## Scripts

- `npm run dev` — servidor de desarrollo
- `npm run build` — build de producción en `dist/`
- `npm run preview` — sirve el build de producción
- `npm run lint` — análisis estático con ESLint
