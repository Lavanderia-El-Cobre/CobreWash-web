// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import GlassSelect from "./GlassSelect";
import { normalizarPrendaNueva } from "@/lib/comandas/cobro";

afterEach(cleanup);

function abrir(onChange = vi.fn()) {
  render(createElement(GlassSelect, {
    value: "CAMISA", onChange, ariaLabel: "Tipo de prenda",
    options: [{ value: "CAMISA", label: "CAMISA" }, { value: "PANTALÓN", label: "PANTALÓN" }],
    nuevaOpcion: { placeholder: "Escribir otra prenda…", normalizar: normalizarPrendaNueva },
  }));
  fireEvent.click(screen.getByRole("button", { name: "Tipo de prenda" }));
  return onChange;
}

it("permite escribir una prenda que no está en la lista y la entrega en mayúsculas", () => {
  const onChange = abrir();
  const campo = screen.getByPlaceholderText("Escribir otra prenda…");
  expect((screen.getByRole("button", { name: "Agregar a la lista" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(campo, { target: { value: "  overol térmico " } });
  fireEvent.submit(campo.closest("form")!);
  expect(onChange).toHaveBeenCalledWith("OVEROL TÉRMICO");
});

it("si lo escrito ya existe elige esa opción en vez de duplicarla", () => {
  const onChange = abrir();
  const campo = screen.getByPlaceholderText("Escribir otra prenda…");
  fireEvent.change(campo, { target: { value: "pantalon" } });
  fireEvent.submit(campo.closest("form")!);
  expect(onChange).toHaveBeenCalledWith("PANTALÓN");
});
