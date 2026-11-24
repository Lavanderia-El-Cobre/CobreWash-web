import { formatChileanPhone, getChileanPhoneType } from "@/lib/validators";

/**
 * Teléfonos de Chile y del resto de Latinoamérica.
 *
 * El valor que se guarda siempre queda en formato internacional con el
 * prefijo del país y los dígitos agrupados con espacios:
 *   - Chile celular: `+56 9 1234 5678` (idéntico a `formatChileanPhone`).
 *   - Chile fijo:    `+56 2 2345 6789` o `+56 55 234 5678`.
 *   - Otros países:  `+51 912 345 678`, `+54 11 2345 6789`, `+1 809 123 4567`…
 *
 * La persona solo escribe su número nacional: el prefijo lo pone el selector.
 * Los valores antiguos sin `+` se interpretan como chilenos, igual que
 * `cleanChileanPhone`.
 */
export interface PaisTelefono {
  /** Opción del selector: país, o "CL-FIJO" para los fijos chilenos. */
  id: string;
  nombre: string;
  /** Texto de la opción en el selector. */
  etiqueta: string;
  bandera: string;
  /** Código de país sin `+`. */
  codigo: string;
  /** Dígito fijo que va después del código y que la persona no escribe (Chile celular: 9). */
  prefijo?: string;
  /** Largos admitidos del número que escribe la persona. */
  largos: number[];
  /** Agrupación de dígitos para cada largo admitido. */
  grupos: Record<number, number[]>;
  /** Forma válida del número completo que escribe la persona. */
  patron?: RegExp;
  /** Número de ejemplo, ya agrupado, para el placeholder. */
  ejemplo: string;
}

export const PAIS_TELEFONO_PREDETERMINADO = "CL";

const ocho = { largos: [8], grupos: { 8: [4, 4] } };

