import type { AuthError } from "firebase/auth";

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  "auth/email-already-in-use": "Ya existe una cuenta registrada con este correo.",
  "auth/invalid-email": "El correo electrónico no es válido.",
  "auth/weak-password": "La contraseña es demasiado débil.",
  // Los tres códigos siguientes comparten el mismo mensaje genérico para evitar enumeración de cuentas.
  "auth/invalid-credential": "Correo o contraseña incorrectos.",
  "auth/user-not-found": "Correo o contraseña incorrectos.",
  "auth/wrong-password": "Correo o contraseña incorrectos.",
  "auth/user-disabled": "Esta cuenta se encuentra inactiva. Contacta a un administrador.",
  "auth/too-many-requests": "Demasiados intentos. Intenta nuevamente más tarde.",
  "auth/email-not-verified": "Verifica tu correo para terminar de crear la cuenta. Revisa tu bandeja de entrada o spam.",
};

/**
 * Traduce códigos de error de Firebase Auth (y errores de correo sin verificar de Data Connect)
 * a mensajes seguros y comprensibles para la interfaz.
 */
export function mapAuthError(error: unknown): string {
  const code = (error as AuthError)?.code;
  if (code && AUTH_ERROR_MESSAGES[code]) return AUTH_ERROR_MESSAGES[code];
  if (String(error).includes("CORREO_NO_VERIFICADO")) return AUTH_ERROR_MESSAGES["auth/email-not-verified"];
  return "Ocurrió un error inesperado. Intenta nuevamente.";
}
