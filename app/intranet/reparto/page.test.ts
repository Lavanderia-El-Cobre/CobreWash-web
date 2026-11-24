// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  acceso: true,
  panel: vi.fn(),
  salida: vi.fn(),
  retorno: vi.fn(),
  previa: vi.fn(),
  subir: vi.fn(),
}));

vi.mock("@/components/intranet/useRoleGuard", () => ({ useRoleGuard: () => mocks.acceso }));
vi.mock("@/components/intranet/AuthGuard", () => ({ useUsuarioActualContext: () => ({ id: "u-yo", nombre: "Ana", rol: { nombre: "repartidor" } }) }));
vi.mock("@/lib/firebase/client", () => ({ dataConnect: {}, auth: { currentUser: null } }));
vi.mock("@/lib/vehiculos/evidencias", () => ({
  subirEvidencia: (...a: unknown[]) => mocks.subir(...a),
  endpointEvidencia: () => null,
  cabeceraEvidencia: async () => ({}),
}));
vi.mock("@/src/dataconnect-generated", () => ({
  EstadoVehiculo: { APTO: "APTO", CON_OBSERVACIONES: "CON_OBSERVACIONES", NO_APTO: "NO_APTO" },
  getPanelRepartidor: (...a: unknown[]) => mocks.panel(...a),
  registrarSalidaFlota: (...a: unknown[]) => mocks.salida(...a),
  registrarRetornoFlota: (...a: unknown[]) => mocks.retorno(...a),
  getMovimientoFlotaPorInspeccion: (...a: unknown[]) => mocks.previa(...a),
}));

import RepartoPage from "./page";

const INSPECCION = "10000000-0000-4000-8000-000000000001";
const vehiculos = [
  { id: "v-libre", patente: "HLRT-24", marca: "Peugeot", modelo: "Partner", anio: 2023, descripcion: "Furgón ruta norte", enCurso: [], recientes: [{ inspecciones: [{ kilometraje: 12085 }] }] },
  { id: "v-ajeno", patente: "KLPW-88", marca: "Hyundai", modelo: "H-100", anio: 2022, descripcion: null, enCurso: [{ id: "s-x", estado: "EN_SERVICIO", fechaSalida: "2026-11-24T10:00:00Z", repartidor: { id: "otro", nombre: "Miguel", apellido: "Soto" } }], recientes: [] },
];
const salidaEnCurso = {
  id: "s-mia", estado: "EN_SERVICIO", fechaSalida: "2026-11-24T11:00:00Z", fechaRetorno: null, observaciones: "Hoteles centro", creadoEn: "2026-11-24T11:00:00Z",
  vehiculo: { id: "v-libre", patente: "HLRT-24", marca: "Peugeot", modelo: "Partner", anio: 2023, activo: true },
  inspecciones: [{ id: INSPECCION, momento: "ANTES", estadoVehiculo: "APTO", kilometraje: 12100, observaciones: null, registradoEn: "2026-11-24T11:00:00Z", fotos: [] }],
};

beforeEach(() => {
  mocks.acceso = true;
  mocks.panel.mockReset().mockResolvedValue({ data: { vehiculos, misSalidas: [] } });
  mocks.salida.mockReset().mockResolvedValue({ data: { salida: { id: "s-nueva" }, inspeccion: { id: INSPECCION } } });
  mocks.retorno.mockReset().mockResolvedValue({ data: { inspeccion: { id: INSPECCION } } });
  mocks.previa.mockReset().mockResolvedValue({ data: { inspeccionVehiculo: null } });
  mocks.subir.mockReset().mockResolvedValue("vehiculos/inspecciones/x/y.jpg");
  URL.createObjectURL = vi.fn(() => "blob:foto");
  URL.revokeObjectURL = vi.fn();
});
afterEach(cleanup);

