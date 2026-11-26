import type { GetSeguimientoProduccionData } from "@/src/dataconnect-generated";

/** Etapa tal como viene persistida en la consulta de seguimiento de producción. */
export type EtapaPersistida = GetSeguimientoProduccionData["comandas"][number]["comandaEtapas_on_comanda"][number];

/** Etapa normalizada y lista para renderizarse en vistas de seguimiento y producción. */
export type EtapaVisible = ReturnType<typeof normalizarEtapas>[number];

/**
 * Normaliza y ordena las etapas de una comanda para su presentación.
 * Cuando existe `nombreEtapa` (instantánea guardada al crear la comanda), se usan
 * los metadatos congelados en vez del catálogo vigente para preservar el historial.
 *
 * @param etapas - Etapas persistidas asociadas a la comanda.
 */
export function normalizarEtapas(etapas: EtapaPersistida[]) {
  return etapas.map((e) => ({
    id: e.etapaId,
    nombre: e.nombreEtapa ?? e.etapa.nombre,
    orden: e.ordenEtapa ?? e.etapa.orden,
    descripcion: e.nombreEtapa != null ? e.descripcionEtapa : e.etapa.descripcion,
    tiempoEstimadoMin: e.nombreEtapa != null ? e.tiempoEstimadoMin : e.etapa.tiempoEstimadoMin,
    estado: e.estado,
    fechaInicio: e.fechaInicio ?? null,
    fechaCompletado: e.fechaCompletado ?? null,
    responsable: e.operario ? [e.operario.nombre, e.operario.apellido].filter(Boolean).join(" ") : null,
    asignadoA: e.asignadoA ? [e.asignadoA.nombre, e.asignadoA.apellido].filter(Boolean).join(" ") : null,
    asignadoAId: e.asignadoA?.id ?? null,
  })).sort((a, b) => a.orden - b.orden);
}

/**
 * Formatea una marca temporal en la zona horaria de la lavandería (`America/Santiago`),
 * incluso si se consulta desde otro país. Devuelve `"Sin registro"` si es nula o inválida.
 *
 * @param value - Fecha ISO persistida o `null`.
 */
export function fechaProduccion(value: string | null) {
  if (!value || Number.isNaN(Date.parse(value))) return "Sin registro";
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: "America/Santiago", dateStyle: "short", timeStyle: "medium",
  }).format(new Date(value));
}

/**
 * Calcula el porcentaje entero de avance (0–100) según las etapas completadas.
 *
 * @param etapas - Flujo de etapas normalizadas de la comanda.
 */
export function progresoProduccion(etapas: EtapaVisible[]) {
  if (!etapas.length) return 0;
  return Math.round(etapas.filter((e) => e.estado === "COMPLETADA").length / etapas.length * 100);
}

/**
 * Obtiene la primera etapa pendiente o en proceso del flujo ordenado,
 * o `null` si todas están completadas o el flujo está vacío.
 *
 * @param etapas - Etapas ordenadas por `orden`.
 */
export function etapaActualProduccion(etapas: EtapaVisible[]) {
  return etapas.find((e) => e.estado !== "COMPLETADA") ?? null;
}

/**
 * Devuelve la etiqueta resumida del estado actual del flujo: nombre de la etapa
 * activa, `"Flujo completado"` si todas terminaron o `"En espera"` si no hay etapas.
 *
 * @param etapas - Etapas ordenadas por `orden`.
 */
export function estadoEtapa(etapas: EtapaVisible[]) {
  return etapaActualProduccion(etapas)?.nombre
    ?? (etapas.length && etapas.every((e) => e.estado === "COMPLETADA") ? "Flujo completado" : "En espera");
}
