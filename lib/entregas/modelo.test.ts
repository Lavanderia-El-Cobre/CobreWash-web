import { describe, expect, it } from "vitest";
import {
  filtrarComandasEntrega,
  mapearErrorEntrega,
  motivoVisible,
  normalizarDetalle,
  problemasAbiertos,
  resumirPrendas,
  validarEntrega,
  validarProblemaEntrega,
  type ComandaParaEntrega,
} from "./modelo";

const comanda = (extra: Partial<ComandaParaEntrega> = {}): ComandaParaEntrega => ({
  id: "c1",
  numeroComanda: "ELCOBRE-001",
  empresa: "Codelco",
  proyecto: null,
  observaciones: null,
  fechaEntregaEstimada: null,
  cliente: { nombre: "Hotel Diego de Almagro", tipoCliente: "HOTEL", telefono: "+56 9 1234 5678", direccion: "Av. Granaderos 1500" },
  prendas: [],
  problemas: [],
  ...extra,
} as ComandaParaEntrega);

describe("entregas del repartidor", () => {
  it("normaliza el detalle opcional y lo limita", () => {
    expect(normalizarDetalle("   ")).toBeNull();
    expect(normalizarDetalle("  Recibió\n  María ")).toBe("Recibió María");
    expect(validarEntrega("")).toBeNull();
    expect(validarEntrega("x".repeat(280))).toBeNull();
    expect(validarEntrega("x".repeat(281))).toMatch(/280/);
  });

  it("exige un motivo de la lista y detalle cuando el motivo es Otro", () => {
    expect(validarProblemaEntrega("Cliente ausente", "")).toBeNull();
    expect(validarProblemaEntrega("Inventado", "")).toMatch(/motivo/);
    expect(validarProblemaEntrega("Otro", "  ")).toMatch(/Describe/);
    expect(validarProblemaEntrega("Otro", "Portón cerrado")).toBeNull();
    expect(validarProblemaEntrega("Dirección errónea", "x".repeat(251))).toMatch(/250/);
  });

  it("resume las prendas por tipo", () => {
    expect(resumirPrendas([])).toBe("Sin prendas registradas");
    expect(resumirPrendas([
      { cantidad: 2, tipoPrenda: { nombre: "CAMISA" } },
      { cantidad: 1, tipoPrenda: { nombre: "SÁBANA" } },
      { cantidad: 3, tipoPrenda: { nombre: "CAMISA" } },
    ])).toBe("6 prendas · CAMISA ×5, SÁBANA ×1");
    expect(resumirPrendas([{ cantidad: 1, tipoPrenda: { nombre: "TOALLA" } }])).toBe("1 prenda · TOALLA ×1");
  });

  it("muestra solo los problemas de entrega abiertos y sin el prefijo técnico", () => {
    const c = comanda({ problemas: [
      { id: "p1", motivo: "Entrega: Cliente ausente", descripcion: null, estado: "ABIERTA", fecha: "2026-11-24T12:00:00Z", reportadaPor: { nombre: "Ana", apellido: null } },
      { id: "p2", motivo: "Entrega: Dirección errónea", descripcion: null, estado: "RESUELTA", fecha: "2026-11-23T12:00:00Z", reportadaPor: { nombre: "Ana", apellido: null } },
    ] as ComandaParaEntrega["problemas"] });
    expect(problemasAbiertos(c).map((p) => p.id)).toEqual(["p1"]);
    expect(motivoVisible("Entrega: Cliente ausente")).toBe("Cliente ausente");
  });

  it("busca por número, cliente, dirección o empresa sin distinguir tildes", () => {
    const lista = [comanda(), comanda({ id: "c2", numeroComanda: "ELCOBRE-002", empresa: null, cliente: { nombre: "Juan Pérez", tipoCliente: "PARTICULAR" as ComandaParaEntrega["cliente"]["tipoCliente"], telefono: null, direccion: "Pasaje Ñandú 12" } })];
    expect(filtrarComandasEntrega(lista, "").length).toBe(2);
    expect(filtrarComandasEntrega(lista, "perez").map((c) => c.id)).toEqual(["c2"]);
    expect(filtrarComandasEntrega(lista, "granaderos").map((c) => c.id)).toEqual(["c1"]);
    expect(filtrarComandasEntrega(lista, "002").map((c) => c.id)).toEqual(["c2"]);
    expect(filtrarComandasEntrega(lista, "codelco").map((c) => c.id)).toEqual(["c1"]);
  });

  it("traduce los errores del servidor a mensajes para terreno", () => {
    expect(mapearErrorEntrega(new Error("Solo se puede entregar una comanda finalizada"))).toMatch(/ya no está pendiente/);
    expect(mapearErrorEntrega(new Error("Solo se pueden reportar problemas de comandas listas para entregar"))).toMatch(/ya no está pendiente/);
    expect(mapearErrorEntrega(new Error("No autorizado para entregar comandas"))).toMatch(/permisos/);
    expect(mapearErrorEntrega(new Error("El detalle de la entrega no puede superar los 280 caracteres"))).toMatch(/detalle/);
    expect(mapearErrorEntrega(new Error("fetch failed"))).toMatch(/conexión/);
  });
});
