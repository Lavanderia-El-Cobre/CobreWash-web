import { DESVIACION_PREVIA } from "./ajuste";
import { estimarComanda } from "./prediccion";
import { leerDetalleAjuste } from "./recalculo";
import { tasasPorInsumo } from "./tasas";

/** Cota superior razonable para el peso total de una comanda individual (kg). */
export const PESO_MAXIMO_KG = 10_000;
// Data Connect puede devolver UUID con o sin guiones según el origen; se normalizan para cruzar mapas.
const uuid = (id: string) => id.replaceAll("-", "").toLowerCase();

/** Lee el peso escrito en el formulario ("12,5" o "12.5"); null si no es válido. */
export function leerPesoKg(texto: string): number | null {
  const limpio = texto.trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(limpio)) return null;
  const kg = Number(limpio);
  return kg > 0 && kg <= PESO_MAXIMO_KG ? kg : null;
}

/**
 * Reparte el peso total de la comanda entre sus líneas según la cantidad de
 * prendas. La suma es exacta (la última línea absorbe el redondeo), que es lo
 * que usa el modelo: los kg por servicio.
 */
export function repartirPeso(totalKg: number, cantidades: number[]): number[] {
  if (!(totalKg > 0) || !cantidades.length) return cantidades.map(() => 0);
  const unidades = cantidades.map((c) => Math.max(1, c));
  const suma = unidades.reduce((s, c) => s + c, 0);
  const totalCent = Math.round(totalKg * 100);
  // Si el peso total no alcanza a 0,01 kg por línea, repartir en diezmilésimas positivas (> 0).
  if (totalCent < unidades.length) {
    const partes = unidades.map((u) => Math.max(0.0001, Number(((totalKg * u) / suma).toFixed(4))));
    const diff = Number((totalKg - partes.reduce((a, b) => a + b, 0)).toFixed(4));
    const idxMax = partes.reduce((best, p, i) => (p > partes[best] ? i : best), 0);
    if (partes[idxMax] + diff > 0) partes[idxMax] = Number((partes[idxMax] + diff).toFixed(4));
    return partes;
  }
  // Método del resto mayor en centésimas con piso de 0,01 kg por línea (evita ceros y negativos).
  const exactos = unidades.map((u) => (totalCent * u) / suma);
  const base = exactos.map((e) => Math.max(1, Math.floor(e)));
  let resto = totalCent - base.reduce((a, b) => a + b, 0);
  if (resto > 0) {
    const orden = exactos.map((e, i) => ({ i, frac: e - base[i] })).sort((a, b) => (b.frac - a.frac) || (b.i - a.i));
    for (let k = 0; k < resto; k++) base[orden[k % orden.length].i] += 1;
  } else if (resto < 0) {
    const orden = base.map((b, i) => ({ i, exc: b - exactos[i] })).sort((a, b) => (b.exc - a.exc) || (a.i - b.i));
    for (const { i } of orden) {
      while (resto < 0 && base[i] > 1) {
        base[i] -= 1;
        resto += 1;
      }
    }
  }
  return base.map((c) => c / 100);
}

/** Datos de GetModeloComandaIa. */
export interface ModeloComanda {
  configuracionIa?: { margenSeguridad: number } | null;
  tasaConsumos: { tipoServicioId: string; insumoId: string; tasaInicial: number; tasaActual: number; unidad: string }[];
  insumos: { id: string; nombre: string; unidadMedida: string; stockActual: number }[];
  modeloVigente: { desviacionRelativa?: number | null; tasasJson?: string | null }[];
}

/**
 * Estima el consumo de una comanda con las tasas actuales: rango según la
 * desviación de cada insumo en el último ajuste y alerta si el stock no alcanza.
 */
export function estimarConsumoComanda(modelo: ModeloComanda, servicioId: string, kg: number) {
  const insumos = modelo.insumos.map((i) => ({ ...i, id: uuid(i.id) }));
  const { tasas } = tasasPorInsumo(
    modelo.tasaConsumos.map((t) => ({ ...t, servicioId: uuid(t.tipoServicioId), insumoId: uuid(t.insumoId) })),
    insumos,
  );
  const vigente = modelo.modeloVigente[0];
  const general = vigente?.desviacionRelativa ?? DESVIACION_PREVIA;
  const desviaciones: Record<string, number> = Object.fromEntries(insumos.map((i) => [i.id, general]));
  for (const i of leerDetalleAjuste(vigente?.tasasJson)?.insumos ?? []) desviaciones[uuid(i.insumoId)] = i.desviacionRelativa;
  return estimarComanda({
    lineas: [{ servicioId: uuid(servicioId), kg }],
    tasas,
    insumos,
    margenSeguridad: modelo.configuracionIa?.margenSeguridad ?? 0.15,
    desviaciones,
  });
}

/** Muestra cantidades pequeñas en la subunidad (0,18 L → 180 ml). */
export function formatoCantidad(valor: number, unidad: string): { valor: string; unidad: string } {
  const sub = unidad === "L" ? "ml" : unidad === "kg" ? "g" : null;
  const usarSub = sub !== null && valor < 1;
  const v = usarSub ? valor * 1000 : valor;
  return { valor: v.toLocaleString("es-CL", { maximumFractionDigits: v < 10 ? 2 : v < 100 ? 1 : 0 }), unidad: usarSub ? sub! : unidad };
}
