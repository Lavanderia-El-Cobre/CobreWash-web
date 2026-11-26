import type { GetSolicitudesContactoVariables, SolicitudContactoEstado } from "@/src/dataconnect-generated";

/** Cantidad de solicitudes mostradas por página en la bandeja de contacto. */
export const TAMANO_BANDEJA = 20;

/**
 * Construye las variables paginadas para consultar la bandeja de solicitudes.
 * "Todas" (`estado === null`) omite el filtro: Data Connect traduce `eq: null` a
 * `IS NULL`, de modo que enviar `estado: null` vaciaría la bandeja.
 *
 * @param estado - Estado a filtrar, o `null` para incluir todas las solicitudes.
 * @param pagina - Índice de página basado en cero.
 */
export function variablesBandeja(estado: SolicitudContactoEstado | null, pagina: number): GetSolicitudesContactoVariables {
  return { ...(estado ? { estado } : {}), offset: pagina * TAMANO_BANDEJA, limit: TAMANO_BANDEJA };
}