export const PAISES_TELEFONO: PaisTelefono[] = [
  { id: "CL", nombre: "Chile", etiqueta: "Chile · celular", bandera: "🇨🇱", codigo: "56", prefijo: "9", largos: [8], grupos: { 8: [4, 4] }, ejemplo: "1234 5678" },
  { id: "CL-FIJO", nombre: "Chile", etiqueta: "Chile · teléfono fijo", bandera: "🇨🇱", codigo: "56", largos: [9], grupos: {}, ejemplo: "55 234 5678" },
  { id: "AR", nombre: "Argentina", etiqueta: "Argentina", bandera: "🇦🇷", codigo: "54", largos: [10, 11], grupos: { 10: [2, 4, 4], 11: [1, 2, 4, 4] }, patron: /^(9[1-9]\d{9}|[1-8]\d{9})$/, ejemplo: "11 2345 6789" },
  { id: "BO", nombre: "Bolivia", etiqueta: "Bolivia", bandera: "🇧🇴", codigo: "591", ...ocho, patron: /^[2-7]\d{7}$/, ejemplo: "7123 4567" },
  { id: "BR", nombre: "Brasil", etiqueta: "Brasil", bandera: "🇧🇷", codigo: "55", largos: [10, 11], grupos: { 10: [2, 4, 4], 11: [2, 5, 4] }, patron: /^[1-9]{2}(9\d{8}|[2-8]\d{7})$/, ejemplo: "11 91234 5678" },
  { id: "CO", nombre: "Colombia", etiqueta: "Colombia", bandera: "🇨🇴", codigo: "57", largos: [10], grupos: { 10: [3, 3, 4] }, patron: /^(3\d{9}|60\d{8})$/, ejemplo: "300 123 4567" },
  { id: "CR", nombre: "Costa Rica", etiqueta: "Costa Rica", bandera: "🇨🇷", codigo: "506", ...ocho, ejemplo: "8312 3456" },
  { id: "CU", nombre: "Cuba", etiqueta: "Cuba", bandera: "🇨🇺", codigo: "53", ...ocho, ejemplo: "5123 4567" },
  { id: "EC", nombre: "Ecuador", etiqueta: "Ecuador", bandera: "🇪🇨", codigo: "593", largos: [8, 9], grupos: { 8: [1, 3, 4], 9: [2, 3, 4] }, patron: /^(9\d{8}|[2-7]\d{7})$/, ejemplo: "99 123 4567" },
  { id: "SV", nombre: "El Salvador", etiqueta: "El Salvador", bandera: "🇸🇻", codigo: "503", ...ocho, ejemplo: "7012 3456" },
  { id: "GT", nombre: "Guatemala", etiqueta: "Guatemala", bandera: "🇬🇹", codigo: "502", ...ocho, ejemplo: "5123 4567" },
  { id: "HN", nombre: "Honduras", etiqueta: "Honduras", bandera: "🇭🇳", codigo: "504", ...ocho, ejemplo: "9123 4567" },
  { id: "MX", nombre: "México", etiqueta: "México", bandera: "🇲🇽", codigo: "52", largos: [10], grupos: { 10: [2, 4, 4] }, ejemplo: "55 1234 5678" },
  { id: "NI", nombre: "Nicaragua", etiqueta: "Nicaragua", bandera: "🇳🇮", codigo: "505", ...ocho, ejemplo: "8123 4567" },
  { id: "PA", nombre: "Panamá", etiqueta: "Panamá", bandera: "🇵🇦", codigo: "507", largos: [7, 8], grupos: { 7: [3, 4], 8: [4, 4] }, ejemplo: "6123 4567" },
  { id: "PY", nombre: "Paraguay", etiqueta: "Paraguay", bandera: "🇵🇾", codigo: "595", largos: [8, 9], grupos: { 8: [2, 3, 3], 9: [3, 3, 3] }, ejemplo: "981 123 456" },
  { id: "PE", nombre: "Perú", etiqueta: "Perú", bandera: "🇵🇪", codigo: "51", largos: [8, 9], grupos: { 8: [2, 3, 3], 9: [3, 3, 3] }, patron: /^(9\d{8}|[1-8]\d{7})$/, ejemplo: "912 345 678" },
  { id: "PR", nombre: "Puerto Rico", etiqueta: "Puerto Rico", bandera: "🇵🇷", codigo: "1", largos: [10], grupos: { 10: [3, 3, 4] }, patron: /^(787|939)\d{7}$/, ejemplo: "787 123 4567" },
  { id: "DO", nombre: "República Dominicana", etiqueta: "República Dominicana", bandera: "🇩🇴", codigo: "1", largos: [10], grupos: { 10: [3, 3, 4] }, patron: /^(809|829|849)\d{7}$/, ejemplo: "809 123 4567" },
  { id: "UY", nombre: "Uruguay", etiqueta: "Uruguay", bandera: "🇺🇾", codigo: "598", largos: [8], grupos: { 8: [2, 3, 3] }, patron: /^[249]\d{7}$/, ejemplo: "94 123 456" },
  { id: "VE", nombre: "Venezuela", etiqueta: "Venezuela", bandera: "🇻🇪", codigo: "58", largos: [10], grupos: { 10: [3, 3, 4] }, patron: /^[24-9]\d{9}$/, ejemplo: "412 123 4567" },
];

const POR_ID = new Map(PAISES_TELEFONO.map((pais) => [pais.id, pais]));
// Códigos más largos primero: ninguno de tres dígitos (50x, 59x) empieza como uno de dos.
const CODIGOS = [...new Set(PAISES_TELEFONO.map((pais) => pais.codigo))].sort((a, b) => b.length - a.length);

export function obtenerPaisTelefono(id: string): PaisTelefono {
  return POR_ID.get(id) ?? POR_ID.get(PAIS_TELEFONO_PREDETERMINADO)!;
}

const esFijoChileno = (pais: PaisTelefono) => pais.id === "CL-FIJO";
const largoMaximo = (pais: PaisTelefono) => Math.max(...pais.largos);
const soloDigitos = (valor: string) => valor.replace(/\D/g, "");
const esInternacional = (texto: string) => texto.startsWith("+") || texto.startsWith("00");
/** Dígitos de un número internacional, sin el `00` de salida si lo trae. */
const digitosInternacionales = (texto: string) => (texto.startsWith("00") ? soloDigitos(texto).slice(2) : soloDigitos(texto));

/** Prefijo visible del selector, por ejemplo `+56 9` o `+51`. */
export function prefijoVisible(pais: PaisTelefono): string {
  return `+${pais.codigo}${pais.prefijo ? ` ${pais.prefijo}` : ""}`;
}

