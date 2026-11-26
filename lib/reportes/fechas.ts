const zona = "America/Santiago";
const formato = new Intl.DateTimeFormat("en-CA", {
  timeZone: zona,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * Formatea un instante como fecha calendario `YYYY-MM-DD` en zona `America/Santiago`.
 *
 * @param value - Fecha ISO o instancia `Date` (por defecto, el instante actual).
 */
export function fechaChile(value: string | Date = new Date()) {
  const partes = formato.formatToParts(new Date(value));
  return ["year", "month", "day"]
    .map((tipo) => partes.find((p) => p.type === tipo)!.value)
    .join("-");
}

function validarFecha(fecha: string) {
  // Compara contra `toISOString()` para descartar fechas desbordadas como 2026-02-31.
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(fecha) &&
    Number.isFinite(Date.parse(fecha)) &&
    new Date(fecha).toISOString().slice(0, 10) === fecha
  );
}

/**
 * Valida un rango obligatorio de fechas (`YYYY-MM-DD`) de hasta cinco años.
 *
 * @param desde - Fecha inicial inclusive.
 * @param hasta - Fecha final inclusive.
 * @returns Mensaje de error en español, o cadena vacía si el rango es válido.
 */
export function errorRango(desde: string, hasta: string) {
  if (!validarFecha(desde) || !validarFecha(hasta))
    return "Selecciona ambas fechas válidas.";
  if (desde > hasta)
    return "La fecha inicial debe ser anterior o igual a la final.";
  if (Date.parse(hasta) - Date.parse(desde) > 366 * 5 * 86400000)
    return "Selecciona un periodo de hasta cinco años.";
  return "";
}

/**
 * Desplaza una fecha calendario `YYYY-MM-DD` una cantidad entera de días.
 *
 * @param fecha - Fecha base en formato `YYYY-MM-DD`.
 * @param dias - Cantidad de días a sumar (o restar si es negativo).
 */
export function sumarDias(fecha: string, dias: number) {
  return new Date(Date.parse(fecha) + dias * 86400000)
    .toISOString()
    .slice(0, 10);
}

// Búsqueda binaria del primer instante del día chileno: contempla cambios de
// horario de verano/invierno sin asumir un offset fijo ni la zona del equipo.
function inicioDia(fecha: string) {
  let inferior = Date.parse(fecha) - 86400000;
  let superior = Date.parse(fecha) + 86400000;
  while (inferior < superior) {
    const medio = Math.floor((inferior + superior) / 2);
    if (fechaChile(new Date(medio)) < fecha) inferior = medio + 1;
    else superior = medio;
  }
  return new Date(inferior).toISOString();
}

/**
 * Convierte un rango obligatorio de fechas chilenas (`YYYY-MM-DD`) en límites ISO UTC
 * semiabiertos `[desde, hasta)` listos para consultas en base de datos.
 *
 * @param desde - Fecha inicial inclusive.
 * @param hasta - Fecha final inclusive.
 */
export function rangoConsulta(desde: string, hasta: string) {
  const error = errorRango(desde, hasta);
  if (error) throw new Error(error);
  return { desde: inicioDia(desde), hasta: inicioDia(sumarDias(hasta, 1)) };
}

/**
 * Convierte filtros opcionales de fecha (`YYYY-MM-DD`) a límites ISO UTC:
 * inicio inclusivo y primer instante del día siguiente exclusivo.
 *
 * @param desde - Fecha inicial opcional en formato `YYYY-MM-DD`.
 * @param hasta - Fecha final opcional en formato `YYYY-MM-DD`.
 */
export function limitesFechasConsulta(desde: string, hasta: string) {
  if ((desde && !validarFecha(desde)) || (hasta && !validarFecha(hasta)))
    throw new Error("Selecciona fechas válidas.");
  if (desde && hasta && desde > hasta)
    throw new Error("La fecha inicial debe ser anterior o igual a la final.");
  return {
    fechaDesde: desde ? inicioDia(desde) : undefined,
    fechaHastaExclusiva: hasta ? inicioDia(sumarDias(hasta, 1)) : undefined,
  };
}

/**
 * Variante inclusiva (hasta el último milisegundo del día final) pensada para
 * filtros en memoria que comparan timestamps con `<=`.
 *
 * @param desde - Fecha inicial opcional en formato `YYYY-MM-DD`.
 * @param hasta - Fecha final opcional en formato `YYYY-MM-DD`.
 */
export function limitesFechasInclusivos(desde: string, hasta: string) {
  const limites = limitesFechasConsulta(desde, hasta);
  return { fechaDesde: limites.fechaDesde, fechaHasta: limites.fechaHastaExclusiva
    ? new Date(Date.parse(limites.fechaHastaExclusiva) - 1).toISOString() : undefined };
}

/** Devuelve el rango inicial por defecto: desde el día 1 del mes en curso hasta hoy en Chile. */
export function periodoInicial() {
  const hasta = fechaChile();
  return { desde: hasta.slice(0, 7) + "-01", hasta };
}
