import { createHash, createHmac } from "node:crypto";
import { serviciosAdmin } from "@/lib/firebase/admin";
import { validarContacto } from "@/lib/contacto/validar";
import { configuracionLegal } from "@/lib/privacidad/configuracion";
import { VERSION_PRIVACIDAD } from "@/lib/privacidad/modelo";
import { ErrorOrigenSolicitud, origenSolicitud } from "@/lib/solicitudes/origen";

// Requiere runtime Node.js para `node:crypto` (SHA-256 / HMAC) y Firebase Admin SDK.
export const runtime = "nodejs";
type Confirmacion = { solicitudContacto?: { id: string; hashContenido: string } | null };

/**
 * Recibe y persiste solicitudes públicas del formulario de contacto/cotización.
 *
 * - **Contrato HTTP**: `POST /api/contacto` con cuerpo JSON validado por
 *   `validarContacto` (límite estricto de 16 KiB leído por stream).
 * - **Autenticación**: endpoint público; requiere que el aviso de privacidad
 *   esté publicado (`configuracionLegal().publicada`).
 * - **Idempotencia**: deduplica reintentos por `entrada.id` y SHA-256 del
 *   contenido normalizado (incluyendo condiciones de carrera en escritura).
 * - **Rate limiting**: ventana fija por hora e IP seudonimizada mediante
 *   HMAC-SHA256 con `CONTACT_RATE_LIMIT_SALT` (mínimo 32 caracteres).
 * - **Respuestas**:
 *   - `201`: solicitud registrada (`{ id }`).
 *   - `200`: reintento idempotente con el mismo `id` y contenido (`{ id }`).
 *   - `400`: cuerpo vacío, > 16 KiB, JSON malformado o validación fallida.
 *   - `409`: el `id` ya existía asociado a datos distintos.
 *   - `429`: se excedió el límite horario de solicitudes desde ese origen.
 *   - `503`: aviso no publicado, falta `CONTACT_RATE_LIMIT_SALT` o fallo de BD.
 */
export async function POST(request: Request) {
  if (!configuracionLegal().publicada) return Response.json({ error: "El formulario se habilitará cuando se publique el aviso de privacidad aprobado. Puedes contactarnos por los canales de atención indicados en el sitio." }, { status: 503 });
  let entrada;
  try {
    // Lee el stream con corte temprano en 16 KiB para evitar agotar memoria con payloads grandes.
    const reader = request.body?.getReader();
    if (!reader) throw new Error("Solicitud vacía.");
    const chunks: Uint8Array[] = []; let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        size += value.length;
        if (size > 16_384) { await reader.cancel(); throw new Error("La solicitud supera el tamaño permitido."); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    entrada = validarContacto(JSON.parse(Buffer.concat(chunks).toString("utf8")));
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Revisa el formulario." }, { status: 400 }); }
  try {
    const { db } = serviciosAdmin();
    const hashContenido = createHash("sha256").update(JSON.stringify(entrada)).digest("hex");
    const comprobar = () => db.executeQuery<Confirmacion, { id: string }>("GetSolicitudContactoConfirmada", { id: entrada.id });
    const previo = (await comprobar()).data.solicitudContacto;
    if (previo) return previo.hashContenido === hashContenido ? Response.json({ id: previo.id }) : Response.json({ error: "Esa solicitud ya fue recibida con otros datos." }, { status: 409 });
    const salt = process.env.CONTACT_RATE_LIMIT_SALT;
    if (!salt || salt.length < 32) return Response.json({ error: "El canal de solicitudes no está disponible. Contáctanos por teléfono o correo." }, { status: 503 });
    const ip = origenSolicitud(request);
    const origen = createHmac("sha256", salt).update(ip).digest("hex");
    // Bucket de ventana fija de 1 hora (3.600.000 ms) vinculado al hash del origen.
    const limiteId = `${Math.floor(Date.now() / 3_600_000)}:${origen}`;
    // Si otra solicitud concurrente creó el bucket en paralelo, confirma su existencia antes de continuar.
    try { await db.executeMutation("PrepararLimiteContacto", { id: limiteId }); }
    catch {
      const existente = await db.executeQuery<{ limiteContacto: { id: string } | null }, { id: string }>("GetLimiteContacto", { id: limiteId });
      if (!existente.data.limiteContacto) throw new Error("No se pudo preparar el límite.");
    }
    try { await db.executeMutation("RegistrarSolicitudContacto", { ...entrada, hashContenido, limiteId, versionPrivacidad: VERSION_PRIVACIDAD }); }
    catch (error) {
      // Ante carrera de reintento simultáneo, verifica si la solicitud ya quedó guardada con el mismo contenido.
      const guardada = (await comprobar()).data.solicitudContacto;
      if (guardada?.hashContenido === hashContenido) return Response.json({ id: guardada.id });
      if (String(error).includes("Límite de solicitudes")) return Response.json({ error: "Alcanzaste el límite de solicitudes. Intenta más tarde o contáctanos directamente." }, { status: 429 });
      throw error;
    }
    return Response.json({ id: entrada.id }, { status: 201 });
  } catch (error) {
    if (error instanceof ErrorOrigenSolicitud) return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: "No pudimos guardar tu solicitud. Conservamos tus datos para que puedas reintentar." }, { status: 503 });
  }
}
