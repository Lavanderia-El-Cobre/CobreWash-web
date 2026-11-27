import { normalizarTelefono, validarTelefono } from "@/lib/telefonos";
import { VERSION_PRIVACIDAD } from "@/lib/privacidad/modelo";
/** Categorías de servicio aceptadas en el formulario público de contacto y cotización. */
export const SERVICIOS_CONTACTO = ["industrial", "domestica", "retiro-entrega", "otro"];

/**
 * Valida y normaliza el cuerpo de una solicitud pública de contacto/cotización.
 * Exige consentimiento de privacidad vigente, un UUID válido (usado para idempotencia),
 * rechaza saltos de línea en el nombre para evitar inyección de cabeceras de correo
 * y normaliza el teléfono cuando se informa.
 */
export function validarContacto(body: unknown) {
  if (!body || typeof body !== "object") throw new Error("Solicitud inválida.");
  const entrada = body as Record<string, unknown>;
  if (entrada.autorizaDatos !== true || entrada.versionPrivacidad !== VERSION_PRIVACIDAD) throw new Error("Lee el aviso vigente y autoriza el tratamiento para responder tu cotización.");
  const texto = (key: string, max: number) => {
    if (typeof entrada[key] !== "string") throw new Error("Completa todos los campos del formulario.");
    const value = (entrada[key] as string).trim();
    if (!value || value.length > max) throw new Error(`Revisa el campo ${key}.`);
    return value;
  };
  const id = texto("id", 36);
  if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(id)) throw new Error("Identificador de solicitud inválido.");
  const nombre = texto("nombre", 100), email = texto("correo", 120).toLowerCase();
  const telefono = entrada.telefono === undefined || entrada.telefono === "" ? "" : texto("telefono", 20);
  const servicio = texto("servicio", 30), mensaje = texto("mensaje", 2000);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || /[\r\n]/.test(nombre)) throw new Error("Revisa el nombre y el correo.");
  const errorTelefono = validarTelefono(telefono);
  if (errorTelefono) throw new Error(errorTelefono);
  if (!SERVICIOS_CONTACTO.includes(servicio)) throw new Error("Selecciona un servicio válido.");
  return { id, nombre, email, telefono: normalizarTelefono(telefono), servicio, mensaje };
}
