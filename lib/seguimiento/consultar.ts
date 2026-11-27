import { getSeguimientoPublicoPorQr, getSeguimientoPublicoPorNumero } from "@/src/dataconnect-generated";
import { dataConnect } from "@/lib/firebase/client";
import type { ConsultaSeguimiento, PedidoPublico } from "./publico";

/**
 * Consulta la vista pública de un pedido por código QR o número de comanda.
 * Usa `SERVER_ONLY` para reflejar el avance real del pedido sin depender del caché local.
 *
 * @param consulta - Tipo de búsqueda y valor previamente normalizado.
 * @returns Datos públicos del pedido, o `null` si no existe coincidencia.
 */
export async function consultarSeguimiento(consulta: ConsultaSeguimiento): Promise<PedidoPublico | null> {
  const resultado = consulta.tipo === "qr"
    ? await getSeguimientoPublicoPorQr(dataConnect, { codigoQr: consulta.valor }, { fetchPolicy: "SERVER_ONLY" })
    : await getSeguimientoPublicoPorNumero(dataConnect, { numeroComanda: consulta.valor }, { fetchPolicy: "SERVER_ONLY" });
  return resultado.data.comanda ?? null;
}
