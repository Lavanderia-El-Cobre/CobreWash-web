import type { GetComandasParaEntregaData } from "@/src/dataconnect-generated";

export type ComandaParaEntrega = GetComandasParaEntregaData["comandas"][number];
export type EntregaRegistrada = GetComandasParaEntregaData["misEntregas"][number];

/** Deben coincidir con la lista que acepta ReportarProblemaEntrega. */
export const MOTIVOS_PROBLEMA_ENTREGA = [
  "Cliente ausente",
  "Dirección errónea",
  "Dirección inaccesible",
  "Cliente rechaza la entrega",
  "Pedido incompleto o dañado",
  "Otro",
] as const;
export type MotivoProblemaEntrega = (typeof MOTIVOS_PROBLEMA_ENTREGA)[number];

export const DETALLE_ENTREGA_MAXIMO = 280;
export const DETALLE_PROBLEMA_MAXIMO = 250;

/** Recorta el detalle y lo convierte en null si quedó vacío. */
export function normalizarDetalle(texto: string): string | null {
  const limpio = texto.replace(/\s+/g, " ").trim();
  return limpio ? limpio : null;
}

export function validarEntrega(detalle: string): string | null {
  const limpio = normalizarDetalle(detalle);
  if (limpio && limpio.length > DETALLE_ENTREGA_MAXIMO) {
    return `El detalle de la entrega admite hasta ${DETALLE_ENTREGA_MAXIMO} caracteres.`;
  }
  return null;
}

export function validarProblemaEntrega(motivo: string, detalle: string): string | null {
  if (!MOTIVOS_PROBLEMA_ENTREGA.includes(motivo as MotivoProblemaEntrega)) {
    return "Selecciona el motivo del problema.";
  }
  const limpio = normalizarDetalle(detalle);
  if (motivo === "Otro" && !limpio) return "Describe el problema de la entrega.";
  if (limpio && limpio.length > DETALLE_PROBLEMA_MAXIMO) {
    return `El detalle admite hasta ${DETALLE_PROBLEMA_MAXIMO} caracteres.`;
  }
  return null;
}

/** "3 prendas · Camisa ×2, Sábana ×1" */
export function resumirPrendas(prendas: ComandaParaEntrega["prendas"]): string {
  const porTipo = new Map<string, number>();
  let total = 0;
  for (const p of prendas) {
    total += p.cantidad;
    porTipo.set(p.tipoPrenda.nombre, (porTipo.get(p.tipoPrenda.nombre) ?? 0) + p.cantidad);
  }
  if (total === 0) return "Sin prendas registradas";
  const detalle = [...porTipo.entries()].map(([n, c]) => `${n} ×${c}`).join(", ");
  return `${total} prenda${total === 1 ? "" : "s"} · ${detalle}`;
}

export function problemasAbiertos(comanda: Pick<ComandaParaEntrega, "problemas">) {
  return comanda.problemas.filter((p) => p.estado !== "RESUELTA");
}

/** Quita el prefijo técnico "Entrega: " que distingue estas incidencias. */
export function motivoVisible(motivo: string): string {
  return motivo.replace(/^Entrega: /, "");
}

export function filtrarComandasEntrega(comandas: ComandaParaEntrega[], busqueda: string): ComandaParaEntrega[] {
  const clave = (t: string | null | undefined) =>
    (t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("es-CL");
  const termino = clave(busqueda.trim());
  if (!termino) return comandas;
  return comandas.filter((c) =>
    [c.numeroComanda, c.cliente.nombre, c.cliente.direccion, c.empresa, c.proyecto].some((v) => clave(v).includes(termino)),
  );
}

export function mapearErrorEntrega(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  if (/Solo se puede entregar una comanda finalizada|ya fue registrada|no está listo para entregar/i.test(msg)) {
    return "Esta comanda ya no está pendiente de entrega. Actualiza la lista.";
  }
  if (/Solo se pueden reportar problemas/i.test(msg)) {
    return "Esta comanda ya no está pendiente de entrega. Actualiza la lista.";
  }
  if (/detalle/i.test(msg)) return "Revisa el detalle: es demasiado largo o está vacío.";
  if (/inactiva/i.test(msg)) return "Tu cuenta está inactiva. Contacta a administración.";
  if (/No autorizado|reservada/i.test(msg)) return "No tienes permisos para registrar entregas.";
  return "No se pudo guardar. Revisa tu conexión e intenta nuevamente.";
}
