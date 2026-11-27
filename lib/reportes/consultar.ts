import {
  getReporteCuentas,
  getDetalleReporteCuentas,
  getFiltrosReportes,
  getReporteServicios,
  getDetalleReporteServicios,
  getReporteVolumen,
} from "@/src/dataconnect-generated";
import { dataConnect } from "@/lib/firebase/client";
import { rangoConsulta } from "./fechas";
import {
  claveCuenta,
  totales,
  type FiltrosReporte,
  type VistaReporte,
} from "./modelo";
import { volumenPorCuenta } from "./volumen";

const opciones = { fetchPolicy: "SERVER_ONLY" as const };
/** Tamaño de lote por página usado al recorrer consultas completas de reportes. */
export const TAMANO_PAGINA = 500;

/**
 * Recorre todas las páginas de una consulta paginada hasta agotar los resultados.
 * Garantiza que nunca se exporte ni grafique una primera página como si fuera el total.
 *
 * @param consulta - Función que recibe el `offset` y devuelve una página de registros.
 */
export async function todasLasPaginas<T>(
  consulta: (offset: number) => Promise<T[]>,
) {
  const filas: T[] = [];
  for (let offset = 0; ; offset += TAMANO_PAGINA) {
    const pagina = await consulta(offset);
    filas.push(...pagina);
    if (pagina.length < TAMANO_PAGINA) return filas;
  }
}

/**
 * Obtiene los catálogos completos (clientes, empresas no vacías y servicios)
 * necesarios para poblar los selectores de filtros del módulo de reportes.
 */
export async function consultarFiltrosReportes() {
  const [clientes, empresas, servicios] = await Promise.all([
    todasLasPaginas(
      async (offset) =>
        (
          await getFiltrosReportes(
            dataConnect,
            { limit: TAMANO_PAGINA, offset },
            opciones,
          )
        ).data.clientes,
    ),
    todasLasPaginas(
      async (offset) =>
        (
          await getFiltrosReportes(
            dataConnect,
            { limit: TAMANO_PAGINA, offset },
            opciones,
          )
        ).data.empresas,
    ),
    todasLasPaginas(
      async (offset) =>
        (
          await getFiltrosReportes(
            dataConnect,
            { limit: TAMANO_PAGINA, offset },
            opciones,
          )
        ).data.servicios,
    ),
  ]);
  return {
    clientes,
    servicios,
    empresas: empresas.map((e) => e.empresa!).filter((e) => e.trim()),
  };
}

/**
 * Consulta y consolida el reporte completo para la vista y filtros seleccionados.
 * Usa `SERVER_ONLY` y paginación exhaustiva para evitar datos parciales o en caché.
 *
 * - `"volumen"`: contabiliza prendas procesadas según el primer cierre de producción
 *   (o fecha de entrega real como respaldo), agrupadas por cuenta.
 * - `"servicio"`: resume y detalla demanda por tipo de servicio a nivel de línea.
 * - `"cliente"`: consolida comandas, prendas y facturación por cliente y empresa.
 *
 * @param vista - Tipo de reporte a construir.
 * @param filtros - Rango de fechas en horario chileno y filtros opcionales.
 */
