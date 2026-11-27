import { initializeApp, deleteApp } from "firebase/app";
import { inMemoryPersistence, initializeAuth } from "firebase/auth";
import { firebaseConfig } from "@/lib/firebase/client";

/**
 * Crea una instancia de Firebase totalmente separada de la sesión principal.
 * Permite que un admin cree cuentas de otros usuarios (`createUserWithEmailAndPassword`
 * inicia sesión como el usuario nuevo) sin cerrar su propia sesión.
 *
 * La sesión del usuario nuevo vive solo en memoria: no queda guardada en el
 * navegador del personal y desaparece al invocar `cleanup()` (siempre debe llamarse
 * en un bloque `finally` para liberar la app temporal).
 */
export function createSecondaryFirebaseContext() {
  const app = initializeApp(firebaseConfig, `secondary-${crypto.randomUUID()}`);
  const auth = initializeAuth(app, { persistence: inMemoryPersistence });

  return {
    auth,
    cleanup: () => deleteApp(app),
  };
}
