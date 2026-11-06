# Administración segura de formadores — ICFG

**Estado:** módulo preparado y probado con datos de ensayo; **no habilitado en producción**.

## Modelo aprobado
- **Formador:** código individual activo en `icfg_formadores_privados` y contraseña institucional compartida. Puede crear, consultar o corregir evaluaciones solo cuando los demás controles estén habilitados.
- **Administrador único:** cuenta individual de **Firebase Authentication** (distinta del acceso compartido). Debe iniciar sesión con segundo factor, tener correo verificado y un permiso especial concedido exclusivamente por un operador de confianza.
- **No existen eliminaciones físicas de formadores.** El administrador activa, suspende o reactiva; las modificaciones se registran en una auditoría privada.
- La contraseña compartida **no** autentica al administrador ni demuestra que la persona que usó un código individual sea quien dice ser.

## API incorporada (inactiva)
`POST /api/icfg-admin-formadores` con encabezado `Authorization: Bearer <FIREBASE_ID_TOKEN>`.

Operaciones:
- `{ "action": "get", "code": "F100" }` devuelve estado, nombre institucional y revisión **solo al administrador autenticado**.
- `{ "action": "set", "code": "F100", "displayName": "Formador de ensayo", "active": true, "expectedRevision": 0, "reason": "Alta aprobada por coordinación" }` crea/activa/suspende según valores. Para suspender, `active: false`. Una nueva modificación requiere la revisión vigente para evitar conflictos.
- Se registra en la colección privada `icfg_formadores_audit_private` el código, identificador de administrador, fecha de servidor, razón y valores antes/después. No contiene la contraseña institucional.

## Controles de seguridad del servidor
1. La variable `ICFG_ADMIN_ENABLED` debe permanecer sin configurar o en `false` hasta aprobar la salida de pruebas; en ese estado el servicio devuelve HTTP 503.
2. La variable `ICFG_ADMIN_UID` indica exactamente **un** UID de administrador previamente autorizado; no se permite elevarse a sí mismo.
3. El servidor verifica el ID token firmado y la revocación de sesión mediante Firebase Admin SDK.
4. Comprueba `icfgAdmin: true` tanto en el token como en el registro actual del usuario, `email_verified`, cuenta no suspendida y señal de segundo factor en el token (`firebase.sign_in_second_factor`).
5. Exige que el administrador haya autenticado recientemente (hasta 15 minutos según `auth_time`). Si la cuenta no admite MFA o no consta el segundo factor, se deniega el acceso.
6. El módulo de consulta de formadores quedó deliberadamente **solo lectura**. Altas y suspensiones se realizan exclusivamente a través del servicio administrativo auditado.

## Preparación manual segura, primero en Firebase de ensayo
1. Crear un **proyecto Firebase nuevo** separado del de producción `calculadora-funcional-7f9d8`.
2. Configurar Firebase Authentication, una cuenta de administrador individual con correo verificado y MFA compatible. Verificar en pruebas que el ID token presente el factor secundario.
3. Un operador con privilegios administrativos debe asignar la claim personalizada `icfgAdmin: true` **solamente** a esa cuenta usando Firebase Admin SDK desde un equipo confiable. El módulo nunca permite autoconcederse permisos.
4. Configurar el UID de esa cuenta en `ICFG_ADMIN_UID` dentro de los secretos de **Vercel Preview/staging**, no en GitHub y no en variables `VITE_*`.
5. Mantener `ICFG_ADMIN_ENABLED=false` hasta contar con pruebas autenticadas al endpoint Vercel protegido y un proyecto de ensayo totalmente separado.
6. Preparar después una interfaz de autenticación administrativa con MFA sin reemplazar la sesión anónima de la aplicación existente; no introducir ni copiar tokens de administración manualmente en la interfaz ordinaria.
7. Solo después de respaldar la colección y probar reglas y operaciones, definir una ventana de migración de Firebase y Vercel. **No publicar reglas candidatas ahora**.

## Riesgos y tareas restantes
- El Preview de Vercel todavía utiliza configuración `VITE_FIREBASE_*` compartida con el proyecto real. No ensayar escrituras en ese Preview mientras no se aísle Firebase.
- El despliegue `READY` no confirma una prueba HTTP autenticada: la protección de Vercel respondió HTTP 401 a solicitudes anónimas.
- Las reglas Firestore reales todavía admiten escritura directa de usuarios Firebase anónimos; restringirlas requiere migrar la creación/consulta de registros cuidadosamente.
- No se ha implementado la interfaz completa de acceso administrativo con MFA, el cambio de contraseña institucional ni la asignación inicial de roles.
- Falta comprobar la verificación de MFA y revocación usando Firebase Auth real en staging. Las pruebas con token simulado no reemplazan esa verificación.
- Las pruebas automatizadas nunca deben contener credenciales institucionales reales ni datos identificables de usuarios.
