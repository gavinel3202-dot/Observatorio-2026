# Lista de verificación de habilitación institucional ICFG

**Estado: NO APTO PARA PRODUCCIÓN.** No activar ninguna bandera ni publicar las reglas candidatas hasta concluir migración, respaldos y pruebas.

## Controles ya incorporados en rama de desarrollo
- [x] Dependencia `firebase-admin` y lockfile reproducible; compilación en GitHub Actions.
- [x] Hash de contraseña institucional con sal, firma de sesiones por 15 minutos.
- [x] Directorio de formadores privados, con consultas de solo lectura y verificación de estado activo en cada corrección.
- [x] API administrativa separada con Firebase ID token verificado y no revocado, UID único, privilegio `icfgAdmin`, correo verificado, MFA reciente y restricción por contraseña individual.
- [x] Pantalla administrativa preparada con autenticación individual y TOTP, usando una instancia Firebase Auth separada y credenciales solo en memoria; cliente HTTP con token temporal.
- [x] Pestaña administrativa oculta por defecto tras `VITE_ICFG_ADMIN_UI` y servicio bloqueado tras `ICFG_ADMIN_ENABLED`.
- [x] Altas/suspensiones/reactivaciones de formadores transaccionales con historial de cambios y control de revisión; no existe eliminación física. Pruebas aisladas completadas.
- [x] Protección de intentos fallidos mediante contadores por código e IP en Firestore.
- [x] Backend de corrección: validación de campos, recálculo ICFG/IMC, revisión optimista, actualización del documento existente y auditoría privada en una transacción.
- [x] Pruebas del backend con Firestore Emulator, sin credenciales ni documentos de producción.
- [x] Prueba de flujo de autenticación + corrección + suspensión con datos ficticios en Firebase Emulator.
- [x] Interfaz de sesión/guardado preparada detrás de `VITE_ICFG_CORRECTION_ACCESS`. Sin la bandera, conserva la vista previa y el botón Guardar deshabilitado.
- [x] API de sesión y API de correcciones bloqueadas por defecto con `ICFG_SESSION_ENABLED` y `ICFG_CORRECTIONS_ENABLED` respectivamente.

## Evidencia de ensayos funcionales (6 de noviembre de 2026)
- [x] Alta ficticia en Firebase **observatorio-icfg-pruebas**: código `DEMO-FORMADOR-01`, revisión 1, estado activo, con auditoría `FORMADOR_CREADO`.
- [x] Suspensión ficticia en el mismo entorno: revisión 2, estado inactivo, auditoría `FORMADOR_MODIFICADO` verificada directamente en Firestore, con cambios anterior/posterior y motivo.
- [x] Prueba de integración contra **Firestore Emulator local**: alta de formador ficticio, sesión autorizada, suspensión que rechaza nuevas sesiones y correcciones con token previo, reactivación y tres eventos de auditoría. Se probó contra `demo-icfg-corrections`, **no** contra Firebase staging ni producción institucional.
- [x] Variables de ensayo en Vercel: `ICFG_SESSION_SECRET` y `ICFG_RATE_LIMIT_SECRET` sensibles y aleatorias e `ICFG_SESSION_EPOCH=1`. No documentar sus valores.
- [x] Bloqueos en Vercel staging: `ICFG_SESSION_ENABLED=false` y `ICFG_CORRECTIONS_ENABLED=false`. Administración ficticia `ICFG_ADMIN_ENABLED=true` únicamente en `observatorio-icfg-staging`.
- [ ] Elegir y registrar **sin compartir el texto claro** de una contraseña institucional exclusiva de ensayos; almacenar su hash scrypt únicamente en `ICFG_INSTITUTIONAL_PASSWORD_HASH` como secreto del servidor.
- [ ] Validar inicio de sesión HTTPS real de formadores ficticios activos y suspendidos, límites de intentos y cierre de sesión. Solo entonces considerar activar acceso operativo en staging, en una ventana controlada; nunca activar correcciones reales como parte de esa prueba.

