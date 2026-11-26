import type { GetSeguimientoPublicoPorQrData } from "@/src/dataconnect-generated";
import { normalizarCodigoQr, normalizarNumeroComanda } from "./qr";

/** Proyección pública de una comanda expuesta en el portal de seguimiento sin datos sensibles. */
export type PedidoPublico = NonNullable<GetSeguimientoPublicoPorQrData["comanda"]>;

/** Entrada discriminada para buscar un pedido público por QR o por número de comanda. */
export type ConsultaSeguimiento = { tipo: "qr" | "numero"; valor: string };

/**
 * Normaliza y valida el valor de una consulta de seguimiento según su tipo.
 * Lanza un error legible si el QR o número de comanda no cumple el formato esperado.
 *
 * @param consulta - Consulta cruda ingresada por el usuario o leída desde la URL.
 */
export function validarConsulta(consulta: ConsultaSeguimiento): ConsultaSeguimiento {
  return { ...consulta, valor: consulta.tipo === "qr" ? normalizarCodigoQr(consulta.valor) : normalizarNumeroComanda(consulta.valor) };
}

/** Traducción de estados internos de comanda a etiquetas orientadas al cliente final. */
export const ESTADOS_PUBLICOS: Record<string, string> = {
  PENDIENTE: "Pedido recibido", EN_PROCESO: "En proceso", FINALIZADA: "Listo para retirar",
  ENTREGADA: "Entregado", ANULADA: "Anulado",
};

/**
 * Transforma un pedido público en un modelo listo para renderizar: estado legible,
 * lista deduplicada de servicios, etapas ordenadas y porcentaje de avance.
 *
 * @param pedido - Datos públicos de la comanda obtenidos desde Data Connect.
 */
export function presentarPedido(pedido: Pick<PedidoPublico, "estado" | "comandaEtapas_on_comanda" | "comandaDetalles_on_comanda">) {
  const etapas = pedido.comandaEtapas_on_comanda.map((etapa) => ({
    nombre: etapa.nombreEtapa ?? etapa.etapa.nombre,
    orden: etapa.ordenEtapa ?? etapa.etapa.orden,
    estado: etapa.estado,
    fechaCompletado: etapa.fechaCompletado,
  })).sort((a, b) => a.orden - b.orden);
  return {
    estado: ESTADOS_PUBLICOS[pedido.estado] ?? "Estado no disponible",
    servicios: [...new Set(pedido.comandaDetalles_on_comanda.map((d) => d.tipoServicio.nombre))].join(" · ") || "Lavandería",
    etapas,
    // El estado global se presenta por separado. No inventar etapas históricas.
    progreso: etapas.length ? Math.round(etapas.filter((e) => e.estado === "COMPLETADA").length / etapas.length * 100) : null,
  };
}

/**
 * Formatea una marca temporal del seguimiento público en horario de Chile (24 h),
 * devolviendo `"Sin registro"` cuando falta o es inválida.
 *
 * @param value - Fecha ISO o valor nulo/indefinido.
 */
export function fechaSeguimiento(value?: string | null): string {
  if (!value || Number.isNaN(Date.parse(value))) return "Sin registro";
  return new Intl.DateTimeFormat("es-CL", { timeZone: "America/Santiago", dateStyle: "short", timeStyle: "short", hourCycle: "h23" }).format(new Date(value));
}
