import { TipoCliente } from "@/src/dataconnect-generated";
import { isValidRut, validatePassword } from "@/lib/validators";
import { VERSION_PRIVACIDAD, VERSION_TERMINOS } from "@/lib/privacidad/modelo";
import { validarTelefono } from "@/lib/telefonos";

/** Datos base requeridos para registrar una cuenta de cliente. */
export interface ClientRegistrationInput {
  nombre: string;
  apellido: string;
  rut: string;
  telefono: string;
  email: string;
  direccion: string;
  tipoCliente: TipoCliente | "";
  password: string;
}

/** Aceptación del titular: términos y autorización de datos, cada uno por separado. */
export interface AceptacionCondiciones {
  aceptaTerminos: boolean;
  versionTerminos: string;
  autorizaDatos: boolean;
  versionPrivacidad: string;
}

/** Datos del formulario público de registro de clientes, incluyendo confirmación de contraseña y consentimientos. */
export interface PublicClientRegistrationInput extends ClientRegistrationInput, AceptacionCondiciones {
  confirmPassword: string;
}

/** Datos para terminar un registro cuyo correo ya fue verificado. */
export type ClientCompletionInput = Omit<ClientRegistrationInput, "email" | "password"> & AceptacionCondiciones;

/** Alta desde administración: sin contraseña, la persona la crea con el enlace de su correo. */
export interface ManagedUserRegistrationInput extends Omit<ClientRegistrationInput, "password"> {
  rolId: string;
  /** El administrador confirma que informó a la persona de los términos y del aviso. */
  informado?: boolean;
}

/**
 * Comprueba que el tipo de cliente esté habilitado para autorregistro público.
 * Otros tipos (p. ej. convenios corporativos/mineros) solo se crean desde intranet.
 */
export function isPublicClientType(value: unknown): value is TipoCliente {
  return value === TipoCliente.PARTICULAR || value === TipoCliente.HOTEL;
}

/** Valida que el formulario de inicio de sesión tenga correo y contraseña; devuelve mensaje de error o `null`. */
export function validateLogin(email: string, password: string): string | null {
  if (!email.trim() || !password.trim()) {
    return "Por favor ingresa tu correo y contraseña.";
  }
  return null;
}

/** Valida que exista un correo para solicitar restablecimiento de contraseña; devuelve mensaje de error o `null`. */
export function validatePasswordReset(email: string): string | null {
  if (!email.trim()) return "Por favor ingresa tu correo electrónico.";
  return null;
}

/**
 * Verifica que el titular haya aceptado explícitamente las versiones vigentes de
 * Términos y Condiciones y del Aviso de Privacidad.
 */
export function validateAceptacion(input: AceptacionCondiciones): string | null {
  if (!input.aceptaTerminos || input.versionTerminos !== VERSION_TERMINOS) return "Lee y acepta los Términos y Condiciones vigentes para crear tu cuenta.";
  if (!input.autorizaDatos || input.versionPrivacidad !== VERSION_PRIVACIDAD) return "Lee el aviso vigente y autoriza el tratamiento para crear tu cuenta.";
  return null;
}

/** Valida el paso final del autorregistro tras verificar el correo; devuelve mensaje de error o `null`. */
export function validateClientCompletion(input: ClientCompletionInput): string | null {
  if (!input.nombre.trim() || !input.apellido.trim() || !input.rut.trim()) return "Completa tu nombre, apellido y RUT.";
  if (!isPublicClientType(input.tipoCliente)) return "Selecciona el tipo de cliente.";
  if (!isValidRut(input.rut)) return "El RUT ingresado no es válido.";
  const telefono = validarTelefono(input.telefono);
  if (telefono) return telefono;
  return validateAceptacion(input);
}

/** Valida todos los campos del registro público de cliente antes de crear la identidad en Firebase Auth. */
export function validatePublicClientRegistration(
  input: PublicClientRegistrationInput,
): string | null {
  if (
    !input.nombre.trim() ||
    !input.apellido.trim() ||
    !input.rut.trim() ||
    !input.email.trim() ||
    !input.password.trim() ||
    !input.confirmPassword.trim()
  ) {
    return "Todos los campos son obligatorios.";
  }
  if (!isPublicClientType(input.tipoCliente)) return "Selecciona el tipo de cliente.";
  if (!isValidRut(input.rut)) return "El RUT ingresado no es válido.";
  const telefono = validarTelefono(input.telefono);
  if (telefono) return telefono;

  const passwordCheck = validatePassword(input.password);
  if (!passwordCheck.valid) return passwordCheck.message;
  if (input.password !== input.confirmPassword) return "Las contraseñas no coinciden.";

  return validateAceptacion(input);
}

/**
 * Valida el alta de un usuario creada desde administración.
 *
 * @param input - Datos ingresados por el administrador (sin contraseña; se enviará invitación).
 * @param roleName - Nombre del rol seleccionado para exigir `tipoCliente` cuando corresponde a `"cliente"`.
 */
export function validateManagedUserRegistration(
  input: ManagedUserRegistrationInput,
  roleName: string | undefined,
): string | null {
  if (
    !input.rolId ||
    !input.nombre.trim() ||
    !input.apellido.trim() ||
    !input.rut.trim() ||
    !input.email.trim()
  ) {
    return "Todos los campos son obligatorios.";
  }
  if (!isValidRut(input.rut)) return "El RUT ingresado no es válido.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) return "Ingresa un correo válido: ahí llegará el enlace para crear la contraseña.";
  const telefono = validarTelefono(input.telefono);
  if (telefono) return telefono;

  if (roleName === "cliente" && !input.tipoCliente) return "Selecciona el tipo de cliente.";
  if (input.informado !== true) return "Confirma que informaste a la persona de los Términos y Condiciones y del Aviso de Privacidad.";

  return null;
}

/** Valida los campos obligatorios y el teléfono al editar un usuario desde administración. */
export function validateManagedUserUpdate(roleId: string, name: string, telefono = ""): string | null {
  if (!roleId || !name.trim()) return "El rol y el nombre son obligatorios.";
  return validarTelefono(telefono);
}
