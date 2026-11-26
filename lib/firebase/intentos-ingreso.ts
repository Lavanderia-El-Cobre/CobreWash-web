/**
 * Bloqueo progresivo del inicio de sesión tras contraseñas incorrectas.
 *
 * Complementa la protección de Firebase Auth, que en su servidor bloquea
 * temporalmente una cuenta tras muchos intentos fallidos (auth/too-many-requests).
 * Este control frena antes los intentos desde el mismo navegador:
 *
 * - Los primeros INTENTOS_LIBRES fallos seguidos no se penalizan.
 * - Desde ahí cada fallo bloquea el formulario 30 s, 1 min, 2 min, 4 min...
 *   hasta un máximo de 15 min.
 * - El contador se reinicia al ingresar correctamente o tras una hora sin fallos.
 *
 * No guarda el correo ni la contraseña: solo cuántos fallos hubo y cuándo.
 */
export const INTENTOS_LIBRES = 5;
const BLOQUEO_BASE_MS = 30_000;
const BLOQUEO_MAX_MS = 15 * 60_000;
/** Bloqueo local cuando Firebase ya bloqueó la cuenta en su servidor. */
const BLOQUEO_SERVIDOR_MS = 5 * 60_000;
const OLVIDO_MS = 60 * 60_000;
const CLAVE = "cobre:intentos-ingreso";

/** Códigos de Firebase que corresponden a credenciales incorrectas. */
const CREDENCIALES_INVALIDAS = new Set(["auth/invalid-credential", "auth/wrong-password", "auth/user-not-found", "auth/invalid-login-credentials"]);

interface Registro { fallos: number; ultimoFallo: number; bloqueadoHasta: number }

export interface EstadoIntentos {
  /** Fin del bloqueo vigente (ms) o null si se puede intentar. */
  bloqueadoHasta: number | null;
  /** Intentos que quedan antes del primer bloqueo (0 si ya se bloqueó alguna vez). */
  restantes: number;
}

const VACIO: Registro = { fallos: 0, ultimoFallo: 0, bloqueadoHasta: 0 };

function leer(ahora: number): Registro {
  try {
    const valor = JSON.parse(localStorage.getItem(CLAVE) ?? "null") as Registro | null;
    if (!valor || typeof valor.fallos !== "number") return { ...VACIO };
    // Una hora sin fallos y sin bloqueo vigente reinicia el contador.
    if (ahora - valor.ultimoFallo > OLVIDO_MS && ahora >= valor.bloqueadoHasta) return { ...VACIO };
    return valor;
  } catch { return { ...VACIO }; }
}

function guardar(registro: Registro) {
  try { localStorage.setItem(CLAVE, JSON.stringify(registro)); } catch { /* Sin almacenamiento rige solo el bloqueo de Firebase. */ }
}

function estado(registro: Registro, ahora: number): EstadoIntentos {
  return {
    bloqueadoHasta: registro.bloqueadoHasta > ahora ? registro.bloqueadoHasta : null,
    restantes: Math.max(0, INTENTOS_LIBRES - registro.fallos),
  };
}

/** Calcula los milisegundos de bloqueo exponencial según la cantidad acumulada de fallos. */
export function duracionBloqueo(fallos: number): number {
  if (fallos < INTENTOS_LIBRES) return 0;
  return Math.min(BLOQUEO_BASE_MS * 2 ** (fallos - INTENTOS_LIBRES), BLOQUEO_MAX_MS);
}

/** Devuelve el estado vigente de bloqueo e intentos libres restantes para el navegador actual. */
export function estadoIntentos(ahora = Date.now()): EstadoIntentos {
  return estado(leer(ahora), ahora);
}

/** Indica si el error corresponde a correo o contraseña inválidos y debe contabilizarse como fallo. */
export function esCredencialInvalida(error: unknown): boolean {
  return CREDENCIALES_INVALIDAS.has((error as { code?: string } | null)?.code ?? "");
}

/** Registra un intento fallido y devuelve el bloqueo resultante. */
export function registrarFalloIngreso(error: unknown, ahora = Date.now()): EstadoIntentos {
  const registro = leer(ahora);
  if ((error as { code?: string } | null)?.code === "auth/too-many-requests") {
    registro.bloqueadoHasta = Math.max(registro.bloqueadoHasta, ahora + BLOQUEO_SERVIDOR_MS);
    registro.ultimoFallo = ahora;
  } else if (esCredencialInvalida(error)) {
    registro.fallos += 1;
    registro.ultimoFallo = ahora;
    const bloqueo = duracionBloqueo(registro.fallos);
    if (bloqueo) registro.bloqueadoHasta = ahora + bloqueo;
  } else {
    // Errores de red u otros no cuentan como intento.
    return estado(registro, ahora);
  }
  guardar(registro);
  return estado(registro, ahora);
}

/** Reinicia el registro de intentos fallidos tras un inicio de sesión exitoso. */
export function limpiarIntentosIngreso() {
  try { localStorage.removeItem(CLAVE); } catch { /* nada que borrar */ }
}

/** "1:05" o "45 s" para mostrar el tiempo restante de bloqueo. */
export function formatoEspera(ms: number): string {
  const segundos = Math.max(1, Math.ceil(ms / 1000));
  if (segundos < 60) return `${segundos} s`;
  return `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, "0")} min`;
}