## Pendientes de activación
- [x] Crear un Firebase de staging independiente (`observatorio-icfg-pruebas`) y verificar la conexión de lectura con datos ficticios. Quedan pendientes las pruebas integrales y los respaldos.
- [ ] Comprobar HTTP en un Preview protegido utilizando acceso autenticado de Vercel (`vercel curl` o token OIDC de desarrollo). Un HTTP 401 sin credenciales es inconcluso y no prueba el servicio.
- [ ] Verificar con Vercel la obtención de IP real y el impacto de bloqueos por IP compartida en una sede institucional.
- [x] Crear cuenta de servicio ICFG Staging Backend con roles de lectura de Authentication y usuario de Datastore en Firebase de ensayos; configurar federación Workload Identity mediante Vercel OIDC, sujeto específico y variables no secretas en Vercel.
- [x] Sustituir la exigencia de clave JSON de Firebase Admin por intercambio OIDC -> Google STS -> suplantación temporal de cuenta de servicio. El backend exige proyecto, proveedor, servicio y entorno específicos y rechaza credenciales JSON permanentes.
- [x] Prueba real de intercambio OIDC contra Google STS e IAM Credentials y lectura de un documento ficticio de Firestore staging; diagnóstico administrativo con MFA y sin escrituras confirmado en la interfaz (noviembre de 2026).
- [x] Verificar correo, TOTP y reingreso de cuenta administrativa en Firebase de pruebas; asignar claim `icfgAdmin`, configurar `ICFG_ADMIN_UID` en Vercel de ensayo y comprobar la autorización real con credenciales temporales.
- [x] Habilitar TOTP en Identity Platform de pruebas y probar inicio de sesión por dos factores. El servidor de administración rechaza ahora segundo factor SMS.
- [ ] Preparar la gestión segura de la rotación de contraseña compartida mediante secretos del backend; no construir un formulario de rotación que escriba secretos en repositorios o variables públicas.
- [ ] Exportar y respaldar toda la colección real; validar restauración.
- [ ] Migrar reglas Firestore, registro y consulta en un proceso coordinado. La regla actual `allow read, write: if request.auth != null` permite aún modificaciones directas desde usuarios anónimos: el nuevo backend **no corrige ese riesgo** por sí solo.
- [ ] Restringir lectura/exportación de datos personales según roles y legislación aplicable.
- [ ] Aprobar la integración, ejecutar pruebas de regresión con formadores y publicar gradualmente.

## Variables (sin valores)
- Servidor (sin clave privada): `ICFG_EXPECTED_FIREBASE_PROJECT_ID`, `ICFG_WORKLOAD_IDENTITY_PROVIDER`, `ICFG_SERVICE_ACCOUNT_EMAIL`, `ICFG_INSTITUTIONAL_PASSWORD_HASH`, `ICFG_SESSION_SECRET`, `ICFG_RATE_LIMIT_SECRET`, `ICFG_SESSION_EPOCH`.
- No configurar `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON`: la rama de ensayos la rechaza. Los tokens OIDC los suministra el contexto de la función Vercel.
- Interruptores de servidor **deshabilitados por defecto**: `ICFG_SESSION_ENABLED`, `ICFG_CORRECTIONS_ENABLED`, `ICFG_ADMIN_ENABLED`.
- Cuenta administrativa única (solo servidor): `ICFG_ADMIN_UID`.
- Interruptores de interfaz **deshabilitados por defecto**: `VITE_ICFG_CORRECTION_ACCESS`, `VITE_ICFG_ADMIN_UI`.
- El emulador solo se permite en Node fuera de Vercel con `FIRESTORE_EMULATOR_HOST` y `GCLOUD_PROJECT=demo-icfg-corrections`.

## Principio de trazabilidad
Una contraseña compartida con código individual solo permite atribuir el cambio al **código declarado y validado**, no probar inequívocamente la identidad física de quien lo usó.