export async function consultarReporte(
  vista: VistaReporte,
  filtros: FiltrosReporte,
) {
  // Un filtro vacío se omite: Data Connect traduce `eq: null` a `IS NULL`,
  // así que enviar null dejaría el reporte sin comandas.
  const variables = {
    ...rangoConsulta(filtros.desde, filtros.hasta),
    clienteId: filtros.clienteId || undefined,
    empresa: filtros.empresa || undefined,
    limit: TAMANO_PAGINA,
  };
  if (vista === "volumen") {
    const vars = variables;
    const comandas = await todasLasPaginas(
      async (offset) =>
        (await getReporteVolumen(dataConnect, { ...vars, offset }, opciones))
          .data.comandas,
    );
    const detalle = comandas.flatMap((c) => {
      const fecha = c.primerCierre[0]?.fecha ?? c.fechaEntregaReal;
      // Si la subconsulta de líneas alcanza el límite de página podría haber truncamiento.
      if (c.prendas.length >= TAMANO_PAGINA)
        throw new Error(
          "Demasiados servicios en una comanda para generar el reporte completo.",
        );
      const lineas = c.prendas.filter(
        (p) => !filtros.servicioId || p.tipoServicioId === filtros.servicioId,
      );
      const prendas = lineas.reduce((s, p) => s + (p.cantidad_sum ?? 0), 0);
      // El historial de entrega puede caer en el rango aunque la producción
      // terminó antes. Solo cuenta el primer cierre, con entrega como respaldo.
      if (
        !fecha ||
        Date.parse(fecha) < Date.parse(vars.desde) ||
        Date.parse(fecha) >= Date.parse(vars.hasta) ||
        !prendas
      )
        return [];
      return [
        {
          id: c.id,
          numero: c.numeroComanda,
          fecha,
          clienteId: c.cliente.id,
          cliente: c.cliente.nombre,
          empresa: c.empresa ?? "",
          estado: c.estado,
          prendas,
          facturado: lineas.reduce((s, p) => s + (p.subtotal_sum ?? 0), 0),
        },
      ];
    });
    return totales(volumenPorCuenta(detalle), detalle);
  }
  if (vista === "servicio") {
    const vars = { ...variables, servicioId: filtros.servicioId || undefined };
    const [servicios, detalles] = await Promise.all([
      todasLasPaginas(
        async (offset) =>
          (
            await getReporteServicios(
              dataConnect,
              { ...vars, offset },
              opciones,
            )
          ).data.servicios,
      ),
      todasLasPaginas(
        async (offset) =>
          (
            await getDetalleReporteServicios(
              dataConnect,
              { ...vars, offset },
              opciones,
            )
          ).data.detalles,
      ),
    ]);
    const resumen = servicios
      .map((s) => ({
        id: s.tipoServicio.id,
        label: s.tipoServicio.nombre,
        comandas: s.comandaId_count,
        prendas: s.cantidad_sum ?? 0,
        facturado: s.subtotal_sum ?? 0,
      }))
      .sort(
        (a, b) => b.prendas - a.prendas || a.label.localeCompare(b.label, "es"),
      );
    const detalle = detalles.map((d) => ({
      id: d.id,
      comandaId: d.comanda.id,
      numero: d.comanda.numeroComanda,
      fecha: d.comanda.fechaRecepcion,
      cliente: d.comanda.cliente.nombre,
      empresa: d.comanda.empresa ?? "",
      estado: d.comanda.estado,
      servicio: d.tipoServicio.nombre,
      prenda: d.tipoPrenda.nombre,
      pesoKg: d.pesoKg,
      prendas: d.cantidad,
      facturado: d.subtotal,
    }));
    return totales(resumen, detalle);
  }
  if (vista !== "cliente") throw new Error("Vista no disponible.");
  const [cuentas, prendas, comandas] = await Promise.all([
    todasLasPaginas(
      async (offset) =>
        (
          await getReporteCuentas(
            dataConnect,
            { ...variables, offset },
            opciones,
          )
        ).data.cuentas,
    ),
    todasLasPaginas(
      async (offset) =>
        (
          await getReporteCuentas(
            dataConnect,
            { ...variables, offset },
            opciones,
          )
        ).data.prendas,
    ),
    todasLasPaginas(
      async (offset) =>
        (
          await getDetalleReporteCuentas(
            dataConnect,
            { ...variables, offset },
            opciones,
          )
        ).data.comandas,
    ),
  ]);
  const cantidades = new Map(
    prendas.map((p) => [
      claveCuenta(p.comanda.cliente.id, p.comanda.empresa),
      p.cantidad_sum ?? 0,
    ]),
  );
  const resumen = cuentas
    .map((c) => ({
      id: claveCuenta(c.cliente.id, c.empresa),
      label: c.cliente.nombre + (c.empresa ? ` · ${c.empresa}` : ""),
      comandas: c._count,
      prendas: cantidades.get(claveCuenta(c.cliente.id, c.empresa)) ?? 0,
      facturado: c.valorTotal_sum ?? 0,
    }))
    .sort(
      (a, b) =>
        b.facturado - a.facturado || a.label.localeCompare(b.label, "es"),
    );
  const detalle = comandas.map((c) => ({
    id: c.id,
    numero: c.numeroComanda,
    fecha: c.fechaRecepcion,
    cliente: c.cliente.nombre,
    empresa: c.empresa ?? "",
    estado: c.estado,
    prendas: c.prendas[0]?.cantidad_sum ?? 0,
    facturado: c.valorTotal,
  }));
  return totales(resumen, detalle);
}
