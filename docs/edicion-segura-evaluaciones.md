# Edición segura de evaluaciones ICFG — especificación de implementación

Estado: rama de trabajo; NO desplegar a producción hasta completar autenticación, reglas y pruebas.

## Roles aprobados
- Formador autorizado: crear, consultar y corregir evaluaciones. No eliminar.
- Administrador: todas las anteriores, gestionar acceso y desactivar/restaurar evaluaciones.
- Identificación de formador + contraseña institucional compartida y rotativa. **La identificación declarada no es una identidad verificada**. Para auditoría atribuible a personas se requiere segundo factor o credencial individual.
- Nunca almacenar contraseña o su hash en código frontend, variables VITE_*, localStorage ni documentos públicos de Firestore.

## Hallazgos en main
- `src/firebase.js` utiliza `signInAnonymously` y colección `artifacts/{appId}/public/data/evaluaciones_icfg`.
- `src/dataStore.js` solo implementa `subscribeRecords` y `addRecord`.
- `src/App.jsx` calcula puntajes con `evaluateTest`, `classifyICFG`, IMC y dimensiones. El historial busca actualmente por nombre.
- Existe respaldo localStorage si Firebase no está configurado. Este modo no garantiza autorización multiusuario.

## Diseño propuesto
1. Backend protegido (Firebase Functions o servicio equivalente) verifica contraseña institucional con hash fuerte, limitación de intentos, sesiones cortas y revocación al rotar clave. No confiar en rol ni nombre enviado desde navegador.
2. Reglas de Firestore: bloquear escrituras directas desde cliente anónimo; permitir solo a backend de confianza las mutaciones autorizadas. Planificar migración para no interrumpir captura actual.
3. Identificar registro por ID único de documento Firestore, no por nombre ni documento personal. Buscar por tipo y número de documento, y escoger evaluación por fecha.
4. Al editar: validar campos y rangos; recalcular en backend ICFG, clasificación, debilidad e IMC usando las mismas tablas de baremos; actualización atómica del documento existente y creación de evento de auditoría (actor, fecha servidor, antes/después, motivo).
5. Evitar modificaciones simultáneas perdidas mediante versión del registro / transacción.
6. Eliminación lógica exclusiva de administradores (`deletedAt`, `deletedBy`); ocultar de listados activos y permitir recuperación.
7. No exponer historial de cambios ni datos personales a usuarios no autorizados. Revisar reglas de lectura y retención de datos.

## Criterios de aceptación
- Un formador autenticado puede corregir una medición y la misma evaluación se actualiza sin duplicarse.
- Recalcular y guardar consistentemente todos los resultados derivados.
- El registro anterior y posterior queda trazado en una auditoría no editable por formadores.
- Formador no puede eliminar, aunque manipule peticiones HTTP.
- Administrador puede desactivar y restaurar; no se pierde la auditoría.
- Cambio de contraseña revoca sesiones previas según política.
- Usuarios sin autorización no pueden consultar datos sensibles ni escribir.
- Pruebas sobre datos ficticios, copia de respaldo y despliegue de prueba antes de fusionar a main.

## Pendiente antes de código productivo
Confirmar infraestructura de funciones backend, acceso administrativo a Firebase y estrategia de transición desde autenticación anónima. No publicar una simple pantalla de contraseña: no protege Firestore.
