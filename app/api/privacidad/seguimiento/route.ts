import { timingSafeEqual } from "node:crypto";
import { serviciosAdmin } from "@/lib/firebase/admin";
import { ErrorPrivacidad, errorPrivacidad, hash, leerJsonLimitado, responder } from "@/lib/privacidad/servidor";
// Requiere runtime Node.js para `node:crypto` (`timingSafeEqual`) y Firebase Admin SDK.
export const runtime = "nodejs";

/**
 * Consulta pública del estado de una solicitud de derechos ARCO+ mediante su
 * comprobante privado (`id` + `secreto`).
 *
 * - **Contrato HTTP**: `POST /api/privacidad/seguimiento` con JSON limitado por
 *   `leerJsonLimitado`: `{ id: UUID, secreto: hex64 }`.
 * - **Autenticación y seguridad**: endpoint público sin sesión; compara el hash
 *   SHA-256 del secreto en tiempo constante (`timingSafeEqual`) para evitar
 *   ataques de temporización y responde `404` tanto si el ID no existe como si
 *   el secreto no coincide (anti-enumeración).
 * - **Respuestas**:
 *   - `200`: `{ estado, recibidoEn, objetivoAtencion }` (sin datos personales).
 *   - `400`: formato inválido de `id`, `secreto` o JSON.
 *   - `404`: comprobante inexistente o secreto incorrecto.
 *   - `500` / `503`: fallo de disponibilidad del backend.
 */
export async function POST(request: Request) {
  try {
    const b = await leerJsonLimitado(request);
    if (!b || typeof b.id !== "string" || !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(b.id) || typeof b.secreto !== "string" || !/^[\da-f]{64}$/i.test(b.secreto)) throw new ErrorPrivacidad(400, "Comprobante inválido.");
    const { db } = serviciosAdmin();
    const { data } = await db.executeQuery<{ solicitudDerecho: { secretoHash: string; estado: string; creadoEn: string; objetivoAtencion: string } | null }, { id: string }>("GetComprobanteDerecho", { id: b.id });
    const s = data.solicitudDerecho;
    if (!s || !timingSafeEqual(Buffer.from(hash(b.secreto), "hex"), Buffer.from(s.secretoHash, "hex"))) throw new ErrorPrivacidad(404, "Comprobante no encontrado.");
    // Nunca devuelve nombre, correo, detalle ni actuaciones internas.
    return responder({ estado: s.estado, recibidoEn: s.creadoEn, objetivoAtencion: s.objetivoAtencion });
  } catch (e) { return errorPrivacidad(e); }
}
