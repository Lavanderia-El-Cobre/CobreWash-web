import { limitesFechasInclusivos } from "@/lib/reportes/fechas";
import type {
  EstadoOperativoVehiculo,
  ResumenVehiculo,
  SalidaFlota,
} from "./modelo";
import { calcularKilometrosRecorridos, obtenerInspeccionMomento } from "./validaciones";

/** Tiempo en ruta (en minutos) a partir del cual se marca alerta visual de demora (8 horas). */
export const UMBRAL_DEMORA_MINUTOS = 480;

/**
 * Filtra el resumen de la flota por estado operativo y coincidencia parcial en
 * patente, marca, modelo, descripción, año o nombre del conductor activo.
 *
 * @param resumen - Lista de resúmenes por vehículo.
 * @param busqueda - Texto libre de búsqueda.
 * @param estado - Filtro de estado operativo o `"Todos"`.
 */
export function filtrarResumenFlota(
  resumen: ResumenVehiculo[],
  busqueda: string,
  estado: "Todos" | EstadoOperativoVehiculo,
): ResumenVehiculo[] {
  const termino = busqueda.trim().toLowerCase();
  return resumen.filter((item) => {
    if (estado !== "Todos" && item.estadoOperativo !== estado) {
      return false;
    }
    if (!termino) return true;
    const { vehiculo, salidaActiva } = item;
    const conductor = salidaActiva
      ? `${salidaActiva.repartidor.nombre} ${salidaActiva.repartidor.apellido ?? ""}`.toLowerCase()
      : "";
    return (
      vehiculo.patente.toLowerCase().includes(termino) ||
      vehiculo.marca.toLowerCase().includes(termino) ||
      vehiculo.modelo.toLowerCase().includes(termino) ||
      (vehiculo.descripcion ?? "").toLowerCase().includes(termino) ||
      String(vehiculo.anio ?? "").includes(termino) ||
      conductor.includes(termino)
    );
  });
}

/**
 * Traduce errores técnicos o restricciones de base de datos/Data Connect a
 * mensajes de negocio claros para la interfaz de vehículos y reparto.
 *
 * @param error - Excepción capturada al ejecutar una mutación de flota.
 */
export function mapearErrorVehiculos(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  if (/Ya existe un vehículo|Ya existe otro vehículo|unique constraint|already_exists/i.test(msg)) {
    return "Ya existe un vehículo registrado con esa patente.";
  }
  if (/No se puede desactivar un vehículo con una salida en curso/i.test(msg)) {
    return "No se puede desactivar un vehículo mientras tiene una salida en curso.";
  }
  if (/Ya tienes un vehículo en ruta/i.test(msg)) {
    return "Ya tienes un vehículo en ruta: registra su regreso antes de tomar otro.";
  }
  if (/no está registrada a tu nombre|no pertenece a tu salida/i.test(msg)) {
    return "Esa salida no está registrada a tu nombre.";
  }
  if (/no existe o ya fue finalizada/i.test(msg)) {
    return "La salida ya fue cerrada. Actualiza la vista para ver su estado.";
  }
  if (/NO_APTO/i.test(msg)) {
    return "No se puede autorizar la salida de un vehículo calificado como NO APTO.";
  }
  if (/ya se encuentra en ruta|salida activa/i.test(msg)) {
    return "El vehículo ya registra una salida activa en curso.";
  }
  if (/kilometraje de retorno no puede ser menor/i.test(msg)) {
    return "El kilometraje de retorno no puede ser menor al kilometraje de salida.";
  }
  if (/inactivo/i.test(msg)) {
    return "El vehículo o conductor seleccionado se encuentra inactivo.";
  }
  if (/Solo administradores|Solo administración|No autorizado/i.test(msg)) {
    return "No tienes permisos para ejecutar esta operación.";
  }
  return "No fue posible guardar los cambios. Verifica los datos e intenta nuevamente.";
}

/**
 * Formatea una fecha ISO en `DD-MM-YYYY HH:mm` (24 h) en horario de Chile,
 * devolviendo `"—"` cuando falta o es inválida.
 *
 * @param iso - Marca temporal ISO o valor nulo/indefinido.
 */