function agrupar(digitos: string, grupos: number[]): string {
  const partes: string[] = [];
  let inicio = 0;
  for (const largo of grupos) {
    if (inicio >= digitos.length) break;
    partes.push(digitos.slice(inicio, inicio + largo));
    inicio += largo;
  }
  if (inicio < digitos.length) partes.push(digitos.slice(inicio));
  return partes.join(" ");
}

/** Número nacional agrupado, sin el prefijo del país. */
export function formatearNacional(pais: PaisTelefono, nacional: string): string {
  const digitos = soloDigitos(nacional).slice(0, largoMaximo(pais));
  if (!digitos) return "";
  if (esFijoChileno(pais)) return formatChileanPhone(digitos).replace(/^\+56 /, "");
  // Mientras se escribe se usa la agrupación del menor largo que aún cabe.
  const largo = pais.largos.find((l) => l >= digitos.length) ?? largoMaximo(pais);
  return agrupar(digitos, pais.grupos[largo] ?? [digitos.length]);
}

/** Valor completo a guardar; vacío si no hay dígitos. */
export function formatearTelefono(paisId: string, nacional: string): string {
  const pais = obtenerPaisTelefono(paisId);
  const digitos = soloDigitos(nacional).slice(0, largoMaximo(pais));
  if (!digitos) return "";
  if (esFijoChileno(pais)) return formatChileanPhone(digitos);
  return `${prefijoVisible(pais)} ${formatearNacional(pais, digitos)}`;
}

export interface TelefonoDetectado {
  pais: PaisTelefono;
  /** Dígitos que escribe la persona (sin código de país ni prefijo fijo). */
  nacional: string;
  /** Falso si el valor trae un prefijo internacional que no está en la lista. */
  reconocido: boolean;
}

function chileno(digitos: string): TelefonoDetectado {
  if (!digitos || digitos.startsWith("9")) return { pais: obtenerPaisTelefono("CL"), nacional: digitos.slice(1, 9), reconocido: true };
  return { pais: obtenerPaisTelefono("CL-FIJO"), nacional: digitos.slice(0, 9), reconocido: true };
}

/** Detecta el país desde el prefijo guardado; sin `+` se asume Chile. */
export function detectarTelefono(valor: string): TelefonoDetectado {
  const texto = valor.trim();
  if (!texto) return { pais: obtenerPaisTelefono(PAIS_TELEFONO_PREDETERMINADO), nacional: "", reconocido: true };

  if (!esInternacional(texto)) {
    // Compatibilidad con números chilenos escritos a mano (9 dígitos, 56…, 0…).
    let digitos = soloDigitos(texto);
    if (digitos.length >= 10 && digitos.startsWith("56")) digitos = digitos.slice(2);
    if (digitos.length >= 10 && digitos.startsWith("0")) digitos = digitos.slice(1);
    return chileno(digitos);
  }

  const digitos = digitosInternacionales(texto);
  const codigo = CODIGOS.find((c) => digitos.startsWith(c));
  if (!codigo) return { pais: obtenerPaisTelefono(PAIS_TELEFONO_PREDETERMINADO), nacional: "", reconocido: false };

  const resto = digitos.slice(codigo.length);
  if (codigo === "56") return chileno(resto);
  if (codigo === "1") {
    const pais = obtenerPaisTelefono(/^(787|939)/.test(resto) ? "PR" : "DO");
    return { pais, nacional: resto.slice(0, largoMaximo(pais)), reconocido: true };
  }
  const pais = PAISES_TELEFONO.find((p) => p.codigo === codigo)!;
  return { pais, nacional: resto.slice(0, largoMaximo(pais)), reconocido: true };
}

/** Dígitos nacionales de un valor guardado, leídos según la opción elegida. */
export function extraerNacional(pais: PaisTelefono, valor: string): string {
  if (!valor.trim()) return "";
  const detectado = detectarTelefono(valor);
  if (detectado.pais.id === pais.id) return detectado.nacional;
  // Misma clave de país con otra opción (Chile celular/fijo, +1 Puerto Rico/Dominicana).
  let digitos = soloDigitos(valor);
  if (digitos.startsWith(pais.codigo)) digitos = digitos.slice(pais.codigo.length);
  if (pais.prefijo && digitos.startsWith(pais.prefijo)) digitos = digitos.slice(pais.prefijo.length);
  return digitos.slice(0, largoMaximo(pais));
}

/**
 * Interpreta lo que la persona escribe o pega en el campo del número.
 * Si pega un número con `+` se cambia de país; si pega el número con su
 * código de país o el 9 del celular chileno, se quitan.
 */
