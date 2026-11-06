/**
 * Lógica de acceso reutilizable y comprobable sin datos reales.
 * Solo servidor: recibe un limitador y un directorio privados.
 */
import {
  verifyInstitutionalPassword, issueTrainerToken,
} from "./institutionalAuth.js";

export async function authenticateTrainer({
  code, password, ip, hash, sessionSecret, epoch, limiter, directory,
}) {
  const limit = await limiter.check(ip, code);
  if (!limit.allowed) {
    return {
      status: 429,
      retryAfterSeconds: limit.retryAfterSeconds,
      body: { error: "Demasiados intentos. Inténtalo más tarde." },
    };
  }

  // Mismo mensaje para contraseña incorrecta o código inexistente.
  if (!verifyInstitutionalPassword(password, hash)) {
    await limiter.recordFailure(ip, code);
    return { status: 401, body: { error: "Credenciales inválidas." } };
  }

  const trainer = await directory.getActive(code);
  if (!trainer) {
    await limiter.recordFailure(ip, code);
    return { status: 401, body: { error: "Credenciales inválidas." } };
  }

  // Este módulo nunca concede permisos de administrador.
  const token = issueTrainerToken({ code: trainer.code, secret: sessionSecret, epoch });
  await limiter.recordSuccess(ip, code);
  return {
    status: 200,
    body: { token, expiresInSeconds: 900, code: trainer.code },
  };
}
