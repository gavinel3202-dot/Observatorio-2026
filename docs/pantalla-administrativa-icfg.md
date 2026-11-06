# Pantalla administrativa de formadores – Observatorio 2026 ICFG

**Estado: desarrollada en rama de pruebas, OCULTA POR DEFECTO. No habilitar todavía.**

## ¿Qué incluye?
- Pestaña **Administración (ensayo)** para consultar cada código de formador y registrar nuevas altas, suspensiones y reactivaciones.
- Acceso con correo y contraseña **personal** de administrador en Firebase Authentication.
- Segundo factor **TOTP** previamente inscrito en una aplicación autenticadora. La implementación inicial **no admite SMS**: si la cuenta solo tiene SMS, el formulario explica que falta TOTP. La inscripción de TOTP se realiza fuera de esta pantalla durante el aprovisionamiento.
- Confirmación antes de modificar permisos, campo de motivo obligatorio, control de versiones y auditoría privada.
- Token Firebase obtenido justo antes de cada solicitud; nunca se guarda contraseña ni token en `localStorage` o `sessionStorage`.
- Instancia **separada** de Firebase Auth, para no cerrar ni sustituir el usuario anónimo de consultas/registro que utiliza actualmente Observatorio.
- Cierre de sesión explícito y al abandonar la pestaña. El servidor decide permisos, no la pestaña.

## Protección en tres capas
1. **Interfaz:** pestaña oculta salvo cuando `VITE_ICFG_ADMIN_UI=true` en un **Preview aislado**. Sin esa variable no aparece.
2. **Servidor:** `api/icfg-admin-formadores.js` devuelve 503 salvo `ICFG_ADMIN_ENABLED=true`. Es una variable del servidor; NO lleva prefijo `VITE_`.
3. **Permisos:** el backend solo autoriza a un UID explícitamente configurado en `ICFG_ADMIN_UID` y con custom claim `icfgAdmin: true`, cuenta activa, correo verificado, contraseña individual + MFA verificado, ID token no revocado y autenticación de hace máximo 15 minutos. Sin verificación, no se accede a Firestore Admin.

El uso de `VITE_ICFG_ADMIN_UI` **no concede permisos**. Se requiere habilitación separada de las tres capas.

## Cómo se verá cuando esté habilitada en staging
1. El administrador entra en **Administración (ensayo)**, escribe correo y contraseña personal.
2. Firebase exige segundo factor. Introduce el código temporal de la aplicación autenticadora TOTP.
3. Busca el código del formador. El backend confirma si existe, su estado y revisión.
4. Si es alta nueva, ingresa nombre; si es modificación, selecciona si el formador está activo.
5. Escribe el motivo, confirma la operación y recibe resultado con número de revisión.
6. Firestore Admin actualiza el registro existente y crea auditoría en una transacción. No hay borrado físico.

## Condiciones pendientes antes de habilitar
- [ ] Crear un **proyecto Firebase de staging independiente**. La vista previa actual utiliza las variables de conexión de Firebase producción `calculadora-funcional-7f9d8`. **No activar la pestaña sobre esa configuración.**
- [ ] Habilitar Authentication con MFA/TOTP en staging, registrar una cuenta de ensayo de administrador con correo verificado e inscribir TOTP. Verificar requisitos de Identity Platform y costos.
- [ ] Asignar claim `icfgAdmin: true` exclusivamente a esa cuenta mediante SDK administrativo fuera del navegador.
- [ ] Configurar `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON`, `ICFG_ADMIN_UID` y la bandera del servidor **solo en un entorno de staging con secretos**.
- [ ] Probar con cuenta de ensayo real el desafío TOTP, permisos, bloqueo de sesión y operaciones completas.
- [ ] Verificar la IP y acceso HTTP autenticado mediante `vercel curl`, sin desactivar protección de despliegue.
- [ ] Hacer respaldo y verificar restauración antes de cambiar reglas de producción.
- [ ] Revisar reglas de lectura de datos personales, acceso anónimo vigente y la migración coordinada.

## Referencias técnicas
- `src/icfgAdminAuth.js`: instancia Firebase Auth aislada, login email/contraseña y TOTP.
- `src/AdminFormadores.jsx`: interfaz.
- `src/icfgAdminClient.js`: solicitudes a backend.
- `api/_lib/adminAuthorization.js`: verificación de rol, MFA y UID.
- `api/icfg-admin-formadores.js`: servicio API, deshabilitado por defecto.
- `api/_lib/adminTrainerService.js`: transacciones y auditoría.

**No utilizar credenciales reales en capturas, commits, pruebas ni mensajes de chat.**
