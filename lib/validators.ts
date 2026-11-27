/** Elimina puntos, guiones y espacios de un RUT y normaliza la letra `K` en mayúscula. */
export function cleanRut(value: string): string {
  return value.replace(/[^0-9kK]/g, "").toUpperCase();
}

// Algoritmo chileno de módulo 11 con multiplicadores cíclicos 2..7 de derecha a izquierda.
function computeCheckDigit(body: string): string {
  let sum = 0;
  let multiplier = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i], 10) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }
  const remainder = 11 - (sum % 11);
  if (remainder === 11) return "0";
  if (remainder === 10) return "K";
  return String(remainder);
}

/** Formatea un RUT chileno con separadores de miles y guion (`12.345.678-K`), acotado a 9 caracteres. */
export function formatRut(value: string): string {
  const clean = cleanRut(value).slice(0, 9);
  if (!clean) return "";
  if (clean.length === 1) return clean;

  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  const reversedDigits = body.split("").reverse();
  const groupedReversed = reversedDigits.reduce<string[]>((acc, digit, idx) => {
    if (idx > 0 && idx % 3 === 0) acc.push(".");
    acc.push(digit);
    return acc;
  }, []);

  return `${groupedReversed.reverse().join("")}-${dv}`;
}

/** Valida que el RUT tenga cuerpo numérico y dígito verificador correcto según módulo 11. */
export function isValidRut(value: string): boolean {
  const clean = cleanRut(value);
  if (clean.length < 2) return false;

  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  if (!/^\d+$/.test(body)) return false;

  return computeCheckDigit(body) === dv;
}

// Códigos de área fijos vigentes en Chile (sin el prefijo 0 ni código de país +56).
const CHILEAN_FIXED_AREA_CODES = new Set([
  "2", "32", "33", "34", "35", "41", "42", "43", "44", "45",
  "51", "52", "53", "55", "57", "58", "61", "63", "64", "65",
  "67", "71", "72", "73", "75",
]);

/** Devuelve los nueve dígitos nacionales, sin +56 ni prefijo de carrier. */
export function cleanChileanPhone(value: string): string {
  let digits = value.replace(/\D/g, "");
  const explicitCountryCode = /^\s*\+?56(?:\s|[-()])/.test(value) || value.trimStart().startsWith("+56");

  if ((explicitCountryCode || digits.length >= 10) && digits.startsWith("56")) {
    digits = digits.slice(2);
  }
  if (digits.length >= 10 && digits.startsWith("0")) digits = digits.slice(1);

  return digits.slice(0, 9);
}

/** Clasificación de un número telefónico chileno válido, o `null` si no cumple el formato nacional. */
export type ChileanPhoneType = "Celular" | "Teléfono fijo" | null;

/** Clasifica un teléfono chileno de 9 dígitos como celular (`9…`) o fijo (Santiago `2…` o regiones). */
export function getChileanPhoneType(value: string): ChileanPhoneType {
  const digits = cleanChileanPhone(value);
  if (digits.length !== 9) return null;
  if (digits.startsWith("9")) return "Celular";
  if (digits.startsWith("2")) return "Teléfono fijo";
  return CHILEAN_FIXED_AREA_CODES.has(digits.slice(0, 2)) ? "Teléfono fijo" : null;
}

/** Indica si el valor corresponde a un celular o teléfono fijo chileno válido. */
export function isValidChileanPhone(value: string): boolean {
  return getChileanPhoneType(value) !== null;
}

/** Formatea celulares y teléfonos fijos chilenos mientras se escribe. */
export function formatChileanPhone(value: string): string {
  const digits = cleanChileanPhone(value);
  if (!digits) return "";

  if (digits.startsWith("9")) {
    const first = digits.slice(0, 1);
    const middle = digits.slice(1, 5);
    const last = digits.slice(5, 9);
    return [`+56 ${first}`, middle, last].filter(Boolean).join(" ");
  }

  if (digits.startsWith("2")) {
    const area = digits.slice(0, 1);
    const middle = digits.slice(1, 5);
    const last = digits.slice(5, 9);
    return [`+56 ${area}`, middle, last].filter(Boolean).join(" ");
  }

  const area = digits.slice(0, Math.min(2, digits.length));
  const middle = digits.slice(2, 5);
  const last = digits.slice(5, 9);
  return [`+56 ${area}`, middle, last].filter(Boolean).join(" ");
}

/** Resultado de validar la política mínima de complejidad de una contraseña. */
export interface PasswordCheck {
  valid: boolean;
  message: string;
}

/** Valida que la contraseña tenga al menos 8 caracteres, una letra y un dígito. */
export function validatePassword(password: string): PasswordCheck {
  if (password.length < 8) return { valid: false, message: "Mínimo 8 caracteres" };
  if (!/[a-zA-Z]/.test(password)) return { valid: false, message: "Debe incluir al menos una letra" };
  if (!/[0-9]/.test(password)) return { valid: false, message: "Debe incluir al menos un número" };
  return { valid: true, message: "Contraseña válida" };
}
