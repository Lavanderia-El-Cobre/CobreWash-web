// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  acceso: true,
  consultar: vi.fn(),
  entregar: vi.fn(),
  reportar: vi.fn(),
}));

vi.mock("@/components/intranet/useRoleGuard", () => ({ useRoleGuard: () => mocks.acceso }));
vi.mock("@/lib/firebase/client", () => ({ dataConnect: {} }));
vi.mock("@/src/dataconnect-generated", () => ({
  getComandasParaEntrega: (...a: unknown[]) => mocks.consultar(...a),
  entregarComanda: (...a: unknown[]) => mocks.entregar(...a),
  reportarProblemaEntrega: (...a: unknown[]) => mocks.reportar(...a),
}));

import EntregasPage from "./page";

const comanda = {
  id: "c-1",
  numeroComanda: "ELCOBRE-0101",
  empresa: "Minera Norte",
  proyecto: "Campamento",
  observaciones: "Entregar en portería",
  fechaEntregaEstimada: "2026-01-01T12:00:00Z",
  cliente: { nombre: "Hotel Atacama", tipoCliente: "HOTEL", telefono: "+56 9 1111 2222", direccion: "Av. Balmaceda 100" },
  prendas: [{ cantidad: 4, tipoPrenda: { nombre: "SÁBANA" } }],
  problemas: [{ id: "p-1", motivo: "Entrega: Cliente ausente", descripcion: "Portón cerrado", estado: "ABIERTA", fecha: "2026-11-23T15:00:00Z", reportadaPor: { nombre: "Ana", apellido: "Rojas" } }],
};
const datos = (comandas = [comanda]) => ({
  data: {
    comandas,
    misEntregas: [{ id: "h-1", fecha: "2026-11-22T15:00:00Z", motivo: "Entrega a cliente: Recibió Juan", comanda: { id: "c-0", numeroComanda: "ELCOBRE-0099", cliente: { nombre: "Juan Pérez" } } }],
  },
});

beforeEach(() => {
  mocks.acceso = true;
  mocks.consultar.mockReset().mockResolvedValue(datos());
  mocks.entregar.mockReset().mockResolvedValue({ data: {} });
  mocks.reportar.mockReset().mockResolvedValue({ data: {} });
});
afterEach(cleanup);

describe("entregas del repartidor", () => {
  it("lista las comandas listas con contacto, prendas, atraso y problemas abiertos", async () => {
    render(createElement(EntregasPage));
    await screen.findByText("Hotel Atacama");
    expect(mocks.consultar).toHaveBeenCalledWith({}, { limit: 50, offset: 0 }, { fetchPolicy: "SERVER_ONLY" });
    expect(screen.getByText("Av. Balmaceda 100")).toBeTruthy();
    expect(screen.getByRole("link", { name: "+56 9 1111 2222" }).getAttribute("href")).toBe("tel:+56911112222");
    expect(screen.getByText("4 prendas · SÁBANA ×4")).toBeTruthy();
    expect(screen.getByText(/Atrasada/)).toBeTruthy();
    expect(within(screen.getByRole("list", { name: "Problemas de entrega abiertos" })).getByText("Cliente ausente")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Mis entregas" }));
    expect(screen.getByText("ELCOBRE-0099 · Juan Pérez")).toBeTruthy();
    expect(screen.getByText("Recibió Juan")).toBeTruthy();
  });

  it("marca la entrega con el detalle opcional normalizado y la quita de la lista", async () => {
    render(createElement(EntregasPage));
    fireEvent.click(await screen.findByRole("button", { name: /Marcar entregada/ }));
    const dialogo = screen.getByRole("dialog");
    fireEvent.change(within(dialogo).getByLabelText(/Detalle de la entrega/), { target: { value: "  Recibió   María  " } });
    mocks.consultar.mockResolvedValue(datos([]));
    fireEvent.click(within(dialogo).getByRole("button", { name: "Marcar entregada" }));
    await waitFor(() => expect(mocks.entregar).toHaveBeenCalledWith({}, { id: "c-1", detalle: "Recibió María" }));
    expect(await screen.findByText("Comanda ELCOBRE-0101 marcada como entregada.")).toBeTruthy();
    await waitFor(() => expect(screen.queryByText("Hotel Atacama")).toBeNull());
  });

  it("sin detalle envía null y muestra el error del servidor si ya fue entregada", async () => {
    mocks.entregar.mockRejectedValue(new Error("Solo se puede entregar una comanda finalizada"));
    render(createElement(EntregasPage));
    fireEvent.click(await screen.findByRole("button", { name: /Marcar entregada/ }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Marcar entregada" }));
    await waitFor(() => expect(mocks.entregar).toHaveBeenCalledWith({}, { id: "c-1", detalle: null }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/ya no está pendiente/);
  });

  it("reporta un problema sin cerrar la comanda y exige detalle para Otro", async () => {
    render(createElement(EntregasPage));
    fireEvent.click(await screen.findByRole("button", { name: /Reportar problema/ }));
    const dialogo = screen.getByRole("dialog");
    fireEvent.click(within(dialogo).getByRole("button", { name: /Motivo del problema/ }));
    fireEvent.click(within(await screen.findByRole("option", { name: "Otro" })).getByRole("button"));
    fireEvent.click(within(dialogo).getByRole("button", { name: "Registrar problema" }));
    expect((await within(dialogo).findByRole("alert")).textContent).toMatch(/Describe/);
    expect(mocks.reportar).not.toHaveBeenCalled();

    fireEvent.change(within(dialogo).getByLabelText(/Detalle/), { target: { value: "Perro suelto en la entrada" } });
    fireEvent.click(within(dialogo).getByRole("button", { name: "Registrar problema" }));
    await waitFor(() => expect(mocks.reportar).toHaveBeenCalledWith({}, { comandaId: "c-1", motivo: "Otro", detalle: "Perro suelto en la entrada" }));
    expect(await screen.findByText(/La comanda sigue pendiente de entrega/)).toBeTruthy();
    expect(screen.getByText("Hotel Atacama")).toBeTruthy();
  });
});
