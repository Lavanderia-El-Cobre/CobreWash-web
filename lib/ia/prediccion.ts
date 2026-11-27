import { DESVIACION_PREVIA } from "./ajuste";
import type { Observacion, Produccion, TasaServicio } from "./modelo";

/** Peso procesado de un tipo de servicio dentro de una comanda. */
export interface LineaComanda {
  servicioId: string;
  kg: number;
}

/** Datos mínimos de un insumo necesarios para estimar consumo y contrastar stock. */
export interface InsumoStock {
  id: string;
  nombre: string;
  unidadMedida: string;
  stockActual: number;
}

/** ok: alcanza con margen · justo: alcanza solo sin margen · insuficiente: no alcanza. */
export type NivelStock = "ok" | "justo" | "insuficiente";

/** Resultado de la predicción de consumo y suficiencia de stock para un insumo. */
export interface EstimacionInsumo {
  insumoId: string;
  nombre: string;
  unidad: string;
  /** kg × tasa, sin margen. */
  estimado: number;
  minimo: number;
  maximo: number;
  /** Lo que conviene tener disponible: estimado × (1 + margen). */
  reservado: number;
  stockActual: number;
  nivel: NivelStock;
}

/** Suma los kg por servicio, ignorando líneas vacías o inválidas. */
export function kgPorServicio(lineas: LineaComanda[]): Record<string, number> {
  const total: Record<string, number> = {};
  for (const l of lineas) if (Number.isFinite(l.kg) && l.kg > 0) total[l.servicioId] = (total[l.servicioId] ?? 0) + l.kg;
  return total;
}

/**
 * Consumo estimado de una comanda por insumo:
 *   estimado = Σ kg × tasa(servicio, insumo)
 *   rango    = estimado × (1 ± desviación relativa del insumo)
 *   reserva  = estimado × (1 + margen de seguridad)
 * Las tasas deben venir en unidad del insumo por kg (ver tasasPorInsumo).
 */
export function estimarComanda(entrada: {
  lineas: LineaComanda[];
  tasas: Record<string, TasaServicio[]>;
  insumos: InsumoStock[];
  margenSeguridad: number;
  desviaciones?: Record<string, number>;
}) {
  const kg = kgPorServicio(entrada.lineas);
  const estimaciones: EstimacionInsumo[] = [];
  const conTasa = new Set<string>();
  for (const insumo of entrada.insumos) {
    const tasas = (entrada.tasas[insumo.id] ?? []).filter((t) => kg[t.servicioId]);
    if (!tasas.length) continue;
    tasas.forEach((t) => conTasa.add(t.servicioId));
    const estimado = tasas.reduce((s, t) => s + kg[t.servicioId] * t.tasaActual, 0);
    const desviacion = entrada.desviaciones?.[insumo.id] ?? DESVIACION_PREVIA;
    const reservado = estimado * (1 + Math.max(0, entrada.margenSeguridad));
    estimaciones.push({
      insumoId: insumo.id,
      nombre: insumo.nombre,
      unidad: insumo.unidadMedida,
      estimado,
      minimo: Math.max(0, estimado * (1 - desviacion)),
      maximo: estimado * (1 + desviacion),
      reservado,
      stockActual: insumo.stockActual,
      nivel: estimado > insumo.stockActual ? "insuficiente" : reservado > insumo.stockActual ? "justo" : "ok",
    });
  }
  estimaciones.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  return {
    insumos: estimaciones,
    /** Servicios con kg en la comanda que no tienen ninguna tasa definida. */
    serviciosSinTasa: Object.keys(kg).filter((s) => !conTasa.has(s)),
    alerta: estimaciones.some((e) => e.nivel === "insuficiente"),
  };
}

const DIA = 86_400_000;

/**
 * Consumo diario promedio medido en los períodos más recientes de un insumo,
 * tomando hacia atrás los períodos necesarios para cubrir `ventanaDias`.
 */
export function consumoDiarioReciente(observaciones: Observacion[], insumoId: string, ventanaDias = 28): number | null {
  const propias = observaciones
    .filter((o) => o.insumoId === insumoId)
    .sort((a, b) => Date.parse(b.hasta) - Date.parse(a.hasta));
  let dias = 0, consumo = 0;
  for (const o of propias) {
    const duracion = (Date.parse(o.hasta) - Date.parse(o.desde)) / DIA;
    if (!(duracion > 0)) continue;
    dias += duracion;
    consumo += o.consumo;
    if (dias >= ventanaDias) break;
  }
  return dias > 0 ? consumo / dias : null;
}

