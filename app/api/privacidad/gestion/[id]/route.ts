import { validarGestionDerecho } from "@/lib/privacidad/modelo";
import { autorizarAdministrador, ErrorPrivacidad, errorPrivacidad, leerJsonLimitado, responder } from "@/lib/privacidad/servidor";
// Requiere runtime Node.js para Firebase Admin SDK y verificación de sesión.
export const runtime = "nodejs";

/**
 * Registra una actuación o cambio de estado sobre una solicitud de derechos ARCO+.
 *
 * - **Contrato HTTP**: `POST /api/privacidad/gestion/:id` con cuerpo JSON
 *   validado por `validarGestionDerecho` más `revision` (entero seguro `>= 0`).
 * - **Autenticación y roles**: solo administrador activo (`autorizarAdministrador`);
 *   el `uid` queda auditado como `actorId`.
 * - **Concurrencia optimista**: verifica `revision` en la mutación para evitar
 *   sobrescribir cambios hechos en paralelo por otro administrador (`409`).
 * - **Respuestas**:
 *   - `200`: `{ ok: true }`.
 *   - `400`: `:id` no es UUID, cuerpo inválido o `revision` fuera de rango.
 *   - `401` / `403`: sesión inválida o sin rol administrador activo.
 *   - `409`: conflicto de versión (`REVISION_PRIVACIDAD`); requiere refrescar la bandeja.
 *   - `500` / `503`: error interno o de disponibilidad del backend.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { db, uid } = await autorizarAdministrador(request);
    const { id } = await context.params;
    if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(id)) throw new ErrorPrivacidad(400, "Solicitud inválida.");
    const raw = await leerJsonLimitado(request); let datos;
    try { datos = validarGestionDerecho(raw); }
    catch (e) { throw new ErrorPrivacidad(400, (e as Error).message); }
    if (!Number.isSafeInteger(raw.revision) || raw.revision < 0) throw new ErrorPrivacidad(400, "Revisión inválida.");
    try { await db.executeMutation("GestionarSolicitudDerecho", { ...datos, id, actorId: uid, revision: raw.revision }); }
    catch (e) { if (String(e).includes("REVISION_PRIVACIDAD")) throw new ErrorPrivacidad(409, "La solicitud cambió. Actualiza la bandeja antes de guardar."); throw e; }
    return responder({ ok: true });
  } catch (e) { return errorPrivacidad(e); }
}
