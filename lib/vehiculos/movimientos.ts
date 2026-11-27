import { getMovimientoFlotaPorInspeccion } from "@/src/dataconnect-generated";
import { dataConnect } from "@/lib/firebase/client";
import { normalizarCodigoQr } from "@/lib/seguimiento/qr";
import { subirEvidencia } from "./evidencias";
import type { EvidenciaFotoInput } from "./modelo";

/**
 * Guarda una salida o un regreso de forma idempotente. El ID de la inspección
 * se genera al abrir el formulario: si una respuesta anterior se perdió, la
 * lectura previa (`SERVER_ONLY`) encuentra el movimiento y evita registrarlo dos veces.
 *
 * @param inspeccionId - UUID pregenerado para la inspección del movimiento.
 * @param registrar - Mutación que persiste el movimiento cuando aún no existe.
 * @returns UUID canónico de la inspección donde deben adjuntarse las fotografías.
 */
export async function confirmarMovimientoFlota(
  inspeccionId: string,
  registrar: () => Promise<{ data: { inspeccion: { id: string } } }>,
): Promise<string> {
  const previa = await getMovimientoFlotaPorInspeccion(
    dataConnect,
    { id: inspeccionId },
    { fetchPolicy: "SERVER_ONLY" },
  );
  const id = previa.data.inspeccionVehiculo?.id ?? (await registrar()).data.inspeccion.id;
  return normalizarCodigoQr(id);
}

/**
 * Sube secuencialmente y en orden las fotografías de una inspección. Cada foto
 * conserva su UUID, de modo que reintentar tras un fallo no duplica las ya guardadas.
 *
 * @param inspeccionId - UUID de la inspección ya confirmada.
 * @param fotos - Fotografías pendientes a subir.
 * @param alGuardar - Callback opcional invocado tras confirmar cada fotografía individual.
 */
export async function subirEvidenciasInspeccion(
  inspeccionId: string,
  fotos: EvidenciaFotoInput[],
  alGuardar?: (foto: EvidenciaFotoInput, rutaStorage: string) => void,
): Promise<void> {
  for (let i = 0; i < fotos.length; i++) {
    const ruta = await subirEvidencia(inspeccionId, fotos[i], i + 1);
    alGuardar?.(fotos[i], ruta);
  }
}

/** Aviso mostrado cuando el movimiento quedó guardado pero alguna fotografía falló al subir. */
export const MENSAJE_FOTOS_PENDIENTES =
  "El movimiento ya se guardó. Solo quedan fotografías pendientes: reintenta aquí o adjúntalas desde el historial. ";