describe("sección del repartidor: mi vehículo", () => {
  it("muestra los vehículos disponibles y bloquea el que otro tiene en ruta", async () => {
    render(createElement(RepartoPage));
    await screen.findByText("HLRT-24");
    const [libre, ajeno] = screen.getAllByRole("button", { name: /Registrar salida/ });
    expect((libre as HTMLButtonElement).disabled).toBe(false);
    expect((ajeno as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Lo tiene Miguel Soto")).toBeTruthy();
    expect(screen.getByText("Último registro: 12.085 km")).toBeTruthy();
  });

  it("registra la salida a su nombre con inspección, descripción y fotografía", async () => {
    render(createElement(RepartoPage));
    await screen.findByText("HLRT-24");
    fireEvent.click(screen.getAllByRole("button", { name: /Registrar salida/ })[0]);
    const dialogo = screen.getByRole("dialog");
    const km = within(dialogo).getByLabelText(/Kilometraje de salida/) as HTMLInputElement;
    expect(km.value).toBe("12085");

    // No apto bloquea la salida.
    fireEvent.click(within(dialogo).getByRole("button", { name: /No apto/ }));
    expect((within(dialogo).getByRole("button", { name: "Confirmar salida" }) as HTMLButtonElement).disabled).toBe(true);
    // Con observaciones exige describirlas.
    fireEvent.click(within(dialogo).getByRole("button", { name: /Con observaciones/ }));
    fireEvent.change(km, { target: { value: "12100,5" } });
    fireEvent.click(within(dialogo).getByRole("button", { name: "Confirmar salida" }));
    expect((await within(dialogo).findByRole("alert")).textContent).toMatch(/Describe/);
    expect(mocks.salida).not.toHaveBeenCalled();

    fireEvent.change(within(dialogo).getByLabelText(/Descripción del estado/), { target: { value: "Rayón puerta trasera" } });
    fireEvent.change(within(dialogo).getByLabelText(/Destino o ruta/), { target: { value: "Hoteles centro" } });
    fireEvent.change(within(dialogo).getByLabelText("Tomar fotografía con la cámara"), { target: { files: [new File(["jpeg"], "frontal.jpg", { type: "image/jpeg" })] } });
    const descripcion = await within(dialogo).findByLabelText("Descripción de la fotografía 1");
    fireEvent.change(descripcion, { target: { value: "Puerta trasera" } });
    fireEvent.click(within(dialogo).getByRole("button", { name: "Confirmar salida" }));

    await waitFor(() => expect(mocks.salida).toHaveBeenCalledWith({}, expect.objectContaining({
      vehiculoId: "v-libre",
      repartidorId: "u-yo",
      kilometraje: 12100.5,
      estadoVehiculo: "CON_OBSERVACIONES",
      observaciones: "Hoteles centro",
      observacionesInspeccion: "Rayón puerta trasera",
    })));
    await waitFor(() => expect(mocks.subir).toHaveBeenCalledWith(INSPECCION, expect.objectContaining({ descripcion: "Puerta trasera" }), 1));
    expect(await screen.findByText(/Salida de HLRT-24 registrada/)).toBeTruthy();
  });

  it("si falla una foto, el reintento no vuelve a registrar la salida", async () => {
    mocks.subir.mockRejectedValueOnce(new Error("Sin conexión"));
    render(createElement(RepartoPage));
    await screen.findByText("HLRT-24");
    fireEvent.click(screen.getAllByRole("button", { name: /Registrar salida/ })[0]);
    const dialogo = screen.getByRole("dialog");
    fireEvent.change(within(dialogo).getByLabelText("Elegir fotografías de la galería"), { target: { files: [new File(["jpeg"], "a.jpg", { type: "image/jpeg" })] } });
    await within(dialogo).findByLabelText("Descripción de la fotografía 1");
    fireEvent.click(within(dialogo).getByRole("button", { name: "Confirmar salida" }));
    expect((await within(dialogo).findByRole("alert")).textContent).toMatch(/ya se guardó.*Sin conexión/);

    mocks.previa.mockResolvedValue({ data: { inspeccionVehiculo: { id: INSPECCION } } });
    fireEvent.click(within(dialogo).getByRole("button", { name: "Reintentar fotografías" }));
    await waitFor(() => expect(mocks.subir).toHaveBeenCalledTimes(2));
    expect(mocks.salida).toHaveBeenCalledTimes(1);
    expect(mocks.subir.mock.calls[0][1].id).toBe(mocks.subir.mock.calls[1][1].id);
  });

  it("con una salida en curso solo ofrece registrar el regreso", async () => {
    mocks.panel.mockResolvedValue({ data: { vehiculos: [{ ...vehiculos[0], enCurso: [{ id: "s-mia", estado: "EN_SERVICIO", fechaSalida: "2026-11-24T11:00:00Z", repartidor: { id: "u-yo", nombre: "Ana", apellido: null } }] }], misSalidas: [salidaEnCurso] } });
    render(createElement(RepartoPage));
    await screen.findByText("En ruta");
    expect(screen.queryByRole("button", { name: /Registrar salida/ })).toBeNull();
    expect(screen.getByRole("link", { name: /Ir a entregas/ }).getAttribute("href")).toBe("/intranet/entregas");
    fireEvent.click(screen.getByRole("button", { name: /Registrar regreso/ }));
    const dialogo = screen.getByRole("dialog");
    expect((within(dialogo).getByLabelText(/Comentarios del recorrido/) as HTMLInputElement).value).toBe("Hoteles centro");
    fireEvent.change(within(dialogo).getByLabelText(/Kilometraje de regreso/), { target: { value: "12050" } });
    fireEvent.click(within(dialogo).getByRole("button", { name: "Confirmar regreso" }));
    expect((await within(dialogo).findByRole("alert")).textContent).toMatch(/no puede ser menor/);
    fireEvent.change(within(dialogo).getByLabelText(/Kilometraje de regreso/), { target: { value: "12180" } });
    fireEvent.click(within(dialogo).getByRole("button", { name: "Confirmar regreso" }));
    await waitFor(() => expect(mocks.retorno).toHaveBeenCalledWith({}, expect.objectContaining({
      salidaId: "s-mia", kilometraje: 12180, estadoVehiculo: "APTO", observacionesRetorno: "Hoteles centro", observacionesInspeccion: null,
    })));
    expect(await screen.findByText(/Regreso de HLRT-24 registrado \(\+80 km\)/)).toBeTruthy();
  });

  it("no renderiza nada para roles sin acceso", () => {
    mocks.acceso = false;
    const { container } = render(createElement(RepartoPage));
    expect(container.innerHTML).toBe("");
    expect(mocks.panel).not.toHaveBeenCalled();
  });
});
