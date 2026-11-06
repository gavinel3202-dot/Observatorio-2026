# Diagnóstico previo a la edición de evaluaciones ICFG

Fecha: 2026-10-23. Rama de desarrollo; no desplegar en producción sin validar permisos.

## Hallazgos confirmados en el código
- `src/firebase.js`: inicializa Firebase con variables VITE_FIREBASE_* y colección `artifacts/{VITE_APP_ID || "icfg-app-id"}/public/data/evaluaciones_icfg`.
- Usa `signInAnonymously`; no existe identificación/autorización de formadores por Firebase Auth.
- `src/dataStore.js`: solamente `subscribeRecords` y `addRecord`; no existe edición ni auditoría.
- `src/App.jsx`: calcula ICFG con `evaluateTest` y `classifyICFG`, e IMC con `getIMCData`. El indicador «Conectado a la nube» depende de inicialización de Firebase, no de una lectura confirmada.
- El usuario confirmó que se registran evaluaciones desde celulares distintos y que aparecen en una ventana privada: evidencia fuerte de persistencia compartida, no prueba del ID de proyecto.

## Bloqueador
- El Firebase abierto en consola (`observatorio-2026-e9877`) no mostró métodos de acceso habilitados ni la colección ICFG; NO asumir que es el backend de producción.
- El acceso al equipo Vercel `gavinel3202-dots-projects` devuelve 403 aun tras reconectar el complemento. No modificar variables ni reglas hasta verificar el proyecto correcto.

## Condiciones de seguridad para implementar
1. Autorización **en servidor/reglas**, nunca mediante contraseña expuesta en código cliente o variables `VITE_`.
2. Identidad individual de quien corrige, aunque exista clave institucional rotativa.
3. Actualización de documento existente (no `addDoc`) con control de concurrencia y auditoría inmutable de antes/después, fecha, autor y motivo.
4. Recalcular ICFG/IMC con la misma lógica de evaluación y validar entradas.
5. Formadores: crear, leer, corregir; sin borrar. Administradores: gestión de accesos y baja lógica/restauración.
6. Pruebas con datos ficticios en entorno aislado antes de producción; respaldo previo y revisión de reglas.

## Próximo paso técnico
Confirmar `projectId` real del despliegue mediante acceso autorizado al entorno Vercel o inspección de la configuración pública compilada, sin publicar claves ni exponer datos personales. Luego desarrollar flujo de corrección seguro en esta rama.
