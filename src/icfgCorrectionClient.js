/**
 * Cliente de correcciones. Solo comunica con funciones HTTPS propias.
 * El token se conserva exclusivamente en memoria del componente React.
 * Nunca almacenar contraseñas ni tokens en localStorage.
 */
async function request(url, body, token = null, clientFetch = fetch) {
  let response;
  try {
    response = await clientFetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: "same-origin",
      cache: "no-store",
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("No se pudo conectar al servicio institucional.");
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || "Operación no completada.");
    error.status = response.status;
    throw error;
  }
  return payload;
}

export async function createTrainerSession(code, password, clientFetch = fetch) {
  return request("/api/icfg-session", { code, password }, null, clientFetch);
}

export async function submitCorrection(token, body, clientFetch = fetch) {
  if (!token) throw new Error("Se requiere una sesión de formador.");
  return request("/api/icfg-corrections", body, token, clientFetch);
}

export function changedFieldsFromAudit(after) {
  const person = {};
  const scores = {};
  for (const [field, value] of Object.entries(after || {})) {
    if (field.startsWith("scores.")) scores[field.slice(7)] = value;
    else person[field] = value;
  }
  return { person, scores };
}
