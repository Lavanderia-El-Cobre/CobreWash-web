import type { GetSolicitudesContactoVariables, SolicitudContactoEstado } from "@/src/dataconnect-generated";

export const TAMANO_BANDEJA = 20;

/**
 * "Todas" omite el filtro: Data Connect traduce `eq: null` a `IS NULL`, de
 * modo que enviar `estado: null` vaciaría la bandeja.
 */
export function variablesBandeja(estado: SolicitudContactoEstado | null, pagina: number): GetSolicitudesContactoVariables {
  return { ...(estado ? { estado } : {}), offset: pagina * TAMANO_BANDEJA, limit: TAMANO_BANDEJA };
}
