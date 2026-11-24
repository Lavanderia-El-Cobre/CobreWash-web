import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ previa: vi.fn(), subir: vi.fn(), dc: {} }));
vi.mock("@/src/dataconnect-generated", () => ({ getMovimientoFlotaPorInspeccion: mocks.previa }));
vi.mock("@/lib/firebase/client", () => ({ dataConnect: mocks.dc }));
vi.mock("./evidencias", () => ({ subirEvidencia: mocks.subir }));

import { confirmarMovimientoFlota, subirEvidenciasInspeccion } from "./movimientos";

const ID = "10000000-0000-4000-8000-000000000001";

beforeEach(() => {
  mocks.previa.mockReset().mockResolvedValue({ data: { inspeccionVehiculo: null } });
  mocks.subir.mockReset().mockImplementation(async (_i: string, f: { id: string }) => `ruta/${f.id}`);
});

describe("movimientos de flota", () => {
  it("registra el movimiento cuando no existe y devuelve el ID de la inspección", async () => {
    const registrar = vi.fn().mockResolvedValue({ data: { inspeccion: { id: ID.replaceAll("-", "") } } });
    await expect(confirmarMovimientoFlota(ID, registrar)).resolves.toBe(ID);
    expect(mocks.previa).toHaveBeenCalledWith(mocks.dc, { id: ID }, { fetchPolicy: "SERVER_ONLY" });
    expect(registrar).toHaveBeenCalledTimes(1);
  });

  it("no lo vuelve a registrar si una respuesta anterior se perdió", async () => {
    mocks.previa.mockResolvedValue({ data: { inspeccionVehiculo: { id: ID } } });
    const registrar = vi.fn();
    await expect(confirmarMovimientoFlota(ID, registrar)).resolves.toBe(ID);
    expect(registrar).not.toHaveBeenCalled();
  });

  it("sube las fotos en orden con su ID estable y se detiene en el primer fallo", async () => {
    const fotos = ["a", "b", "c"].map((id) => ({ id, rutaStorage: "", descripcion: id }));
    const guardadas: string[] = [];
    mocks.subir.mockImplementation(async (_i: string, f: { id: string }) => { if (f.id === "c") throw new Error("sin red"); return `ruta/${f.id}`; });
    await expect(subirEvidenciasInspeccion(ID, fotos, (_f, ruta) => guardadas.push(ruta))).rejects.toThrow("sin red");
    expect(mocks.subir.mock.calls.map((c) => [c[1].id, c[2]])).toEqual([["a", 1], ["b", 2], ["c", 3]]);
    expect(guardadas).toEqual(["ruta/a", "ruta/b"]);
  });
});
