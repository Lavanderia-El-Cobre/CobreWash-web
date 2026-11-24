import { TipoCliente } from "@/src/dataconnect-generated";
import { isValidRut, validatePassword } from "@/lib/validators";
import { VERSION_PRIVACIDAD, VERSION_TERMINOS } from "@/lib/privacidad/modelo";
import { validarTelefono } from "@/lib/telefonos";

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

export interface PublicClientRegistrationInput extends ClientRegistrationInput, AceptacionCondiciones {
  confirmPassword: string;
}

/** Datos para terminar un registro cuyo correo ya fue verificado. */
export type ClientCompletionInput = Omit<ClientRegistrationInput, "email" | "password"> & AceptacionCondiciones;

export interface ManagedUserRegistrationInput extends ClientRegistrationInput {
  rolId: string;
  /** El administrador confirma que informó a la persona de los términos y del aviso. */
  informado?: boolean;
}

export function isPublicClientType(value: unknown): value is TipoCliente {
  return value === TipoCliente.PARTICULAR || value === TipoCliente.HOTEL;
}

export function validateLogin(email: string, password: string): string | null {
  if (!email.trim() || !password.trim()) {
    return "Por favor ingresa tu correo y contraseña.";
  }
  return null;
}

export function validatePasswordReset(email: string): string | null {
  if (!email.trim()) return "Por favor ingresa tu correo electrónico.";
  return null;
}

export function validateAceptacion(input: AceptacionCondiciones): string | null {
  if (!input.aceptaTerminos || input.versionTerminos !== VERSION_TERMINOS) return "Lee y acepta los Términos y Condiciones vigentes para crear tu cuenta.";
  if (!input.autorizaDatos || input.versionPrivacidad !== VERSION_PRIVACIDAD) return "Lee el aviso vigente y autoriza el tratamiento para crear tu cuenta.";
  return null;
}

export function validateClientCompletion(input: ClientCompletionInput): string | null {
  if (!input.nombre.trim() || !input.apellido.trim() || !input.rut.trim()) return "Completa tu nombre, apellido y RUT.";
  if (!isPublicClientType(input.tipoCliente)) return "Selecciona el tipo de cliente.";
  if (!isValidRut(input.rut)) return "El RUT ingresado no es válido.";
  const telefono = validarTelefono(input.telefono);
  if (telefono) return telefono;
  return validateAceptacion(input);
}

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

export function validateManagedUserRegistration(
  input: ManagedUserRegistrationInput,
  roleName: string | undefined,
): string | null {
  if (
    !input.rolId ||
    !input.nombre.trim() ||
    !input.apellido.trim() ||
    !input.rut.trim() ||
    !input.email.trim() ||
    !input.password.trim()
  ) {
    return "Todos los campos son obligatorios.";
  }
  if (!isValidRut(input.rut)) return "El RUT ingresado no es válido.";
  const telefono = validarTelefono(input.telefono);
  if (telefono) return telefono;

  const passwordCheck = validatePassword(input.password);
  if (!passwordCheck.valid) return passwordCheck.message;
  if (roleName === "cliente" && !input.tipoCliente) return "Selecciona el tipo de cliente.";
  if (input.informado !== true) return "Confirma que informaste a la persona de los Términos y Condiciones y del Aviso de Privacidad.";

  return null;
}

export function validateManagedUserUpdate(roleId: string, name: string, telefono = ""): string | null {
  if (!roleId || !name.trim()) return "El rol y el nombre son obligatorios.";
  return validarTelefono(telefono);
}
