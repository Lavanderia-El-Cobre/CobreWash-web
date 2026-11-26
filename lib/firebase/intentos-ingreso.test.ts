import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  duracionBloqueo, estadoIntentos, formatoEspera, INTENTOS_LIBRES, limpiarIntentosIngreso, registrarFalloIngreso,
} from "./intentos-ingreso";

const INCORRECTA = { code: "auth/invalid-credential" };
const T0 = Date.parse("2026-11-26T12:00:00Z");

beforeEach(() => {
  const datos = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => datos.get(k) ?? null,
    setItem: (k: string, v: string) => { datos.set(k, v); },
    removeItem: (k: string) => { datos.delete(k); },
  });
});

describe("bloqueo progresivo del ingreso", () => {
  it("permite los primeros intentos y avisa cuántos quedan", () => {
    for (let i = 1; i < INTENTOS_LIBRES; i++) {
      expect(registrarFalloIngreso(INCORRECTA, T0 + i)).toEqual({ bloqueadoHasta: null, restantes: INTENTOS_LIBRES - i });
    }
  });

  it("bloquea al llegar al límite y duplica la espera en cada fallo, hasta 15 minutos", () => {
    let t = T0;
    for (let i = 1; i < INTENTOS_LIBRES; i++) registrarFalloIngreso(INCORRECTA, t);
    expect(registrarFalloIngreso(INCORRECTA, t).bloqueadoHasta).toBe(t + 30_000);
    expect(estadoIntentos(t + 29_000).bloqueadoHasta).toBe(t + 30_000);
    expect(estadoIntentos(t + 30_000).bloqueadoHasta).toBeNull();
    t += 30_000;
    expect(registrarFalloIngreso(INCORRECTA, t).bloqueadoHasta).toBe(t + 60_000);
    expect(duracionBloqueo(INTENTOS_LIBRES + 2)).toBe(120_000);
    expect(duracionBloqueo(INTENTOS_LIBRES + 20)).toBe(15 * 60_000);
  });

  it("respeta el bloqueo del servidor de Firebase", () => {
    expect(registrarFalloIngreso({ code: "auth/too-many-requests" }, T0).bloqueadoHasta).toBe(T0 + 5 * 60_000);
  });

  it("los errores de red no cuentan como intento", () => {
    expect(registrarFalloIngreso({ code: "auth/network-request-failed" }, T0)).toEqual({ bloqueadoHasta: null, restantes: INTENTOS_LIBRES });
  });

  it("se reinicia al ingresar bien o tras una hora sin fallos", () => {
    registrarFalloIngreso(INCORRECTA, T0);
    registrarFalloIngreso(INCORRECTA, T0);
    expect(estadoIntentos(T0 + 61 * 60_000).restantes).toBe(INTENTOS_LIBRES);
    limpiarIntentosIngreso();
    expect(estadoIntentos(T0).restantes).toBe(INTENTOS_LIBRES);
  });

  it("no guarda el correo ni la contraseña", () => {
    registrarFalloIngreso(INCORRECTA, T0);
    const guardado = JSON.stringify((localStorage.getItem as (k: string) => string | null)("cobre:intentos-ingreso"));
    expect(guardado).not.toMatch(/@|clave/);
  });

  it("muestra la espera en segundos o minutos", () => {
    expect(formatoEspera(30_000)).toBe("30 s");
    expect(formatoEspera(65_000)).toBe("1:05 min");
  });
});
