# Protocolo de preparación de staging para ICFG

Estado: preparación. El proyecto Firebase de ensayo aún debe ser creado y autorizado desde la conexión Firebase de la persona responsable.

## Separación obligatoria

- Firebase de ensayo distinto del proyecto utilizado por Observatorio público.
- Proyecto Vercel de ensayo separado, con acceso restringido, sin dominios de producción y sin variables copiadas del proyecto público.
- Repositorio: rama feature/edicion-evaluaciones-autorizadas; nunca fusionar a main como parte de la preparación.
- El entorno de ensayo tendrá únicamente datos sintéticos. Nunca importar exportaciones con datos identificables.
- Mantener ICFG_ADMIN_ENABLED, ICFG_SESSION_ENABLED e ICFG_CORRECTIONS_ENABLED en false hasta concluir las verificaciones.
- Mantener VITE_ICFG_ADMIN_UI y VITE_ICFG_CORRECTION_ACCESS en false hasta demostrar aislamiento de Firebase.
- No asignar tokens, claves privadas, contraseñas ni cuentas reales en documentación, issues o chat.

## Comprobaciones previas a activar

1. Confirmar ID del Firebase de ensayo y diferenciarlo del de producción.
2. Activar Authentication con correo y contraseña, verificar requisitos para TOTP/MFA y configurar un administrador de ensayo con permiso limitado.
3. Confirmar que los permisos del administrador y la autenticación por MFA se validan en el servidor.
4. Configurar en el proyecto Vercel de ensayo exclusivamente los parámetros de Firebase de ensayo; validar el project_id del JSON servidor frente al proyecto de ensayo autorizado.
5. Preparar registros ficticios de formadores y evaluaciones.
6. Verificar consulta, alta, suspensión, corrección, control de versión y auditoría; probar además el rechazo cuando se presentan credenciales erróneas.
7. Auditar reglas de Firestore. El backend por sí solo no impide escrituras directas de sesiones anónimas con las reglas antiguas.
8. Realizar respaldo y restauración de pruebas antes de planificar cualquier migración real.

## Estado de accesos en esta sesión

- GitHub: modificaciones y pruebas de rama de desarrollo disponibles.
- Vercel: despliegues consultables, pero acceso a la configuración del equipo denegado por el proveedor; no se cambió la configuración.
- Firebase: integración oficial sugerida, aún sin confirmación de conexión; no se creó proyecto.
- No se realizaron operaciones de escritura en Firebase real ni cambios en producción.
