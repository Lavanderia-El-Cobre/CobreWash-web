import { getAvisosAdministracion, getAvisosParaEquipo } from "@/src/dataconnect-generated";
import { dataConnect } from "@/lib/firebase/client";

/** Cantidad de avisos internos que se muestran por página. */
export const AVISOS_POR_PAGINA = 20;

/**
 * Consulta una página de avisos internos desde el servidor (sin caché local).
 * Los administradores ven todos los avisos; el resto del personal solo recibe
 * los avisos dirigidos a todos o a su propio rol.
 *
 * @param rol - Rol interno del usuario autenticado.
 * @param pagina - Número de página basado en 1.
 */
export async function consultarAvisos(rol: string, pagina: number) {
  const variables = { limit: AVISOS_POR_PAGINA, offset: (pagina - 1) * AVISOS_POR_PAGINA };
  // SERVER_ONLY evita mostrar avisos vencidos o perder publicaciones recién creadas por caché local.
  const opciones = { fetchPolicy: "SERVER_ONLY" as const };
  if (!["admin", "operario", "recepcionista", "repartidor", "conductor"].includes(rol)) {
    throw new Error("Acceso reservado al personal.");
  }
  const { data } = rol === "admin"
    ? await getAvisosAdministracion(dataConnect, variables, opciones)
    : await getAvisosParaEquipo(dataConnect, { ...variables, rol }, opciones);
  return { avisos: data.avisos, total: data.total[0]?._count ?? 0 };
}
