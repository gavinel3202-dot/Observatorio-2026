/**
 * Autorización del administrador ICFG.
 * A diferencia de los formadores, el administrador usa Firebase Auth
 * individual con MFA verificado por el servidor. Nunca se concede este
 * rol utilizando la contraseña institucional compartida.
 */
export class AdminAccessError extends Error {
  constructor(status = 403, message = "Acceso administrativo no autorizado.") {
    super(message);
    this.status = status;
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

  if (token.uid !== allowedUid ||
      token.icfgAdmin !== true ||
      token.email_verified !== true ||
      token.firebase?.sign_in_provider === "anonymous" ||
      typeof token.firebase?.sign_in_second_factor !== "string" ||
      token.firebase.sign_in_second_factor.length === 0) {
    throw new AdminAccessError();
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
  if (record.disabled || record.emailVerified !== true ||
      record.customClaims?.icfgAdmin !== true) {
    throw new AdminAccessError();
  }

  return {
    uid: token.uid,
    role: "admin",
    mfaVerified: true,
    factor: token.firebase.sign_in_second_factor,
    authenticatedAt: authTime,
  };
}