/**
 * Consumo diario esperado según los kg procesados en los últimos días. Sirve
 * mientras aún no hay dos conteos para medir el consumo real.
 * Si el historial completo de producción cubre menos días que `ventanaDias`,
 * promedia sobre los días reales transcurridos (mínimo 1) para no subestimar el consumo.
 */
export function consumoDiarioEstimado(produccion: Produccion[], tasas: TasaServicio[], ahora: Date, ventanaDias = 30): number | null {
  const ahoraMs = ahora.getTime();
  const desde = ahoraMs - ventanaDias * DIA;
  const tasa = new Map(tasas.map((t) => [t.servicioId, t.tasaActual]));
  const recientes = produccion.filter((p) => {
    const t = Date.parse(p.fecha);
    return t > desde && t <= ahoraMs && tasa.has(p.servicioId);
  });
  if (!recientes.length) return null;
  let primeraFecha = Infinity;
  for (const p of produccion) {
    const t = Date.parse(p.fecha);
    if (Number.isFinite(t) && t <= ahoraMs && t < primeraFecha) primeraFecha = t;
  }
  const diasTranscurridos = Number.isFinite(primeraFecha) ? Math.max(1, Math.ceil((ahoraMs - primeraFecha) / DIA)) : ventanaDias;
  const diasEfectivos = Math.min(ventanaDias, diasTranscurridos);
  return recientes.reduce((s, p) => s + p.kg * tasa.get(p.servicioId)!, 0) / diasEfectivos;
}

/** Días que dura el stock al ritmo de consumo indicado; null si no hay consumo. */
export function diasDeStock(stockActual: number, consumoDiario: number | null): number | null {
  if (consumoDiario === null || !(consumoDiario > 0)) return null;
  return Math.max(0, stockActual) / consumoDiario;
}

/**
 * Cantidad sugerida de compra para alcanzar `diasObjetivo` días de cobertura
 * (redondeada hacia arriba en enteros), o `null` si el stock ya cubre el objetivo
 * o no existe consumo diario medible.
 */
export function compraSugerida(stockActual: number, consumoDiario: number | null, diasObjetivo = 14): number | null {
  if (consumoDiario === null || !(consumoDiario > 0)) return null;
  const faltante = consumoDiario * diasObjetivo - Math.max(0, stockActual);
  return faltante > 0 ? Math.ceil(faltante) : null;
}

/** Nivel de confianza legible del modelo según cantidad de períodos observados y MAPE. */
export interface ConfianzaModelo {
  nivel: "alta" | "media" | "aprendiendo";
  etiqueta: string;
  detalle: string;
}

/**
 * Traduce las métricas técnicas del modelo (observaciones y MAPE) a una calificación
 * comprensible para usuarios no técnicos.
 */
export function confianzaModelo(observaciones: number, mape: number | null): ConfianzaModelo {
  if (observaciones < 3 || mape === null) {
    return {
      nivel: "aprendiendo",
      etiqueta: "En aprendizaje",
      detalle: observaciones === 0
        ? "Registra al menos 2 conteos físicos para medir el consumo real"
        : `Con ${observaciones} ${observaciones === 1 ? "período" : "períodos"} medidos; mejora con 3 o más`,
    };
  }
  if (mape <= 15 && observaciones >= 4) {
    return {
      nivel: "alta",
      etiqueta: "Alta",
      detalle: `Respaldado por ${observaciones} períodos medidos`,
    };
  }
  return {
    nivel: "media",
    etiqueta: "Media",
    detalle: `Basado en ${observaciones} períodos; afinará con más conteos`,
  };
}

/** Formatea una tasa de consumo con decimales adecuados a la unidad (`ml`/`g` vs `L`/`kg`). */
export function formatoTasaLegible(valor: number, unidad: string): string {
  const esSubunidad = unidad === "ml" || unidad === "g";
  const decimales = esSubunidad ? (Math.abs(valor) < 1 ? 2 : 1) : 4;
  return valor.toLocaleString("es-CL", { maximumFractionDigits: decimales });
}