export function interpretarEntrada(pais: PaisTelefono, texto: string): { pais: PaisTelefono; nacional: string } {
  if (texto.includes("+")) {
    const detectado = detectarTelefono(texto.slice(texto.indexOf("+")));
    if (detectado.reconocido) return { pais: detectado.pais, nacional: detectado.nacional };
  }
  let digitos = soloDigitos(texto);
  const maximo = largoMaximo(pais);
  const completo = `${pais.codigo}${pais.prefijo ?? ""}`;
  if (digitos.length > maximo && digitos.startsWith(completo) && digitos.length - completo.length <= maximo) {
    digitos = digitos.slice(completo.length);
  } else if (pais.prefijo && digitos.length === maximo + pais.prefijo.length && digitos.startsWith(pais.prefijo)) {
    digitos = digitos.slice(pais.prefijo.length);
  }
  return { pais, nacional: digitos.slice(0, maximo) };
}

function listaDeLargos(largos: number[]): string {
  // "u" antes de palabras que suenan con "o": ocho, once.
  return largos.reduce((texto, largo, i) => {
    if (i === 0) return String(largo);
    const conector = /^(8|11)$/.test(String(largo)) ? "u" : "o";
    return `${texto} ${conector} ${largo}`;
  }, "");
}

/** Error del número nacional para la opción elegida, o null si es válido o está vacío. */
export function validarNacional(pais: PaisTelefono, nacional: string): string | null {
  const digitos = soloDigitos(nacional);
  if (!digitos) return null;
  if (pais.id === "CL") {
    return digitos.length === 8 ? null : "El celular chileno debe tener 8 dígitos después de +56 9.";
  }
  if (esFijoChileno(pais)) {
    if (digitos.startsWith("9")) return "Los teléfonos fijos no empiezan con 9: elige «Chile · celular».";
    return getChileanPhoneType(digitos) === "Teléfono fijo"
      ? null
      : "Ingresa un teléfono fijo chileno válido: código de área y número, 9 dígitos en total.";
  }
  if (!pais.largos.includes(digitos.length)) {
    return `El número de ${pais.nombre} debe tener ${listaDeLargos(pais.largos)} dígitos después de +${pais.codigo}.`;
  }
  if (pais.patron && !pais.patron.test(digitos)) return `Revisa el número: no corresponde a un teléfono de ${pais.nombre}.`;
  return null;
}

/** Error de un valor guardado o recibido, o null si es válido o está vacío. */
export function validarTelefono(valor: string): string | null {
  if (!valor.trim()) return null;
  const detectado = detectarTelefono(valor);
  if (!detectado.reconocido) return "Usa un teléfono de Chile o de otro país de Latinoamérica, con su prefijo.";
  // El número completo debe calzar exactamente: no se aceptan dígitos sobrantes.
  if (formatearTelefono(detectado.pais.id, detectado.nacional).replace(/\D/g, "") !== normalizarDigitos(valor)) {
    return "Revisa el teléfono: tiene más dígitos de los esperados.";
  }
  return validarNacional(detectado.pais, detectado.nacional) ?? (detectado.nacional ? null : "Ingresa el número de teléfono.");
}

function normalizarDigitos(valor: string): string {
  const texto = valor.trim();
  if (esInternacional(texto)) return digitosInternacionales(texto);
  // Valores chilenos antiguos: se comparan ya con el +56.
  const { pais, nacional } = detectarTelefono(texto);
  return soloDigitos(formatearTelefono(pais.id, nacional));
}

export function esTelefonoValido(valor: string): boolean {
  return Boolean(valor.trim()) && validarTelefono(valor) === null;
}

/** Formato canónico de un valor válido; si no es válido se devuelve recortado tal cual. */
export function normalizarTelefono(valor: string): string {
  const texto = valor.trim();
  if (!texto || validarTelefono(texto)) return texto;
  const { pais, nacional } = detectarTelefono(texto);
  return formatearTelefono(pais.id, nacional);
}

/** Descripción corta de un número válido para la opción elegida. */
export function describirTelefono(pais: PaisTelefono): string {
  if (pais.id === "CL") return "Celular chileno";
  if (esFijoChileno(pais)) return "Teléfono fijo chileno";
  return `Número de ${pais.nombre}`;
}
