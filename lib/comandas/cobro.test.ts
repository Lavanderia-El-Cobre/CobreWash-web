import { describe, expect, it } from "vitest";
import { leerPrecioKg, normalizarPrendaNueva, opcionesPrendas, subtotalesPorKg, totalPorKg } from "./cobro";
import { repartirPeso } from "@/lib/ia/comanda";

describe("cobro por kg", () => {
  it("el total es el peso por el precio, redondeado al peso", () => {
    expect(totalPorKg(12.5, 2500)).toBe(31250);
    expect(totalPorKg(3.33, 2510)).toBe(8358);
  });

  it("los subtotales de las líneas suman exactamente el total y no se alejan más de $1", () => {
    for (const [peso, cantidades, precio] of [[10, [1, 1, 1], 2333], [7.77, [3, 2, 5, 1], 2490], [0.35, [1, 1], 3900]] as const) {
      const pesos = repartirPeso(peso, [...cantidades]);
      const subtotales = subtotalesPorKg(pesos, precio);
      expect(subtotales.reduce((s, v) => s + v, 0)).toBe(totalPorKg(peso, precio));
      subtotales.forEach((v, i) => {
        expect(Number.isInteger(v)).toBe(true);
        expect(Math.abs(v - pesos[i] * precio)).toBeLessThanOrEqual(1);
      });
    }
  });

  it("lee precios escritos con puntos de miles o signo peso", () => {
    expect(leerPrecioKg("2.500")).toBe(2500);
    expect(leerPrecioKg("$ 3500")).toBe(3500);
    expect(leerPrecioKg("0")).toBeNull();
    expect(leerPrecioKg("abc")).toBeNull();
    expect(leerPrecioKg("")).toBeNull();
  });
});

describe("prendas escritas a mano", () => {
  it("quedan en mayúsculas, con tildes y sin espacios de más", () => {
    expect(normalizarPrendaNueva("  overol   térmico ")).toBe("OVEROL TÉRMICO");
    expect(normalizarPrendaNueva("piñata")).toBe("PIÑATA");
    expect(normalizarPrendaNueva("x".repeat(80))).toHaveLength(60);
  });

  it("se suman al catálogo base sin repetir nombres equivalentes", () => {
    expect(opcionesPrendas(["CAMISA", "PANTALÓN"], ["Overol", "pantalon", "OVEROL"], ["chaleco "])).toEqual(["CAMISA", "PANTALÓN", "OVEROL", "CHALECO"]);
  });
});
