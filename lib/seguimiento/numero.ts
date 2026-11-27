const ALFABETO = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * Genera un número de comanda con formato `ELCOBRE-XXXX` usando entropía
 * criptográfica (`crypto.getRandomValues`). El sufijo de cuatro caracteres
 * siempre contiene al menos una letra y un dígito.
 */
export function generarNumeroComanda(): string {
  for (;;) {
    const bytes = crypto.getRandomValues(new Uint8Array(4));
    // 252 es múltiplo de 36: descartar el resto evita el sesgo del módulo.
    if (bytes.some(byte => byte >= 252)) continue;
    const sufijo = Array.from(bytes, byte => ALFABETO[byte % ALFABETO.length]).join("");
    if (/[A-Z]/.test(sufijo) && /[0-9]/.test(sufijo)) return `ELCOBRE-${sufijo}`;
  }
}
