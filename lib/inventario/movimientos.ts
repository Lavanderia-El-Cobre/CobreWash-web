import { limitesFechasInclusivos } from "@/lib/reportes/fechas";

/** Semáforo de disponibilidad de un insumo en inventario. */
export type EstadoStock = "OK" | "Bajo" | "Crítico" | "Inactivo";

/** Datos mínimos de un insumo para calcular su estado de stock. */
export interface StockEvaluable {
  activo: boolean;
  stockActual: number;
  stockMinimo: number;
}

/** Movimiento de inventario normalizado para filtrado y exportación CSV. */
export interface MovimientoExportable {
  id: string;
  tipoMovimiento: "ENTRADA" | "SALIDA" | string;
  cantidad: number;
  motivo?: string | null;
  fecha: string;
  insumo: { id: string; nombre: string; unidadMedida: string };
  usuario?: { nombre: string; apellido?: string | null } | null;
}

/** Criterios opcionales para acotar la lista de movimientos en memoria. */
export interface FiltrosMovimiento {
  insumoId?: string;
  tipo?: "ENTRADA" | "SALIDA" | "TODOS";
  fechaDesde?: string;
  fechaHasta?: string;
}

/**
 * Clasifica el estado del stock respecto a su mínimo configurado:
 * `Crítico` si está en 50 % o menos del mínimo, `Bajo` si está en o bajo el mínimo
 * y `OK` si lo supera (o si `stockMinimo` es 0, lo que desactiva alertas).
 */
export function obtenerEstadoStock(item: StockEvaluable): EstadoStock {
  if (!item.activo) return "Inactivo";
  if (item.stockMinimo > 0 && item.stockActual <= item.stockMinimo * 0.5) return "Crítico";
  if (item.stockMinimo > 0 && item.stockActual <= item.stockMinimo) return "Bajo";
  return "OK";
}

/** Filtra movimientos por insumo, tipo y rango inclusivo de fechas en hora de Chile. */
export function filtrarMovimientos<T extends MovimientoExportable>(
  movimientos: T[],
  filtros: FiltrosMovimiento,
): T[] {
  const limites = limitesFechasInclusivos(filtros.fechaDesde || "", filtros.fechaHasta || "");
  const desde = limites.fechaDesde ? Date.parse(limites.fechaDesde) : Number.NEGATIVE_INFINITY;
  const hasta = limites.fechaHasta ? Date.parse(limites.fechaHasta) : Number.POSITIVE_INFINITY;

  return movimientos.filter((movimiento) => {
    const fecha = new Date(movimiento.fecha).getTime();
    return (!filtros.insumoId || movimiento.insumo.id === filtros.insumoId)
      && (!filtros.tipo || filtros.tipo === "TODOS" || movimiento.tipoMovimiento === filtros.tipo)
      && fecha >= desde
      && fecha <= hasta;
  });
}

function celdaCsv(valor: string | number) {
  // Prefija comilla simple ante caracteres de fórmula (=, +, @, -) para mitigar inyección CSV en Excel.
  const seguro = typeof valor === "string" && /^\s*[=+@-]/.test(valor) ? `'${valor}` : String(valor);
  const texto = seguro.replaceAll('"', '""');
  return `"${texto}"`;
}

/** Serializa movimientos a CSV con BOM UTF-8, separador `;` y fechas en `America/Santiago` para Excel en español. */
export function crearCsvMovimientos(movimientos: MovimientoExportable[]) {
  const encabezado = ["Fecha", "Tipo", "Insumo", "Cantidad", "Unidad", "Motivo", "Usuario"];
  const filas = movimientos.map((movimiento) => [
    new Date(movimiento.fecha).toLocaleString("es-CL", { timeZone: "America/Santiago" }),
    movimiento.tipoMovimiento,
    movimiento.insumo.nombre,
    movimiento.cantidad,
    movimiento.insumo.unidadMedida,
    movimiento.motivo || "",
    movimiento.usuario
      ? `${movimiento.usuario.nombre} ${movimiento.usuario.apellido ?? ""}`.trim()
      : "Sistema",
  ]);
  return `\uFEFF${[encabezado, ...filas].map((fila) => fila.map(celdaCsv).join(";")).join("\r\n")}`;
}
