/** Valores iniciales ajustables por administración, en minutos continuos. */
export const LIMITES_ETAPAS = [
  { orden: 1, nombre: "Recepción", minutos: 15 },
  { orden: 2, nombre: "Lavado", minutos: 90 },
  { orden: 3, nombre: "Secado", minutos: 60 },
  { orden: 4, nombre: "Planchado", minutos: 60 },
  { orden: 5, nombre: "Entrega", minutos: 1440 },
] as const;

/**
 * Resuelve el límite de tiempo en minutos para una etapa, priorizando el valor
 * persistido y usando el límite por defecto según su orden cuando no está definido.
 *
 * @param orden - Posición ordinal de la etapa dentro del flujo.
 * @param minutos - Límite configurado explícitamente, si existe.
 */
export function limiteEtapaMin(orden: number, minutos?: number | null) {
  return minutos ?? LIMITES_ETAPAS.find((e) => e.orden === orden)?.minutos ?? null;
}

/**
 * Convierte un límite ingresado por el usuario a minutos enteros positivos.
 * Acepta hasta 43 200 minutos (30 días) y rechaza valores que no correspondan
 * a un minuto exacto (tolerando imprecisión binaria de `1e-8` al multiplicar horas).
 *
 * @param valor - Texto numérico ingresado en el formulario.
 * @param unidad - Unidad en la que se expresa `valor`.
 * @returns Cantidad entera de minutos válida, o `null` si el valor es inválido.
 */
export function convertirLimiteMin(valor: string, unidad: "minutos" | "horas") {
  if (!valor.trim()) return null;
  const minutos = Number(valor) * (unidad === "horas" ? 60 : 1);
  const entero = Math.round(minutos);
  return Number.isSafeInteger(entero) && Math.abs(minutos - entero) < 1e-8 && entero > 0 && entero <= 43_200 ? entero : null;
}
