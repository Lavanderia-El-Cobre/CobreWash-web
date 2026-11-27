import { getComandasParaAlertas, type GetComandasParaAlertasData } from "@/src/dataconnect-generated";
import { dataConnect } from "@/lib/firebase/client";

const PAGE_SIZE = 100;
type Comanda = GetComandasParaAlertasData["comandas"][number];

/**
 * Carga paginada de todas las comandas relevantes para calcular alertas de atraso.
 * Consulta siempre al servidor (`SERVER_ONLY`) para reflejar cambios recientes,
 * deduplica por `id` ante desplazamientos entre páginas y se detiene si el
 * llamador deja de estar vigente (p. ej. efecto desmontado o consulta reemplazada).
 *
 * @param vigente - Predicado que indica si el resultado de esta carga sigue siendo necesario.
 * @param consultar - Función inyectable para obtener una página por `offset` (facilita pruebas).
 * @returns Lista deduplicada de comandas, o `null` si la operación fue cancelada.
 */
export async function consultarComandasAlertas(vigente: () => boolean, consultar = async (offset: number) => {
  const resultado = await getComandasParaAlertas(dataConnect, { limit: PAGE_SIZE, offset }, { fetchPolicy: "SERVER_ONLY" });
  return resultado.data.comandas;
}) {
  const comandas = new Map<string, Comanda>();
  for (let offset = 0; vigente(); offset += PAGE_SIZE) {
    const pagina = await consultar(offset);
    if (!vigente()) return null;
    for (const c of pagina) comandas.set(c.id, c);
    if (pagina.length < PAGE_SIZE) return [...comandas.values()];
  }
  return null;
}