export function formatearFechaHoraVehiculo(iso?: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: "America/Santiago",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

/**
 * Calcula los minutos completos transcurridos desde el inicio de una salida
 * hasta `ahoraMs` (nunca negativo).
 *
 * @param fechaSalida - Marca temporal ISO de salida.
 * @param ahoraMs - Referencia actual en milisegundos.
 */
export function calcularMinutosEnRuta(
  fechaSalida?: string | null,
  ahoraMs: number = Date.now(),
): number {
  if (!fechaSalida) return 0;
  const inicio = Date.parse(fechaSalida);
  if (Number.isNaN(inicio)) return 0;
  return Math.max(0, Math.floor((ahoraMs - inicio) / 60_000));
}

/**
 * Formatea una duración en ruta a formato compacto (`45 min`, `2 h`, `2 h 15 min`).
 *
 * @param minutos - Cantidad entera de minutos en ruta.
 */
export function formatearDuracionRuta(minutos: number): string {
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto > 0 ? `${horas} h ${resto} min` : `${horas} h`;
}

/** Criterios de filtrado para el historial de salidas de la flota. */
export interface FiltrosHistorialVehiculo {
  vehiculoId: string;
  repartidorId: string;
  estado: "TODOS" | SalidaFlota["estado"];
  desde: string;
  hasta: string;
}

/**
 * Filtra en memoria el historial de salidas por vehículo, conductor, estado
 * y rango de fechas sobre `fechaSalida` (o `creadoEn` si aún no registra salida).
 *
 * @param salidas - Lista completa de salidas obtenidas de la flota.
 * @param filtros - Filtros activos en el panel de historial.
 */
export function filtrarSalidasHistorial(
  salidas: SalidaFlota[],
  filtros: FiltrosHistorialVehiculo,
): SalidaFlota[] {
  let desdeMs: number | null = null;
  let hastaMs: number | null = null;
  if (filtros.desde || filtros.hasta) {
    try {
      const limites = limitesFechasInclusivos(filtros.desde, filtros.hasta);
      desdeMs = limites.fechaDesde ? Date.parse(limites.fechaDesde) : null;
      hastaMs = limites.fechaHasta ? Date.parse(limites.fechaHasta) : null;
    } catch {
      desdeMs = filtros.desde ? Date.parse(`${filtros.desde}T00:00:00-03:00`) : null;
      hastaMs = filtros.hasta ? Date.parse(`${filtros.hasta}T23:59:59.999-03:00`) : null;
    }
  }

  return salidas.filter((salida) => {
    if (filtros.vehiculoId && salida.vehiculo.id !== filtros.vehiculoId) {
      return false;
    }
    if (filtros.repartidorId && salida.repartidor.id !== filtros.repartidorId) {
      return false;
    }
    if (filtros.estado !== "TODOS" && salida.estado !== filtros.estado) {
      return false;
    }
    const refFecha = salida.fechaSalida ?? salida.creadoEn;
    const ms = Date.parse(refFecha);
    if (desdeMs !== null && !Number.isNaN(ms) && ms < desdeMs) {
      return false;
    }
    if (hastaMs !== null && !Number.isNaN(ms) && ms > hastaMs) {
      return false;
    }
    return true;
  });
}

/**
 * Genera el contenido CSV del historial de salidas listo para descargar.
 * Incluye BOM UTF-8 (`\uFEFF`) para compatibilidad con Excel y antepone apóstrofe
 * a valores que inicien con `=`, `+`, `-` o `@` para prevenir inyección de fórmulas.
 *
 * @param salidas - Salidas filtradas a exportar.
 */
export function crearCsvHistorialVehiculos(salidas: SalidaFlota[]): string {
  const escapar = (val: string | number | null | undefined) => {
    const str = String(val ?? "");
    const seguro = /^[=+\-@]/.test(str) ? `'${str}` : str;
    return `"${seguro.replace(/"/g, '""')}"`;
  };

  const encabezados = [
    "Patente",
    "Vehiculo",
    "Conductor",
    "Estado Viaje",
    "Fecha Salida",
    "Fecha Retorno",
    "Km Salida",
    "Km Retorno",
    "Km Recorridos",
    "Estado Inicial",
    "Estado Retorno",
    "Fotos Adjuntas",
    "Observaciones",
  ];

  const filas = salidas.map((s) => {
    const antes = obtenerInspeccionMomento(s, "ANTES");
    const despues = obtenerInspeccionMomento(s, "DESPUES");
    const recorridos = calcularKilometrosRecorridos(s);
    const totalFotos =
      (antes?.fotos.length ?? 0) + (despues?.fotos.length ?? 0);
    const conductor = `${s.repartidor.nombre} ${s.repartidor.apellido ?? ""}`.trim();
    const obs = [
      s.observaciones,
      antes?.observaciones ? `Salida: ${antes.observaciones}` : null,
      despues?.observaciones ? `Retorno: ${despues.observaciones}` : null,
    ]
      .filter(Boolean)
      .join(" | ");

    return [
      s.vehiculo.patente,
      `${s.vehiculo.marca} ${s.vehiculo.modelo}`,
      conductor,
      s.estado,
      formatearFechaHoraVehiculo(s.fechaSalida ?? s.creadoEn),
      formatearFechaHoraVehiculo(s.fechaRetorno),
      antes?.kilometraje ?? "",
      despues?.kilometraje ?? "",
      recorridos ?? "",
      antes?.estadoVehiculo ?? "",
      despues?.estadoVehiculo ?? "",
      totalFotos,
      obs,
    ]
      .map(escapar)
      .join(",");
  });

  return "\uFEFF" + [encabezados.map(escapar).join(","), ...filas].join("\r\n");
}
