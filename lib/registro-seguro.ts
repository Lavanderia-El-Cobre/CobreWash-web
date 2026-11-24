const CODIGOS = new Set(["unavailable", "permission-denied", "unauthenticated", "invalid-argument", "not-found", "failed-precondition", "resource-exhausted", "deadline-exceeded", "network-request-failed",
  // Envío de correos de Firebase Auth: no contienen datos personales.
  "too-many-requests", "unauthorized-continue-uri", "invalid-continue-uri", "missing-continue-uri", "unauthorized-domain", "quota-exceeded", "internal-error", "user-token-expired"]);
/** No registrar objetos de error: pueden incluir variables GraphQL, correos o credenciales. */
export function registrarError(contexto: string, error: unknown) {
  const codigo = error && typeof error === "object" && "code" in error ? String(error.code).split("/").at(-1) : undefined;
  console.error(contexto, codigo && CODIGOS.has(codigo) ? codigo : "sin-codigo-publico");
}
