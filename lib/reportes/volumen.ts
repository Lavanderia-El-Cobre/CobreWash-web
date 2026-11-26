import { fechaChile, sumarDias } from "./fechas";
import { claveCuenta, type FilaDetalle, type FilaResumen } from "./modelo";

/** Granularidad temporal admitida para la serie de volumen procesado. */
export type AgrupacionPeriodo = "dia" | "mes";

/**
 * Agrupa el detalle de volumen procesado por cuenta `(cliente, empresa)` y lo
 * ordena de mayor a menor cantidad de prendas.
 *
 * @param detalle - Comandas procesadas incluidas en el reporte de volumen.
 */
export function volumenPorCuenta(detalle: FilaDetalle[]) {
  const grupos = new Map<string, FilaResumen>();
  for (const d of detalle) {
    const id = claveCuenta(d.clienteId ?? d.cliente, d.empresa);
    const fila = grupos.get(id) ?? {
      id,
      label: d.cliente + (d.empresa ? ` · ${d.empresa}` : ""),
      comandas: 0,
      prendas: 0,
      facturado: 0,
    };
    fila.comandas++;
    fila.prendas += d.prendas;
    fila.facturado += d.facturado;
    grupos.set(id, fila);
  }
  return [...grupos.values()].sort((a, b) => b.prendas - a.prendas);
}

/**
 * Construye la serie continua de volumen por día o por mes en horario de Chile.
 * Inicializa todos los periodos del rango en cero para que gráficos y tablas
 * muestren los días/meses sin actividad en orden cronológico.
 *
 * @param detalle - Comandas procesadas con fecha ISO.
 * @param desde - Fecha inicial inclusive (`YYYY-MM-DD`).
 * @param hasta - Fecha final inclusive (`YYYY-MM-DD`).
 * @param agrupacion - Granularidad de la serie (`"dia"` o `"mes"`).
 */
export function volumenPorPeriodo(
  detalle: FilaDetalle[],
  desde: string,
  hasta: string,
  agrupacion: AgrupacionPeriodo,
) {
  const grupos = new Map<string, FilaResumen>();
  for (let dia = desde; dia <= hasta; dia = sumarDias(dia, 1)) {
    const id = agrupacion === "mes" ? dia.slice(0, 7) : dia;
    if (!grupos.has(id))
      grupos.set(id, {
        id,
        label:
          agrupacion === "mes"
            ? `${id.slice(5, 7)}/${id.slice(0, 4)}`
            : `${id.slice(8, 10)}/${id.slice(5, 7)}/${id.slice(0, 4)}`,
        comandas: 0,
        prendas: 0,
        facturado: 0,
      });
  }
  for (const d of detalle) {
    const dia = fechaChile(d.fecha);
    const fila = grupos.get(agrupacion === "mes" ? dia.slice(0, 7) : dia);
    if (!fila) continue;
    fila.comandas++;
    fila.prendas += d.prendas;
    fila.facturado += d.facturado;
  }
  return [...grupos.values()];
}

/**
 * Calcula indicadores operativos del reporte de volumen: promedio diario de prendas
 * (sobre todos los días calendario del rango), prendas por comanda y día de mayor carga.
 *
 * @param detalle - Comandas procesadas dentro del rango.
 * @param desde - Fecha inicial inclusive (`YYYY-MM-DD`).
 * @param hasta - Fecha final inclusive (`YYYY-MM-DD`).
 */
export function indicadoresVolumen(
  detalle: FilaDetalle[],
  desde: string,
  hasta: string,
) {
  const dias = volumenPorPeriodo(detalle, desde, hasta, "dia");
  const prendas = detalle.reduce((s, d) => s + d.prendas, 0);
  const pico = [...dias].sort((a, b) => b.prendas - a.prendas)[0];
  return {
    promedioDiario: dias.length ? prendas / dias.length : 0,
    prendasPorComanda: detalle.length ? prendas / detalle.length : 0,
    pico: pico?.prendas ? pico : null,
  };
}
