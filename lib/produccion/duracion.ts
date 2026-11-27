/**
 * Formatea una duración en minutos a texto legible en español (horas y minutos),
 * redondeando hacia arriba al minuto entero. La detección y los límites siguen en minutos.
 *
 * @param minutos - Duración expresada en minutos (valores negativos se normalizan a `0`).
 */
export function formatearDuracion(minutos: number) {
  const total = Math.max(0, Math.ceil(minutos));
  const horas = Math.floor(total / 60);
  const resto = total % 60;
  const textoMinutos = `${resto} ${resto === 1 ? "minuto" : "minutos"}`;
  if (!horas) return textoMinutos;
  const textoHoras = `${horas} ${horas === 1 ? "hora" : "horas"}`;
  return resto ? `${textoHoras} y ${textoMinutos}` : textoHoras;
}
