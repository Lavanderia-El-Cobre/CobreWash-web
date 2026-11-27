/** Vistas analíticas disponibles en el módulo de reportes. */
export type VistaReporte = "cliente" | "servicio" | "volumen";

/** Parámetros de filtrado compartidos entre la UI, consultas y exportación de reportes. */
export type FiltrosReporte = {
  desde: string;
  hasta: string;
  clienteId: string;
  empresa: string;
  servicioId?: string;
};

/** Fila agregada de resumen (por cliente/empresa, por servicio o por periodo). */
export type FilaResumen = {
  id: string;
  label: string;
  comandas: number;
  prendas: number;
  facturado: number;
};

/** Fila de detalle a nivel de comanda o de línea de servicio según la vista activa. */
export type FilaDetalle = {
  id: string;
  /** Presente cuando el detalle es por línea de servicio y varias filas pertenecen a una comanda. */
  comandaId?: string;
  clienteId?: string;
  numero: string;
  fecha: string;
  cliente: string;
  empresa: string;
  estado: string;
  prendas: number;
  facturado: number;
  servicio?: string;
  prenda?: string;
  pesoKg?: number | null;
};

/** Resultado consolidado de un reporte con su tabla resumen, detalle y totales globales. */
export type Reporte = {
  resumen: FilaResumen[];
  detalle: FilaDetalle[];
  /** Conteo de comandas únicas presentes en el detalle. */
  comandas: number;
  prendas: number;
  facturado: number;
};

/**
 * Construye una clave compuesta libre de colisiones para agrupar por `(clienteId, empresa)`.
 *
 * @param clienteId - Identificador del cliente.
 * @param empresa - Nombre de la empresa asociada, o nulo/vacío si es particular.
 */
export function claveCuenta(clienteId: string, empresa?: string | null) {
  return JSON.stringify([clienteId, empresa ?? ""]);
}

/**
 * Empaqueta resumen y detalle calculando los totales del reporte.
 * Cuenta comandas únicas usando `comandaId ?? id` para no duplicar comandas que
 * aparecen en múltiples líneas en la vista por servicio.
 *
 * @param resumen - Filas agregadas del reporte.
 * @param detalle - Filas detalladas del reporte.
 */
export function totales(
  resumen: FilaResumen[],
  detalle: FilaDetalle[],
): Reporte {
  return {
    resumen,
    detalle,
    comandas: new Set(detalle.map((r) => r.comandaId ?? r.id)).size,
    prendas: resumen.reduce((s, r) => s + r.prendas, 0),
    facturado: resumen.reduce((s, r) => s + r.facturado, 0),
  };
}
