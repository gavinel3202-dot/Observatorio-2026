/**
 * Autorización del administrador ICFG.
 * A diferencia de los formadores, el administrador usa Firebase Auth
 * individual con MFA verificado por el servidor. Nunca se concede este
 * rol utilizando la contraseña institucional compartida.
 */
export class AdminAccessError extends Error {
  constructor(status = 403, message = "Acceso administrativo no autorizado.", reason = "unauthorized") {
    super(message);
    this.status = status;
    // Etiqueta no sensible para diagnóstico del servidor. Nunca incluir
    // nombres, UID, tokens ni otros datos de autenticación en registros.
    this.reason = reason;
    this.name = "AdminAccessError";
  }
}

export async function verifyAdministrator({
  authorization, authClient, allowedUid, now = Date.now(),
}) {
  if (typeof authorization !== "string" ||
      !/^Bearer [A-Za-z0-9._-]{20,8192}$/.test(authorization)) {
    throw new AdminAccessError(401, "Se requiere una sesión administrativa.");
  }
  if (!authClient?.verifyIdToken || !authClient?.getUser ||
      typeof allowedUid !== "string" || allowedUid.length < 8) {
    throw new Error("Configuración administrativa incompleta.");
  }

  let token;
  try {
    // Comprueba la firma de Firebase y si las credenciales fueron revocadas.
    token = await authClient.verifyIdToken(authorization.slice(7), true);
  } catch {
    throw new AdminAccessError(401, "Sesión administrativa inválida o revocada.");
  }

  // Etiquetas separadas permiten diagnosticar fallos sin revelar datos
  // personales ni reducir las verificaciones de autorización.
  if (token.uid !== allowedUid) {
    throw new AdminAccessError(403, undefined, "uid_mismatch");
  }
  if (token.icfgAdmin !== true) {
    throw new AdminAccessError(403, undefined, "claim_missing");
  }
  if (token.email_verified !== true) {
    throw new AdminAccessError(403, undefined, "token_email_unverified");
  }
  if (token.firebase?.sign_in_provider !== "password") {
    throw new AdminAccessError(403, undefined, "provider_invalid");
  }
  if (token.firebase?.sign_in_second_factor !== "totp") {
    throw new AdminAccessError(403, undefined, "totp_missing");
  }

  const seconds = Math.floor(now / 1000);
  const authTime = token.auth_time;
  if (!Number.isInteger(authTime) || authTime > seconds + 30 ||
      seconds - authTime > 15 * 60) {
    throw new AdminAccessError(401, "El administrador debe autenticarse de nuevo con MFA.");
  }

  let record;
  try {
    record = await authClient.getUser(token.uid);
  } catch {
    throw new AdminAccessError();
  }
  if (record.disabled) {
    throw new AdminAccessError(403, undefined, "record_disabled");
  }
  if (record.emailVerified !== true) {
    throw new AdminAccessError(403, undefined, "record_email_unverified");
  }
  if (record.customClaims?.icfgAdmin !== true) {
    throw new AdminAccessError(403, undefined, "record_claim_missing");
  }

  return {
    uid: token.uid,
    role: "admin",
    mfaVerified: true,
    factor: token.firebase.sign_in_second_factor,
    authenticatedAt: authTime,
  };
}
