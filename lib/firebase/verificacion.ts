import { sendEmailVerification, sendPasswordResetEmail, type ActionCodeSettings, type Auth, type User } from "firebase/auth";

/**
 * Las cuentas creadas desde esta fecha deben verificar su correo antes de
 * usarse. Las anteriores siguen operativas y pueden verificarlo desde su cuenta.
 */
export const INICIO_VERIFICACION_OBLIGATORIA = Date.parse("2026-11-24T00:00:00-03:00");

export class CorreoNoVerificadoError extends Error {
  readonly code = "auth/email-not-verified";
  constructor() {
    super("Verifica tu correo para terminar de crear la cuenta.");
    this.name = "CorreoNoVerificadoError";
  }
}

type UsuarioAuth = Pick<User, "emailVerified" | "metadata">;

export function requiereVerificacion(user: UsuarioAuth | null | undefined): boolean {
  if (!user || user.emailVerified) return false;
  const creada = Date.parse(user.metadata?.creationTime ?? "");
  // Sin fecha confiable se exige la verificación.
  return !Number.isFinite(creada) || creada >= INICIO_VERIFICACION_OBLIGATORIA;
}

const CODIGOS_RETORNO = new Set(["auth/unauthorized-continue-uri", "auth/invalid-continue-uri", "auth/missing-continue-uri", "auth/unauthorized-domain"]);

/**
 * Envía el correo con un enlace que vuelve al inicio de sesión del sitio. Si el
 * dominio aún no está autorizado en Firebase Auth, reintenta sin enlace de
 * retorno para no bloquear el envío.
 */
async function conRetorno(enviar: (ajustes?: ActionCodeSettings) => Promise<void>) {
  const url = typeof window === "undefined" ? undefined : new URL("/?login=1", window.location.origin).toString();
  if (!url) return enviar();
  try {
    await enviar({ url });
  } catch (error) {
    const code = codigo(error);
    if (!code || !CODIGOS_RETORNO.has(code)) throw error;
    try {
      await enviar();
    } catch (reintento) {
      // Firebase acepta un solo envío por minuto: si el reintento choca con ese
      // límite, el correo ya salió en el primer intento y no es un fallo.
      if (codigo(reintento) === "auth/too-many-requests") return;
      throw reintento;
    }
  }
}

const codigo = (error: unknown) => (error as { code?: string } | null)?.code;

export function enviarVerificacion(user: User) {
  return conRetorno((ajustes) => sendEmailVerification(user, ajustes ?? null));
}

/** Invitación para cuentas creadas por el personal: el cliente define su contraseña. */
export function enviarInvitacion(auth: Auth, email: string) {
  return conRetorno((ajustes) => sendPasswordResetEmail(auth, email, ajustes));
}

/** Contraseña aleatoria que nadie conoce: la cuenta se activa con el enlace del correo. */
export function contrasenaTemporal(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const base = Array.from(bytes, (b) => "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"[b % 57]).join("");
  return `${base}aA9!`;
}
