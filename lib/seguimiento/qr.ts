/**
 * Valida y canoniza un código QR de comanda a formato UUID con guiones en minúsculas.
 * Data Connect puede serializar UUID sin guiones; el contrato impreso usa UUID canónico.
 *
 * @param value - Código UUID crudo (con o sin guiones).
 */
export function normalizarCodigoQr(value?: string | null): string {
  const limpio = value?.trim().toLowerCase() ?? "";
  if (/^[0-9a-f]{32}$/.test(limpio)) return limpio.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(limpio)) {
    throw new Error("El código QR de la comanda es inválido o no está disponible.");
  }
  return limpio;
}

/**
 * Construye la URL pública `/seguimiento?qr=...` que se codifica en el QR impreso.
 * Exige un origen HTTPS limpio (sin ruta, query, hash ni credenciales) para impedir
 * la emisión de enlaces manipulados o inseguros.
 *
 * @param codigoQr - UUID de seguimiento de la comanda.
 * @param baseUrl - Origen base configurado (por defecto `NEXT_PUBLIC_SEGUIMIENTO_BASE_URL`).
 */
export function crearUrlSeguimiento(codigoQr?: string | null, baseUrl = process.env.NEXT_PUBLIC_SEGUIMIENTO_BASE_URL): string {
  if (!baseUrl?.trim()) throw new Error("Falta configurar el dominio de seguimiento para emitir el QR.");
  let base: URL;
  try { base = new URL(baseUrl.trim()); }
  catch { throw new Error("El dominio de seguimiento debe ser un origen HTTPS válido."); }
  if (base.protocol !== "https:" || base.username || base.password || base.pathname !== "/" || base.search || base.hash) {
    throw new Error("El dominio de seguimiento debe ser un origen HTTPS sin ruta, parámetros ni credenciales.");
  }
  const url = new URL("/seguimiento", base.origin);
  url.searchParams.set("qr", normalizarCodigoQr(codigoQr));
  return url.toString();
}

/**
 * Variante segura de `crearUrlSeguimiento` que captura errores de configuración o
 * formato y devuelve `{ url, error }` para renderizado directo en la UI.
 *
 * @param codigoQr - UUID de seguimiento de la comanda.
 */
export function obtenerEnlaceSeguimiento(codigoQr?: string | null) {
  try { return { url: crearUrlSeguimiento(codigoQr), error: null }; }
  catch (error) { return { url: null, error: error instanceof Error ? error.message : "No se pudo generar el QR." }; }
}

/**
 * Normaliza un número de comanda al prefijo canónico `ELCOBRE-XXXX`.
 * Acepta el código completo (`ELCOBRE-XXXX`, el prefijo antiguo `COBRE-XXXX`) o solo
 * el sufijo alfanumérico de cuatro caracteres.
 *
 * @param value - Texto ingresado por el usuario.
 */
export function normalizarNumeroComanda(value: string): string {
  const sufijo = value.trim().replace(/^(?:ELCOBRE|COBRE)-/i, "").toUpperCase();
  // Aceptar también históricos de solo letras o números; la mezcla se exige al crear.
  if (!/^[A-Z0-9]{4}$/.test(sufijo)) throw new Error("Ingresa el número de comanda completo o su código de cuatro caracteres.");
  return `ELCOBRE-${sufijo}`;
}
