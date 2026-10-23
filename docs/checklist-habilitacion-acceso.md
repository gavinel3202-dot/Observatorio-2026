# Lista de verificación de habilitación institucional ICFG

**Estado: NO APTO PARA PRODUCCIÓN.** No activar ninguna bandera ni publicar las reglas candidatas hasta concluir migración, respaldos y pruebas.

## Controles ya incorporados en rama de desarrollo
- [x] Dependencia `firebase-admin` y lockfile reproducible; compilación en GitHub Actions.
- [x] Hash de contraseña institucional con sal, firma de sesiones por 15 minutos.
- [x] Directorio de formadores privados, con consultas de solo lectura y verificación de estado activo en cada corrección.
- [x] API administrativa separada con Firebase ID token verificado y no revocado, UID único, privilegio `icfgAdmin`, correo verificado, MFA reciente y restricción por contraseña individual.
- [x] Altas/suspensiones/reactivaciones de formadores transaccionales con historial de cambios y control de revisión; no existe eliminación física. Pruebas aisladas completadas.
- [x] Protección de intentos fallidos mediante contadores por código e IP en Firestore.
- [x] Backend de corrección: validación de campos, recálculo ICFG/IMC, revisión optimista, actualización del documento existente y auditoría privada en una transacción.
- [x] Pruebas del backend con Firestore Emulator, sin credenciales ni documentos de producción.
- [x] Prueba de flujo de autenticación + corrección + suspensión con datos ficticios en Firebase Emulator.
- [x] Interfaz de sesión/guardado preparada detrás de `VITE_ICFG_CORRECTION_ACCESS`. Sin la bandera, conserva la vista previa y el botón Guardar deshabilitado.
- [x] API de sesión y API de correcciones bloqueadas por defecto con `ICFG_SESSION_ENABLED` y `ICFG_CORRECTIONS_ENABLED` respectivamente.

## Pendientes de activación
- [ ] Configurar un proyecto Firebase de staging real, distinto de `calculadora-funcional-7f9d8`; pruebas integrales de despliegue con credenciales ficticias y backups.
- [ ] Comprobar HTTP en un Preview protegido utilizando acceso autenticado de Vercel (`vercel curl` o token OIDC de desarrollo). Un HTTP 401 sin credenciales es inconcluso y no prueba el servicio.
- [ ] Verificar con Vercel la obtención de IP real y el impacto de bloqueos por IP compartida en una sede institucional.
- [ ] Aprovisionar credenciales de servidor y secretos en Vercel, solo en entorno aislado. Jamás guardarlos en GitHub ni en variables `VITE_*`.
- [ ] Habilitar en un Firebase **de pruebas** autenticación administrativa real (cuenta personal y MFA), otorgar claim `icfgAdmin` fuera de la aplicación y configurar UID y permisos. La API de administración está escrita, pero no hay cuenta preparada ni inicio de sesión administrativo en interfaz.
- [ ] Preparar la gestión segura de la rotación de contraseña compartida mediante secretos del backend; no construir un formulario de rotación que escriba secretos en repositorios o variables públicas.
- [ ] Exportar y respaldar toda la colección real; validar restauración.
- [ ] Migrar reglas Firestore, registro y consulta en un proceso coordinado. La regla actual `allow read, write: if request.auth != null` permite aún modificaciones directas desde usuarios anónimos: el nuevo backend **no corrige ese riesgo** por sí solo.
- [ ] Restringir lectura/exportación de datos personales según roles y legislación aplicable.
- [ ] Aprobar la integración, ejecutar pruebas de regresión con formadores y publicar gradualmente.

## Variables (sin valores)
- Servidor: `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON`, `ICFG_INSTITUTIONAL_PASSWORD_HASH`, `ICFG_SESSION_SECRET`, `ICFG_RATE_LIMIT_SECRET`, `ICFG_SESSION_EPOCH`.
- Interruptores de servidor **deshabilitados por defecto**: `ICFG_SESSION_ENABLED`, `ICFG_CORRECTIONS_ENABLED`, `ICFG_ADMIN_ENABLED`.
- Cuenta administrativa única (solo servidor): `ICFG_ADMIN_UID`.
- Interruptor de interfaz **deshabilitado por defecto**: `VITE_ICFG_CORRECTION_ACCESS`.
- El emulador solo se permite en Node fuera de Vercel con `FIRESTORE_EMULATOR_HOST` y `GCLOUD_PROJECT=demo-icfg-corrections`.

## Principio de trazabilidad
Una contraseña compartida con código individual solo permite atribuir el cambio al **código declarado y validado**, no probar inequívocamente la identidad física de quien lo usó.
