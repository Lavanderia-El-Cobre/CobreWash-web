import type { Auth, DecodedIdToken } from "firebase-admin/auth";

// Fallas del servidor, no del token: credenciales de Admin ausentes o
// inválidas (app/*) o permisos insuficientes del servicio que las usa.
// verifyIdToken(…, true) consulta al usuario en Firebase Auth para revisar la
// revocación, de modo que sin credenciales falla aunque el token sea válido.
const FALLAS_SERVIDOR = new Set(["auth/internal-error", "auth/insufficient-permission", "auth/project-not-found", "auth/invalid-credential"]);

export function codigoError(error: unknown) {
  return error && typeof error === "object" && "code" in error ? String(error.code) : "";
}

export function esFallaCredencialesAdmin(error: unknown) {
  const codigo = codigoError(error);
  return codigo.startsWith("app/") || FALLAS_SERVIDOR.has(codigo);
}

/**
 * Verifica un ID token sin confundir una falla de configuración del servidor
 * con una sesión vencida: la primera se registra con su código (sin datos del
 * token) y se responde con `servidor()`; la segunda con `sesionVencida()`.
 */
export async function verificarSesionAdmin(
  auth: Pick<Auth, "verifyIdToken">,
  bearer: string,
  errores: { sesionVencida: () => Error; servidor: () => Error },
): Promise<DecodedIdToken> {
  try {
    return await auth.verifyIdToken(bearer, true);
  } catch (error) {
    if (!esFallaCredencialesAdmin(error)) throw errores.sesionVencida();
    console.error("Firebase Admin no pudo validar la sesión; revisa FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON:", codigoError(error));
    throw errores.servidor();
  }
}
