import { EmailAuthProvider, reauthenticateWithCredential, updatePassword, type Auth } from "firebase/auth";
import { validatePassword } from "@/lib/validators";

/**
 * Cambia la contraseña del usuario autenticado exigiendo primero reautenticación
 * con su contraseña actual. Esto cumple el requisito de sesión reciente de
 * Firebase Auth y evita cambios no autorizados en sesiones dejadas abiertas.
 */
export async function cambiarContrasena(auth: Auth, actual: string, nueva: string, confirmacion: string) {
  const user = auth.currentUser;
  if (!user?.email) throw new Error("Inicia sesión nuevamente para cambiar tu contraseña.");
  if (!actual) throw new Error("Ingresa tu contraseña actual.");
  const validacion = validatePassword(nueva);
  if (!validacion.valid) throw new Error(validacion.message);
  if (nueva !== confirmacion) throw new Error("Las contraseñas nuevas no coinciden.");
  if (actual === nueva) throw new Error("La contraseña nueva debe ser diferente de la actual.");
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, actual));
  await updatePassword(user, nueva);
}
