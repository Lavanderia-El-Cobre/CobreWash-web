/** Cómo se cobra una comanda: por cantidad de prendas o por peso total. */
export type ModalidadCobro = "PRENDA" | "KILO";

/** Tope superior de precio por kilogramo (CLP) para prevenir errores de digitación. */
export const PRECIO_KG_MAXIMO = 1_000_000;
/** Largo máximo permitido para el nombre normalizado de una prenda. */
export const PRENDA_NOMBRE_MAXIMO = 60;
/** Línea que se guarda cuando una comanda por kg no detalla sus prendas. */
export const PRENDA_POR_KILO = "ROPA POR KILO";

/** Total de una comanda por kg: peso × precio, redondeado al peso. */
export function totalPorKg(pesoKg: number, precioKg: number): number {
  return Math.round(pesoKg * precioKg);
}

/**
 * Subtotales de cada línea de una comanda por kg. Cada línea cobra su parte
 * del peso; los redondeos se reparten para que la suma sea exactamente el
 * total por kg y ninguna línea se aleje más de $1 de su peso × precio.
 */
export function subtotalesPorKg(pesos: number[], precioKg: number): number[] {
  const exactos = pesos.map((kg) => kg * precioKg);
  const base = exactos.map(Math.floor);
  const total = totalPorKg(pesos.reduce((s, kg) => s + kg, 0), precioKg);
  let faltante = total - base.reduce((s, v) => s + v, 0);
  // Método del resto mayor: asigna $1 adicional a las líneas con mayor parte fraccionaria.
  const orden = exactos.map((v, i) => ({ i, resto: v - base[i] })).sort((a, b) => b.resto - a.resto);
  for (const { i } of orden) {
    if (faltante <= 0) break;
    base[i] += 1;
    faltante -= 1;
  }
  return base;
}

/** Lee el precio por kg escrito ("2.500", "2500"); null si no es válido. */
export function leerPrecioKg(texto: string): number | null {
  const limpio = texto.trim().replace(/[$\s.]/g, "").replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(limpio)) return null;
  const precio = Math.round(Number(limpio));
  return precio > 0 && precio <= PRECIO_KG_MAXIMO ? precio : null;
}

// Clave insensible a tildes y mayúsculas para detectar prendas duplicadas en el catálogo.
const claveCatalogo = (valor: string) =>
  valor.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLocaleLowerCase("es-CL");

/** Nombre de una prenda escrita a mano: sin espacios de más y en mayúsculas. */
export function normalizarPrendaNueva(texto: string): string {
  return texto.replace(/\s+/g, " ").trim().toLocaleUpperCase("es-CL").slice(0, PRENDA_NOMBRE_MAXIMO).trim();
}

/**
 * Opciones del selector de prendas: primero el catálogo base del tipo de
 * cliente y luego las prendas que el personal agregó (guardadas en la BD) o
 * que ya están en el formulario, sin repetir nombres equivalentes.
 */
export function opcionesPrendas(base: readonly string[], ...extras: (readonly string[])[]): string[] {
  const vistas = new Set(base.map(claveCatalogo));
  const resultado = [...base];
  for (const nombre of extras.flat()) {
    const limpio = normalizarPrendaNueva(nombre);
    const clave = claveCatalogo(limpio);
    if (!limpio || vistas.has(clave)) continue;
    vistas.add(clave);
    resultado.push(limpio);
  }
  return resultado;
}
