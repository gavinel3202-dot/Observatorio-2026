/**
 * Credenciales de corta duración: Vercel OIDC -> Google STS ->
 * suplantación limitada de la cuenta ICFG Staging Backend.
 *
 * No aceptar una clave JSON ni delegar en un Firebase institucional.
 * Google comprueba firma, emisor, público y condición de sujeto del proveedor.
 */
export const STAGING_PROJECT = "observatorio-icfg-pruebas";
export const STAGING_PROVIDER =
  "projects/330317380243/locations/global/workloadIdentityPools/icfg-vercel-staging/providers/vercel-icfg-staging";
export const STAGING_SERVICE_ACCOUNT =
  "icfg-staging-backend@observatorio-icfg-pruebas.iam.gserviceaccount.com";

export class IcfgOidcError extends Error {
  constructor(stage, message) {
    super(message);
    this.name = "IcfgOidcError";
    this.stage = stage;
  }
}

const SCOPE = "https://www.googleapis.com/auth/cloud-platform";
const STS_ENDPOINT = "https://sts.googleapis.com/v1/token";
const IAM_ENDPOINT =
  `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${STAGING_SERVICE_ACCOUNT}:generateAccessToken`;

export function requireStagingOidcConfiguration(env = process.env) {
  if (env.VERCEL !== "1" || env.VERCEL_ENV !== "production" ||
      env.ICFG_EXPECTED_FIREBASE_PROJECT_ID !== STAGING_PROJECT ||
      env.ICFG_WORKLOAD_IDENTITY_PROVIDER !== STAGING_PROVIDER ||
      env.ICFG_SERVICE_ACCOUNT_EMAIL !== STAGING_SERVICE_ACCOUNT ||
      env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON) {
    throw new IcfgOidcError("server_configuration", "Identidad de servidor ICFG de ensayos no configurada.");
  }
}

export function vercelOidcTokenFromHeaders(headers) {
  const raw = headers?.["x-vercel-oidc-token"];
  const token = Array.isArray(raw) ? raw[0] : raw;
  if (typeof token !== "string" || token.length > 12000 ||
      !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) {
    throw new IcfgOidcError("vercel_oidc", "Token OIDC de Vercel no disponible.");
  }
  return token;
}

async function postJSON(url, { headers, body, fetchImpl }) {
  const result = await fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(12000),
  });
  if (!result.ok) throw new IcfgOidcError("iam_impersonation", "Google Cloud rechazó la suplantación temporal.");
  return result.json();
}

export async function getShortLivedServiceAccountToken(
  oidcToken, { fetchImpl = fetch, now = Date.now, env = process.env } = {},
) {
  requireStagingOidcConfiguration(env);
  // Valida la estructura local. La firma y claims los verifica Google STS.
  vercelOidcTokenFromHeaders({ "x-vercel-oidc-token": oidcToken });

  const form = new URLSearchParams({
    audience: `//iam.googleapis.com/${STAGING_PROVIDER}`,
    grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
    requested_token_type: "urn:ietf:params:oauth:token-type:access_token",
    scope: SCOPE,
    subject_token_type: "urn:ietf:params:oauth:token-type:jwt",
    subject_token: oidcToken,
  });
  const exchange = await fetchImpl(STS_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
    signal: AbortSignal.timeout(12000),
  });
  if (!exchange.ok) throw new IcfgOidcError("google_sts", "Google STS rechazó la identidad del despliegue.");
  const temporary = await exchange.json();
  if (typeof temporary?.access_token !== "string" || temporary.access_token.length < 20) {
    throw new IcfgOidcError("google_sts", "Google STS no devolvió una credencial temporal válida.");
  }

  const result = await postJSON(IAM_ENDPOINT, {
    fetchImpl,
    headers: { Authorization: `Bearer ${temporary.access_token}` },
    body: { scope: [SCOPE], lifetime: "3600s" },
  });
  const remaining = Math.floor((Date.parse(result?.expireTime) - now()) / 1000) - 60;
  if (typeof result?.accessToken !== "string" || result.accessToken.length < 20 ||
      !Number.isFinite(remaining) || remaining < 60) {
    throw new IcfgOidcError("iam_impersonation", "Google IAM no devolvió una sesión de servicio válida.");
  }
  return { access_token: result.accessToken, expires_in: Math.min(remaining, 3500) };
}
