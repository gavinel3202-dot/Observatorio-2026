# Lista de verificación para habilitar acceso institucional

Estado: **NO APTO PARA PRODUCCIÓN**.

El endpoint `api/icfg-session.js` responde 503 por defecto, salvo que el servidor tenga `ICFG_SESSION_ENABLED=true`. **No activar esa variable todavía**.

## Bloqueos técnicos
- [x] Incorporar `firebase-admin` (14.5.0) y lockfile. GitHub Actions: `npm ci`, 12 pruebas y `npm run build` aprobados; vista previa Vercel en estado READY.
- [ ] Comprobar ejecución real del endpoint con una solicitud autenticada a la vista previa: Vercel Deployment Protection responde HTTP 401 a solicitudes anónimas. Un READY no prueba por sí solo la función HTTP.
- [x] Implementar protección persistente contra intentos repetidos por IP y código (lógica y pruebas locales aprobadas).
- [ ] Probar contadores transaccionales y la IP de cliente con Firebase real en entorno aislado antes de activar.
- Configurar credenciales Firebase Admin y secretos exclusivamente en el entorno de servidor, nunca como variables `VITE_*`.
- Crear una identidad administrativa separada con MFA y un proceso de altas/bajas de formadores.
- Probar la autenticación con datos ficticios en un proyecto Firebase de pruebas.
- Implementar el guardado mediante backend, recálculo validado en servidor y auditoría transaccional.
- Migrar las reglas Firestore de forma coordinada. Las actuales siguen permitiendo escritura directa a usuarios autenticados, incluso anónimos.
- Revisar tratamiento de datos personales y políticas de acceso de lectura.

## Regla de liberación
No habilitar `ICFG_SESSION_ENABLED`, ni el botón Guardar, ni cambiar reglas de producción hasta superar pruebas de extremo a extremo y disponer de copia de seguridad.
