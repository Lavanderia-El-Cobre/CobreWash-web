import { VERSION_PRIVACIDAD, VERSION_TERMINOS } from "@/lib/privacidad/modelo";

/**
 * Datos de un registro público que espera la verificación del correo. Se
 * guardan solo en el navegador de quien se registra (sin contraseña) para
 * terminar de crear la cuenta al volver desde el enlace de verificación.
 */
export interface RegistroPendiente {
  nombre: string;
  apellido: string;
  rut: string;
  telefono: string;
  direccion: string;
  tipoCliente: string;
  versionPrivacidad: string;
  versionTerminos: string;
  guardadoEn: number;
}

const VIGENCIA_MS = 14 * 86_400_000;
const clave = (uid: string) => `cobre:registro-pendiente:${uid}`;

export function guardarRegistroPendiente(uid: string, datos: Omit<RegistroPendiente, "guardadoEn" | "versionPrivacidad" | "versionTerminos">) {
  try {
    const registro: RegistroPendiente = { ...datos, versionPrivacidad: VERSION_PRIVACIDAD, versionTerminos: VERSION_TERMINOS, guardadoEn: Date.now() };
    localStorage.setItem(clave(uid), JSON.stringify(registro));
  } catch { /* Sin almacenamiento local se completan los datos al volver. */ }
}

export function leerRegistroPendiente(uid: string): RegistroPendiente | null {
  try {
    const valor = localStorage.getItem(clave(uid));
    if (!valor) return null;
    const registro = JSON.parse(valor) as RegistroPendiente;
    const vigente = Date.now() - registro.guardadoEn < VIGENCIA_MS
      && registro.versionPrivacidad === VERSION_PRIVACIDAD && registro.versionTerminos === VERSION_TERMINOS;
    if (!vigente) { localStorage.removeItem(clave(uid)); return null; }
    return registro;
  } catch { return null; }
}

export function borrarRegistroPendiente(uid: string) {
  try { localStorage.removeItem(clave(uid)); } catch { /* nada que borrar */ }
}
