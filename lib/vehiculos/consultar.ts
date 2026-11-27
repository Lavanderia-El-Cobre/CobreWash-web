import { getFlotaVehiculos, type GetFlotaVehiculosData } from "@/src/dataconnect-generated";
import { dataConnect } from "@/lib/firebase/client";

/**
 * Carga el estado completo de la flota (vehículos, conductores y todas las salidas).
 * Pagina las salidas de a 200 registros forzando `SERVER_ONLY`, deduplica por `id`
 * ante cambios concurrentes entre páginas y conserva los catálogos de la primera carga.
 */
export async function consultarFlotaCompleta() {
  let resultado: GetFlotaVehiculosData | null = null;
  const salidas = new Map<string, GetFlotaVehiculosData["salidas"][number]>();
  for (let offset = 0; ; offset += 200) {
    const { data } = await getFlotaVehiculos(dataConnect, { limit: 200, offset }, { fetchPolicy: "SERVER_ONLY" });
    resultado ??= data;
    data.salidas.forEach(s => salidas.set(s.id, s));
    if (data.salidas.length < 200) return { ...resultado, salidas: [...salidas.values()] };
  }
}
