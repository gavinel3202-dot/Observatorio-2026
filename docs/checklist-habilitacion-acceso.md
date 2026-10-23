# Lista de verificación para habilitar acceso institucional

Estado: **NO APTO PARA PRODUCCIÓN**.

El endpoint `api/icfg-session.js` responde 503 por defecto, salvo que el servidor tenga `ICFG_SESSION_ENABLED=true`. **No activar esa variable todavía**.

## Bloqueos técnicos
- Incorporar y fijar dependencia `firebase-admin`, generar lockfile y comprobar despliegue Vercel.
- Añadir protección persistente contra fuerza bruta (IP y código, en servidor) antes de habilitar el endpoint.
- Configurar credenciales Firebase Admin y secretos exclusivamente en el entorno de servidor, nunca como variables `VITE_*`.
- Crear una identidad administrativa separada con MFA y un proceso de altas/bajas de formadores.
- Probar la autenticación con datos ficticios en un proyecto Firebase de pruebas.
- Implementar el guardado mediante backend, recálculo validado en servidor y auditoría transaccional.
- Migrar las reglas Firestore de forma coordinada. Las actuales siguen permitiendo escritura directa a usuarios autenticados, incluso anónimos.
- Revisar tratamiento de datos personales y políticas de acceso de lectura.

## Regla de liberación
No habilitar `ICFG_SESSION_ENABLED`, ni el botón Guardar, ni cambiar reglas de producción hasta superar pruebas de extremo a extremo y disponer de copia de seguridad.
