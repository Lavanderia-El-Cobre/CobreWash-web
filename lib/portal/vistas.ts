import { ComandaEstado } from "@/src/dataconnect-generated";

/** Pestañas disponibles en el listado de pedidos del portal de clientes. */
export type VistaPedidos = "todos" | "activos" | "historial";

/** Estados de Data Connect incluidos en cada pestaña del portal. */
export const ESTADOS_POR_VISTA: Record<VistaPedidos, ComandaEstado[]> = {
  todos: Object.values(ComandaEstado),
  activos: [ComandaEstado.PENDIENTE, ComandaEstado.EN_PROCESO, ComandaEstado.FINALIZADA],
  historial: [ComandaEstado.ENTREGADA, ComandaEstado.ANULADA],
};
