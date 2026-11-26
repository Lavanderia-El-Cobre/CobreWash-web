import { autorizarAdministrador, errorPrivacidad, responder } from "@/lib/privacidad/servidor";
import { normalizarCodigoQr } from "@/lib/seguimiento/qr";
import type { ListarSolicitudesDerechoData } from "@/src/dataconnect-generated";
// Requiere runtime Node.js para Firebase Admin SDK y verificación de sesión.
export const runtime = "nodejs";

/**
 * Lista la bandeja administrativa de solicitudes de derechos ARCO+.
 *
 * - **Contrato HTTP**: `GET /api/privacidad/gestion?pagina=0&respondidas=0|1`.
 *   - `pagina`: índice de página acotado a `[0, 100_000]` (20 registros por página).
 *   - `respondidas`: `"1"` consulta solo `RESPONDIDA`; cualquier otro valor lista
 *     pendientes (`RECIBIDA`, `VERIFICACION`, `EN_GESTION`).
 * - **Autenticación y roles**: solo administrador activo (`autorizarAdministrador`).
 * - **Respuestas**:
 *   - `200`: listado paginado con los IDs normalizados al formato de comprobante.
 *   - `401` / `403`: sesión ausente, vencida o sin rol administrador activo.
 *   - `500` / `503`: fallo al consultar Data Connect.
 */
export async function GET(request: Request) {
  try {
    const { db } = await autorizarAdministrador(request);
    const pagina = Math.max(0, Math.min(100_000, Number(new URL(request.url).searchParams.get("pagina")) || 0));
    const estados = new URL(request.url).searchParams.get("respondidas") === "1" ? ["RESPONDIDA"] : ["RECIBIDA", "VERIFICACION", "EN_GESTION"];
    const { data } = await db.executeQuery<ListarSolicitudesDerechoData, { offset: number; estados: string[] }>("ListarSolicitudesDerecho", { offset: Math.floor(pagina) * 20, estados });
    return responder({ ...data, solicitudDerechos: data.solicitudDerechos.map(s => ({ ...s, id: normalizarCodigoQr(s.id) })) });
  } catch (e) { return errorPrivacidad(e); }
}
