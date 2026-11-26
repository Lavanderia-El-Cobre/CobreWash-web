import { createHash } from "node:crypto";
import { serviciosAdmin } from "@/lib/firebase/admin";
import { verificarSesionAdmin } from "@/lib/firebase/sesion-admin";

/** Tamaño máximo permitido por fotografía de inspección en bytes (3 MB). */
export const MAX_FOTO_BYTES = 3 * 1024 * 1024;

/** Patrón UUID estricto para validar identificadores de inspección y fotografía. */
export const UUID_FOTO = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Error controlado con código HTTP para respuestas de los endpoints de evidencias. */
export class ErrorEvidencia extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/**
 * Autentica al usuario vía Bearer token y verifica que tenga permiso sobre la
 * inspección consultando `GetInspeccionParaEvidencias` con sus propios claims.
 *
 * @param request - Solicitud HTTP con cabecera `Authorization: Bearer <token>`.
 * @param inspeccionId - UUID de la inspección objetivo.
 * @returns Servicios de Firebase Admin inicializados para continuar la operación.
 */
export async function autorizarInspeccion(request: Request, inspeccionId: string) {
  if (!UUID_FOTO.test(inspeccionId)) throw new ErrorEvidencia(400, "Inspección inválida.");
  const bearer = request.headers.get("authorization")?.match(/^Bearer (\S+)$/)?.[1];
  if (!bearer) throw new ErrorEvidencia(401, "Inicia sesión nuevamente.");
  const admin = serviciosAdmin();
  const token = await verificarSesionAdmin(admin.auth, bearer, {
    sesionVencida: () => new ErrorEvidencia(401, "La sesión venció. Inicia sesión nuevamente."),
    servidor: () => new ErrorEvidencia(503, "El servidor no pudo validar la sesión. Intenta más tarde."),
  });
  try {
    // Delega el control de acceso a las reglas @auth de Data Connect suplantando al usuario.
    await admin.db.executeQuery("GetInspeccionParaEvidencias", { id: inspeccionId }, { impersonate: { authClaims: token } });
  } catch { throw new ErrorEvidencia(403, "No tienes permiso para consultar o adjuntar evidencia en esta inspección."); }
  return admin;
}

/**
 * Lee el cuerpo binario de la solicitud validando en streaming el límite de 3 MB
 * (sin confiar solo en `Content-Length`) y comprobando la firma mágica JPEG (`FF D8 FF`).
 *
 * @param request - Solicitud HTTP cuyo body contiene la imagen JPEG.
 */
export async function leerFoto(request: Request): Promise<Buffer> {
  const size = Number(request.headers.get("content-length"));
  if (size > MAX_FOTO_BYTES) throw new ErrorEvidencia(413, "La fotografía supera los 3 MB.");
  if (!request.body) throw new ErrorEvidencia(400, "Falta la fotografía.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > MAX_FOTO_BYTES) { await reader.cancel(); throw new ErrorEvidencia(413, "La fotografía supera los 3 MB."); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = Buffer.concat(chunks);
  // Verifica magic bytes SOI + marcador de segmento JPEG para rechazar otros formatos renombrados.
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff)
    throw new ErrorEvidencia(400, "La fotografía debe ser una imagen JPEG válida.");
  return bytes;
}

/** Calcula el hash SHA-256 hexadecimal de la fotografía para trazabilidad e integridad. */
export const hashFoto = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

/** Construye la ruta canónica en Firebase Storage para una fotografía de inspección. */
export const rutaFoto = (inspeccionId: string, fotoId: string) => `vehiculos/inspecciones/${inspeccionId}/${fotoId}.jpg`;

/**
 * Traduce un error a respuesta JSON con el status de `ErrorEvidencia`, ocultando
 * detalles internos bajo `503` ante fallos inesperados.
 *
 * @param error - Error capturado en el Route Handler.
 */
export function respuestaErrorEvidencia(error: unknown) {
  return Response.json({ error: error instanceof ErrorEvidencia ? error.message : "No se pudo guardar o recuperar la evidencia. Intenta nuevamente." }, { status: error instanceof ErrorEvidencia ? error.status : 503 });
}
