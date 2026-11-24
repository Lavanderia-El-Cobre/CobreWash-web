import { describe, expect, it, vi } from "vitest";

vi.mock("@/src/dataconnect-generated", () => ({
  EstadoVehiculo: { APTO: "APTO", CON_OBSERVACIONES: "CON_OBSERVACIONES", NO_APTO: "NO_APTO" },
}));

import type { GetPanelRepartidorData } from "@/src/dataconnect-generated";
import { construirPanelReparto, kilometrajeActualVehiculo, validarFormMovimiento, type FormMovimiento } from "./reparto";
import { mapearErrorVehiculos } from "./flota";

const vehiculo = (id: string, extra: Record<string, unknown> = {}) => ({
  id, patente: id.toUpperCase(), marca: "Peugeot", modelo: "Partner", anio: 2023, descripcion: null,
  enCurso: [], recientes: [], ...extra,
});

const data = {
  vehiculos: [
    vehiculo("ajeno", { enCurso: [{ id: "s-ajena", estado: "EN_SERVICIO", fechaSalida: "2026-11-24T10:00:00Z", repartidor: { id: "otro", nombre: "Miguel", apellido: "Soto" } }] }),
    vehiculo("libre", { recientes: [{ inspecciones: [{ kilometraje: 1500.5 }] }, { inspecciones: [{ kilometraje: 900 }] }, { inspecciones: [] }] }),
    vehiculo("mio", { enCurso: [{ id: "s-mia", estado: "EN_SERVICIO", fechaSalida: "2026-11-24T09:00:00Z", repartidor: { id: "yo", nombre: "Ana", apellido: null } }] }),
  ],
  misSalidas: [
    { id: "s-mia", estado: "EN_SERVICIO", vehiculo: { id: "mio" }, inspecciones: [] },
    { id: "s-vieja", estado: "FINALIZADA", vehiculo: { id: "libre" }, inspecciones: [] },
  ],
} as unknown as GetPanelRepartidorData;

const form = (extra: Partial<FormMovimiento> = {}): FormMovimiento => ({
  tipo: "salida", vehiculoId: "libre", salidaId: "", patente: "LIBRE", kilometrajeMinimo: 1500,
  kilometraje: "1510", estadoVehiculo: "APTO" as FormMovimiento["estadoVehiculo"],
  observacionesInspeccion: "", observacionesRuta: "", fotos: [], ...extra,
});

describe("panel del repartidor", () => {
  it("ordena su vehículo, luego los disponibles y al final los que otro tiene en ruta", () => {
    const panel = construirPanelReparto(data, "yo");
    expect(panel.vehiculos.map((v) => [v.vehiculo.id, v.disponibilidad])).toEqual([["mio", "Contigo"], ["libre", "Disponible"], ["ajeno", "En ruta"]]);
    expect(panel.vehiculos[2].conductorActual).toBe("Miguel Soto");
    expect(panel.salidaEnCurso?.id).toBe("s-mia");
    expect(panel.historial.map((s) => s.id)).toEqual(["s-vieja"]);
  });

  it("toma el mayor kilometraje registrado como mínimo de la salida", () => {
    expect(kilometrajeActualVehiculo(data.vehiculos[1])).toBe(1500.5);
    expect(kilometrajeActualVehiculo(data.vehiculos[0])).toBe(0);
  });

  it("valida la salida y el regreso con las reglas de flota y pide descripción si hay observaciones", () => {
    expect(validarFormMovimiento(form(), "yo")).toBeNull();
    expect(validarFormMovimiento(form({ kilometraje: "1400" }), "yo")).toMatch(/no puede ser menor/);
    expect(validarFormMovimiento(form({ estadoVehiculo: "NO_APTO" as FormMovimiento["estadoVehiculo"] }), "yo")).toMatch(/NO APTO/);
    expect(validarFormMovimiento(form({ estadoVehiculo: "CON_OBSERVACIONES" as FormMovimiento["estadoVehiculo"] }), "yo")).toMatch(/Describe/);
    expect(validarFormMovimiento(form({ estadoVehiculo: "CON_OBSERVACIONES" as FormMovimiento["estadoVehiculo"], observacionesInspeccion: "Rayón" }), "yo")).toBeNull();
    expect(validarFormMovimiento(form({ tipo: "regreso", salidaId: "s-mia", kilometraje: "1499" }), "yo")).toMatch(/retorno/);
    expect(validarFormMovimiento(form({ tipo: "regreso", salidaId: "s-mia", kilometraje: "1600,5" }), "yo")).toBeNull();
    expect(validarFormMovimiento(form({ observacionesRuta: "x".repeat(301) }), "yo")).toMatch(/300/);
  });

  it("explica los rechazos propios del repartidor", () => {
    expect(mapearErrorVehiculos(new Error("Ya tienes un vehículo en ruta: registra su regreso antes de tomar otro"))).toMatch(/Ya tienes un vehículo en ruta/);
    expect(mapearErrorVehiculos(new Error("La salida no está registrada a tu nombre"))).toMatch(/a tu nombre/);
    expect(mapearErrorVehiculos(new Error("Solo administración o el propio repartidor pueden registrar la salida"))).toMatch(/permisos/);
  });
});
