/**
 * API de administración de formadores. Únicamente solicitudes autenticadas.
 * La validación final de identidad, MFA y permisos ocurre en el servidor.
 */
export async function requestTrainerAdmin(token, payload, http = fetch) {
  if (typeof token !== "string" || !token.trim()) {
    throw new Error("Se requiere autenticación administrativa.");
  }
  if (!payload || !["get", "set"].includes(payload.action)) {
    throw new Error("Operación administrativa inválida.");
  }

  let response;
  try {
    response = await http("/api/icfg-admin-formadores", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      credentials: "same-origin",
      cache: "no-store",
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error("No se pudo establecer conexión con el servidor de administración.");
  }

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.error || "Operación administrativa no completada.");
    error.status = response.status;
    throw error;
  }
  return result;
}

export function normalizeAdminTrainerCode(value) {
  return String(value || "").trim().toUpperCase();
}
