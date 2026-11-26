import { configuracionLegal } from "@/lib/privacidad/configuracion";
// Fuerza evaluación en runtime para reflejar cambios de publicación legal sin reconstruir.
export const dynamic = "force-dynamic";

/**
 * Expone el estado público mínimo de la configuración legal vigente.
 *
 * - **Contrato HTTP**: `GET /api/privacidad/configuracion`.
 * - **Autenticación**: endpoint público; no expone datos personales ni secretos.
 * - **Caché**: deshabilitada (`Cache-Control: no-store`) para que los formularios
 *   consulten siempre el estado actual de publicación.
 * - **Respuestas**: `200` con `{ publicada, version }`.
 */
export function GET() {
  const { publicada, version } = configuracionLegal();
  return Response.json({ publicada, version }, { headers: { "Cache-Control": "no-store" } });
}
