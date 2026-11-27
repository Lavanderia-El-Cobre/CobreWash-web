import { autorizarInspeccion, ErrorEvidencia, hashFoto, leerFoto, respuestaErrorEvidencia, rutaFoto, UUID_FOTO } from "@/lib/vehiculos/evidencias-servidor";

// Requiere runtime Node.js para `sharp`, Firebase Admin SDK y Cloud Storage.
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string; fotoId: string }> };

/**
 * Sube y registra una fotografía JPEG como evidencia de una inspección vehicular.
 *
 * - **Contrato HTTP**: `PUT /api/inspecciones/:id/fotos/:fotoId?orden=1..20&descripcion=...`
 *   con cuerpo binario JPEG (validado y limitado por `leerFoto`).
 * - **Autenticación y roles**: validada por `autorizarInspeccion(request, id)`
 *   (personal autorizado con acceso a la inspección).
 * - **Validaciones y saneamiento**: exige `:fotoId` UUID, `orden` entero `1..20`,
 *   `descripcion` de hasta 200 caracteres y re-codifica con `sharp` (máx. 40 MP,
 *   redimensionado a 2000×2000, calidad 85) para purgar metadatos EXIF/GPS y
 *   descartar archivos corruptos.
 * - **Cupo e idempotencia**: reserva el cupo (máx. 20 fotos por inspección) antes
 *   de escribir en Storage; sube con `ifGenerationMatch: 0` y, ante `412`, valida
 *   que el `sha256` coincida para aceptar reintentos del mismo archivo y rechazar
 *   sobrescrituras con contenido distinto (`409`). Confirma el registro solo tras
 *   asegurar la escritura en el bucket.
 * - **Respuestas**:
 *   - `200`: `{ rutaStorage }`.
 *   - `400`: parámetros inválidos o imagen JPEG ilegible.
 *   - `401` / `403` / `404`: sin sesión, sin permisos o inspección inexistente.
 *   - `409`: cupo de 20 fotografías alcanzado o `fotoId` ya usado por otra imagen.
 *   - `413` / `500` / `503`: archivo excede tamaño o fallo de Storage/BD.
 */
export async function PUT(request: Request, context: Context) {
  try {
    const { id, fotoId } = await context.params;
    if (!UUID_FOTO.test(fotoId)) throw new ErrorEvidencia(400, "Identificador de fotografía inválido.");
    const url = new URL(request.url);
    const orden = Number(url.searchParams.get("orden"));
    const descripcion = url.searchParams.get("descripcion")?.trim() || null;
    if (!Number.isInteger(orden) || orden < 1 || orden > 20 || (descripcion?.length ?? 0) > 200)
      throw new ErrorEvidencia(400, "Datos de fotografía inválidos.");
    const admin = await autorizarInspeccion(request, id);
    const bytes = await leerFoto(request);
    // Decodificar y re-encodear elimina metadatos y rechaza JPEG corruptos.
    const sharp = (await import("sharp")).default;
    const imagen = await sharp(bytes, { limitInputPixels: 40_000_000 }).rotate().resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer()
      .catch(() => { throw new ErrorEvidencia(400, "No se pudo leer la imagen JPEG."); });
    const path = rutaFoto(id, fotoId);
    const file = admin.bucket.file(path);
    const hash = hashFoto(imagen);
    const registro = { id: fotoId, inspeccionId: id, rutaStorage: path, descripcion, orden };
    // El contador se serializa por inspección e incluye reservas pendientes.
    // Una solicitud sin cupo nunca llega a escribir en el bucket.
    try { await admin.db.executeMutation("RegistrarEvidenciaGuardada", { ...registro, confirmar: false }); }
    catch (error) {
      if (String(error).includes("LIMITE_FOTOS")) throw new ErrorEvidencia(409, "La inspección ya tiene 20 fotografías o cargas pendientes. Reintenta con el mismo archivo si una carga no terminó.");
      if (String(error).includes("El identificador de evidencia ya está en uso")) throw new ErrorEvidencia(409, "Ese identificador ya corresponde a otra fotografía.");
      throw error;
    }
    // El ID es estable al reintentar. No se sobrescribe una foto distinta.
    try { await file.save(imagen, { resumable: false, contentType: "image/jpeg", preconditionOpts: { ifGenerationMatch: 0 }, metadata: { metadata: { sha256: hash } } }); }
    catch (error) {
      if ((error as { code?: number }).code !== 412) throw error;
      const [metadata] = await file.getMetadata();
      if (metadata.metadata?.sha256 !== hash) throw new ErrorEvidencia(409, "Ese identificador ya corresponde a otra fotografía.");
    }
    // La reserva solo se publica en las consultas de flota después de guardar el archivo.
    await admin.db.executeMutation("RegistrarEvidenciaGuardada", { ...registro, confirmar: true });
    return Response.json({ rutaStorage: path }, { status: 200 });
  } catch (error) { return respuestaErrorEvidencia(error); }
}

/**
 * Descarga una fotografía de evidencia de inspección desde Cloud Storage.
 *
 * - **Contrato HTTP**: `GET /api/inspecciones/:id/fotos/:fotoId`.
 * - **Autenticación y roles**: validada por `autorizarInspeccion(request, id)`.
 * - **Seguridad**: devuelve `image/jpeg` con `Cache-Control: private, no-store`
 *   y `X-Content-Type-Options: nosniff` para evitar almacenamiento en cachés compartidas.
 * - **Respuestas**:
 *   - `200`: bytes JPEG de la evidencia.
 *   - `400`: `:fotoId` no es un UUID válido.
 *   - `401` / `403`: sesión ausente, inválida o sin acceso a la inspección.
 *   - `404`: inspección o archivo de evidencia inexistente en Storage.
 *   - `500` / `503`: fallo de infraestructura al descargar.
 */
export async function GET(request: Request, context: Context) {
  try {
    const { id, fotoId } = await context.params;
    if (!UUID_FOTO.test(fotoId)) throw new ErrorEvidencia(400, "Fotografía inválida.");
    const admin = await autorizarInspeccion(request, id);
    const file = admin.bucket.file(rutaFoto(id, fotoId));
    const [exists] = await file.exists();
    if (!exists) throw new ErrorEvidencia(404, "No se encontró el archivo de evidencia.");
    const [bytes] = await file.download();
    return new Response(new Uint8Array(bytes), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) { return respuestaErrorEvidencia(error); }
}
