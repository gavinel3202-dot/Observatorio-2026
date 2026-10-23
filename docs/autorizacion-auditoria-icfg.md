# Diseño de autorización y auditoría ICFG — pendiente de implementación

## Decisión institucional
- Administrador único: crea, activa, suspende y retira formadores; rota la contraseña institucional.
- Formador: se identifica con código individual registrado y contraseña institucional compartida.
- La contraseña compartida **no prueba identidad individual**; el código se registra como identificación declarada, no como prueba irrefutable.

## Flujo de corrección (servidor)
1. El cliente solicita una sesión corta de corrección a una función HTTPS segura. Envía código del formador y contraseña institucional por HTTPS, nunca en parámetros de URL ni en variables VITE_*.
2. El servidor aplica limitación de intentos, valida la contraseña mediante hash robusto con sal (Argon2id/scrypt/bcrypt) y comprueba que el código esté activo. Emite una sesión corta firmada y vinculada al código. No registrar contraseñas en logs.
3. El cliente envía ID de evaluación, cambios y motivo a una función HTTPS. El servidor verifica la sesión, vigencia, rol y estado activo del formador; rechaza cambios sin motivo.
4. En transacción de Firestore: lee versión actual, valida los campos permitidos y los rangos, recalcula ICFG/IMC **en servidor**, actualiza el documento original con control de versión, y crea entrada de auditoría inmutable con before/after, actor, fecha del servidor y motivo.
5. La función devuelve resultado y número de versión. No se crean documentos duplicados de evaluación. Los errores no revelan existencia de documentos a usuarios sin permiso.

## Rutas sugeridas (no creadas)
- Colección de evaluaciones existente: `artifacts/icfg-app-id/public/data/evaluaciones_icfg`.
- Registro privado de formadores: `icfg_private/formadores/items/{codigo}` (ajustar a esquema Firestore válido).
- Auditoría privada: `icfg_private/auditoria/items/{auditId}` (ajustar a esquema Firestore válido).
- Hash de contraseña en secret manager del backend, no Firestore público.

## Operaciones
- `POST /api/icfg/session`: código + contraseña, entrega sesión corta.
- `POST /api/icfg/corrections`: ID, cambios, motivo, versión esperada.
- `POST /api/icfg/admin/formadores`: alta/baja/suspensión con sesión de administrador independiente.
- `POST /api/icfg/admin/rotate-password`: rotación institucional e invalidación de sesiones previas.

## Seguridad y migración
- Las reglas actuales `allow read, write: if request.auth != null` permiten edición y borrado directos desde clientes anónimos. **No basta proteger botones en React.**
- Archivo `security/firestore.rules.CANDIDATE` es una propuesta, NO reglas publicadas. Mantiene temporalmente creación anónima para compatibilidad, lo cual NO cumple todavía el objetivo final de controlar el acceso a todas las operaciones.
- Antes de publicar reglas: exportar/resguardar Firestore, habilitar backend, probar creación/lectura/corrección/borrado denegado, migrar clientes, publicar reglas, supervisar errores.
- Revisar acceso de lectura a datos personales y exportación CSV: idealmente también requerir sesión autorizada. Evitar exponer PII en registros de prueba.
- No implementar «administrador» usando la contraseña compartida; credencial administrativa independiente con MFA.

## Pruebas obligatorias
1. Formador activo y contraseña válida; inactivo; contraseña incorrecta; bloqueo por intentos.
2. Cambios de edad, sexo y prueba: recálculo del baremo ICFG.
3. Cambio de peso/talla: recálculo IMC sin alterar ICFG.
4. Dos correcciones simultáneas: solo una versión puede ganar; reintento explícito.
5. Actualización y borrado directos vía SDK cliente: denegados.
6. Auditoría completa e inmutable, motivo obligatorio, timestamps de servidor.
7. Administración de formadores: solo administrador.
8. Comprobación en entorno aislado antes de activar en producción.

**Estado:** diseño y reglas candidatas guardados; backend y permisos NO implementados ni desplegados.
