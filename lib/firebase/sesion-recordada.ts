import {
  browserSessionPersistence,
  indexedDBLocalPersistence,
  setPersistence,
  signOut,
  type Auth,
} from "firebase/auth";

/**
 * "Mantener la sesión iniciada".
 *
 * - Sin marcar: la sesión se guarda en sessionStorage y termina al cerrar la
 *   pestaña o el navegador.
 * - Marcada: Firebase guarda la sesión en IndexedDB y sobrevive al cierre del
 *   navegador, pero solo por un máximo de días. Pasado ese plazo se cierra y hay
 *   que volver a ingresar la contraseña.
 *
 * Nunca se guarda la contraseña: Firebase conserva solo su token de renovación,
 * que se revoca al cambiar la contraseña o al desactivar la cuenta.
 */
export const DIAS_SESION_RECORDADA = 30;
const CLAVE = "cobre:sesion-recordada-hasta";

function leerLimite(): number | null {
  try {
    const valor = Number(localStorage.getItem(CLAVE));
    return Number.isFinite(valor) && valor > 0 ? valor : null;
  } catch { return null; }
}

/** Fija dónde se guarda la sesión. Debe llamarse antes de iniciar sesión. */
export async function aplicarRecordarSesion(auth: Auth, recordar: boolean, ahora = Date.now()) {
  await setPersistence(auth, recordar ? indexedDBLocalPersistence : browserSessionPersistence);
  try {
    if (recordar) localStorage.setItem(CLAVE, String(ahora + DIAS_SESION_RECORDADA * 86_400_000));
    else localStorage.removeItem(CLAVE);
  } catch { /* Sin almacenamiento local la sesión no se recuerda entre cierres. */ }
}

/** true si la sesión recordada superó su plazo máximo. */
export function sesionRecordadaVencida(ahora = Date.now()): boolean {
  const limite = leerLimite();
  return limite !== null && ahora >= limite;
}

/** Cierra la sesión si el plazo de "mantener la sesión iniciada" ya venció. */
export async function cerrarSesionRecordadaVencida(auth: Auth, ahora = Date.now()): Promise<boolean> {
  if (!auth.currentUser || !sesionRecordadaVencida(ahora)) return false;
  try { localStorage.removeItem(CLAVE); } catch { /* nada que borrar */ }
  await signOut(auth).catch(() => undefined);
  return true;
}
