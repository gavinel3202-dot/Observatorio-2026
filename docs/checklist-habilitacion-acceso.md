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

## Pendientes de activación
- [x] Crear un Firebase de staging independiente (`observatorio-icfg-pruebas`) y verificar la conexión de lectura con datos ficticios. Quedan pendientes las pruebas integrales y los respaldos.
- [ ] Comprobar HTTP en un Preview protegido utilizando acceso autenticado de Vercel (`vercel curl` o token OIDC de desarrollo). Un HTTP 401 sin credenciales es inconcluso y no prueba el servicio.
- [ ] Verificar con Vercel la obtención de IP real y el impacto de bloqueos por IP compartida en una sede institucional.
- [ ] Aprovisionar credenciales de servidor y secretos en Vercel, solo en entorno aislado. Jamás guardarlos en GitHub ni en variables `VITE_*`. El backend exige adicionalmente `ICFG_EXPECTED_FIREBASE_PROJECT_ID=observatorio-icfg-pruebas` y verifica que coincida con el `project_id` de la credencial.
- [x] Verificar correo, TOTP y reingreso de cuenta administrativa en Firebase de pruebas; asignar claim `icfgAdmin` y configurar `ICFG_ADMIN_UID` en Vercel de ensayo. Pendiente prueba del backend con credenciales de servicio.
- [x] Habilitar TOTP en Identity Platform de pruebas y probar inicio de sesión por dos factores. El servidor de administración rechaza ahora segundo factor SMS.
- [ ] Preparar la gestión segura de la rotación de contraseña compartida mediante secretos del backend; no construir un formulario de rotación que escriba secretos en repositorios o variables públicas.
- [ ] Exportar y respaldar toda la colección real; validar restauración.
- [ ] Migrar reglas Firestore, registro y consulta en un proceso coordinado. La regla actual `allow read, write: if request.auth != null` permite aún modificaciones directas desde usuarios anónimos: el nuevo backend **no corrige ese riesgo** por sí solo.
- [ ] Restringir lectura/exportación de datos personales según roles y legislación aplicable.
- [ ] Aprobar la integración, ejecutar pruebas de regresión con formadores y publicar gradualmente.

## Variables (sin valores)
- Servidor: `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON`, `ICFG_EXPECTED_FIREBASE_PROJECT_ID`, `ICFG_INSTITUTIONAL_PASSWORD_HASH`, `ICFG_SESSION_SECRET`, `ICFG_RATE_LIMIT_SECRET`, `ICFG_SESSION_EPOCH`.
- Interruptores de servidor **deshabilitados por defecto**: `ICFG_SESSION_ENABLED`, `ICFG_CORRECTIONS_ENABLED`, `ICFG_ADMIN_ENABLED`.
- Cuenta administrativa única (solo servidor): `ICFG_ADMIN_UID`.
- Interruptores de interfaz **deshabilitados por defecto**: `VITE_ICFG_CORRECTION_ACCESS`, `VITE_ICFG_ADMIN_UI`.
- El emulador solo se permite en Node fuera de Vercel con `FIRESTORE_EMULATOR_HOST` y `GCLOUD_PROJECT=demo-icfg-corrections`.

## Principio de trazabilidad
Una contraseña compartida con código individual solo permite atribuir el cambio al **código declarado y validado**, no probar inequívocamente la identidad física de quien lo usó.
