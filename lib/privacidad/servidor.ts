import { createHash, createHmac } from "node:crypto";
import { serviciosAdmin } from "@/lib/firebase/admin";
import { verificarSesionAdmin } from "@/lib/firebase/sesion-admin";
import { ErrorOrigenSolicitud, origenSolicitud } from "@/lib/solicitudes/origen";

/** Error controlado con código HTTP y mensaje seguro para endpoints de privacidad. */
export class ErrorPrivacidad extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/** Calcula el hash SHA-256 hexadecimal usado para almacenar secretos de comprobante sin texto plano. */
export const hash = (valor: string) => createHash("sha256").update(valor).digest("hex");

/** Responde JSON con cabeceras estrictas que evitan caché y filtración del Referer en rutas con datos personales. */
export const responder = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });

/** Convierte errores del módulo de privacidad en respuestas HTTP sin exponer detalles internos. */
export function errorPrivacidad(error: unknown) {
  return responder({ error: error instanceof ErrorPrivacidad ? error.message : "No se pudo completar la operación. Conserva el comprobante y reintenta." }, error instanceof ErrorPrivacidad ? error.status : 503);
}

/** Lee y parsea un cuerpo JSON cortando la lectura si supera 20 KB en streaming. */
export async function leerJsonLimitado(request: Request) {
  if (!request.body) throw new ErrorPrivacidad(400, "Solicitud vacía.");
  const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      total += value.length;
      if (total > 20_000) { await reader.cancel(); throw new ErrorPrivacidad(413, "Solicitud demasiado extensa."); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new ErrorPrivacidad(400, "Solicitud inválida."); }
}

/**
 * Prepara la cubeta horaria de rate-limit para solicitudes de derechos usando un
 * HMAC del origen con `CONTACT_RATE_LIMIT_SALT` (mínimo 32 caracteres) para no
 * almacenar IPs en texto plano en la base de datos.
 */
export async function limitarDerechos(request: Request, db: ReturnType<typeof serviciosAdmin>["db"]) {
  const salt = process.env.CONTACT_RATE_LIMIT_SALT;
  if (!salt || salt.length < 32) throw new ErrorPrivacidad(503, "El canal está temporalmente indisponible. Utiliza los datos de contacto de la página de privacidad.");
  let origen: string;
  try { origen = origenSolicitud(request); }
  catch (error) {
    if (error instanceof ErrorOrigenSolicitud) throw new ErrorPrivacidad(error.status, error.message);
    throw error;
  }
  const id = `derechos:${Math.floor(Date.now() / 3_600_000)}:${createHmac("sha256", salt).update(origen).digest("hex")}`;
  try { await db.executeMutation("PrepararLimiteContacto", { id }); }
  catch {
    // Si otra solicitud concurrente creó la cubeta en el mismo instante, basta verificar que exista.
    const r = await db.executeQuery<{ limiteContacto: { id: string } | null }, { id: string }>("GetLimiteContacto", { id });
    if (!r.data.limiteContacto) throw new ErrorPrivacidad(503, "No se pudo preparar la recepción.");
  }
  return id;
}

/**
 * Verifica que la solicitud provenga de un administrador activo: valida el
 * Bearer token con Firebase Admin (vigente y no revocado) y comprueba permisos
 * en Data Connect mediante impersonación.
 */
export async function autorizarAdministrador(request: Request) {
  const bearer = request.headers.get("authorization")?.match(/^Bearer (\S+)$/)?.[1];
  if (!bearer) throw new ErrorPrivacidad(401, "Inicia sesión.");
  const admin = serviciosAdmin();
  const token = await verificarSesionAdmin(admin.auth, bearer, {
    sesionVencida: () => new ErrorPrivacidad(401, "La sesión venció."),
    servidor: () => new ErrorPrivacidad(503, "El servidor no pudo validar la sesión con Firebase. Revisa las credenciales de administración del despliegue."),
  });
  try { await admin.db.executeQuery("AutorizarGestionPrivacidad", {}, { impersonate: { authClaims: token } }); }
  catch { throw new ErrorPrivacidad(403, "Solo un administrador activo puede gestionar datos personales."); }
  return { ...admin, uid: token.uid };
}
