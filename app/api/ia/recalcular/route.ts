import { randomUUID } from "node:crypto";
import { prepararRecalculo, type DatosRecalculo } from "@/lib/ia/recalculo";
import { autorizarAdminIa, ErrorIa, errorIa, responder } from "@/lib/ia/servidor";

// Requiere runtime Node.js para `node:crypto` y Firebase Admin SDK.
export const runtime = "nodejs";

/**
 * Recalcula las tasas de consumo del Módulo IA a partir de todos los conteos
 * aprobados. Registra un nuevo ajuste en el historial y actualiza la tasa
 * vigente de cada servicio sin modificar el stock actual. Se ejecuta bajo
 * demanda, sin programación automática.
 *
 * - **Contrato HTTP**: `POST /api/ia/recalcular` (sin cuerpo).
 * - **Autenticación y roles**: solo administrador activo (`autorizarAdminIa`).
 * - **Respuestas**:
 *   - `200`: `{ version, observaciones, mae, mape, insumos, descartados }`.
 *   - `400`: datos insuficientes o inválidos para preparar el recálculo.
 *   - `401` / `403`: sesión inválida o sin permisos de administrador.
 *   - `500` / `503`: error al consultar o guardar el ajuste en Data Connect.
 */
export async function POST(request: Request) {
  try {
    const { db, dbProduccion, uid } = await autorizarAdminIa(request);
    const { data } = await db.executeQuery<DatosRecalculo>("GetDatosEntrenamientoIa");
    let preparado;
    try { preparado = prepararRecalculo(data, { id: randomUUID(), usuarioId: uid, ahora: new Date() }); }
    catch (e) { throw new ErrorIa(400, e instanceof Error ? e.message : "No se pudo preparar el recálculo."); }
    await dbProduccion.executeMutation("GuardarAjusteIa", { modelo: preparado.modelo, tasas: preparado.tasas });
    const { modelo, detalle } = preparado;
    return responder({
      version: modelo.version,
      observaciones: modelo.observaciones,
      mae: modelo.mae,
      mape: modelo.mape,
      insumos: detalle.insumos.length,
      descartados: detalle.totalDescartados,
    });
  } catch (e) {
    return errorIa(e);
  }
}
