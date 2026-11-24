// @vitest-environment jsdom
import { createElement, useState } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import TelefonoInput from "./TelefonoInput";

afterEach(cleanup);

/** Formulario mínimo: etiqueta propia y valor controlado, como en el sitio. */
function montar(inicial = "", alCambiar = vi.fn()) {
  let fijarDesdeFuera: (valor: string) => void = () => undefined;
  function Formulario() {
    const [valor, setValor] = useState(inicial);
    fijarDesdeFuera = setValor;
    return createElement("div", null,
      createElement("label", { htmlFor: "tel" }, "Teléfono"),
      createElement(TelefonoInput, { id: "tel", value: valor, onChange: (v: string) => { setValor(v); alCambiar(v); } }),
      createElement("output", { "data-testid": "valor" }, valor),
    );
  }
  render(createElement(Formulario));
  return {
    alCambiar,
    campo: () => screen.getByLabelText("Teléfono") as HTMLInputElement,
    pais: () => screen.getByRole("combobox") as HTMLSelectElement,
    valor: () => screen.getByTestId("valor").textContent,
    fijarDesdeFuera: (v: string) => act(() => fijarDesdeFuera(v)),
  };
}

it("por defecto muestra +56 9 y guarda el celular chileno normalizado escribiendo solo 8 dígitos", () => {
  const f = montar();
  expect(f.pais().value).toBe("CL");
  expect(f.pais().getAttribute("aria-label")).toContain("+56 9");
  expect(screen.getByText("+56 9")).toBeTruthy();
  expect(f.campo().getAttribute("inputmode")).toBe("tel");
  expect(f.campo().type).toBe("tel");

  fireEvent.change(f.campo(), { target: { value: "12345678" } });
  expect(f.valor()).toBe("+56 9 1234 5678");
  expect(f.campo().value).toBe("1234 5678");
  expect(screen.getByText("Celular chileno")).toBeTruthy();
  expect(f.campo().getAttribute("aria-invalid")).toBeNull();
});

it("avisa los dígitos que faltan y marca el error al salir del campo", () => {
  const f = montar();
  fireEvent.change(f.campo(), { target: { value: "1234" } });
  expect(screen.getByText("Faltan 4 dígitos")).toBeTruthy();
  fireEvent.blur(f.campo());
  expect(f.campo().getAttribute("aria-invalid")).toBe("true");
  const mensaje = screen.getByText("El celular chileno debe tener 8 dígitos después de +56 9.");
  expect(f.campo().getAttribute("aria-describedby")).toBe(mensaje.id);
});

it("permite cambiar a otro país de Latinoamérica conservando lo escrito", () => {
  const f = montar();
  fireEvent.change(f.campo(), { target: { value: "91234567" } });
  fireEvent.change(f.pais(), { target: { value: "PE" } });
  expect(f.valor()).toBe("+51 91 234 567");
  expect(screen.getByText("+51")).toBeTruthy();
  expect(f.campo().placeholder).toBe("912 345 678");

  fireEvent.change(f.campo(), { target: { value: "912 345 678" } });
  expect(f.valor()).toBe("+51 912 345 678");
  expect(screen.getByText("Número de Perú")).toBeTruthy();
});

it("admite teléfonos fijos chilenos con su código de área", () => {
  const f = montar();
  fireEvent.change(f.pais(), { target: { value: "CL-FIJO" } });
  expect(f.alCambiar).not.toHaveBeenCalled();
  fireEvent.change(f.campo(), { target: { value: "552345678" } });
  expect(f.valor()).toBe("+56 55 234 5678");
  expect(f.campo().value).toBe("55 234 5678");
  expect(screen.getByText("Teléfono fijo chileno")).toBeTruthy();
});

it("al editar un valor guardado detecta el país desde su prefijo", () => {
  const f = montar("+593 99 123 4567");
  expect(f.pais().value).toBe("EC");
  expect(f.campo().value).toBe("99 123 4567");

  f.fijarDesdeFuera("+56 2 2345 6789");
  expect(f.pais().value).toBe("CL-FIJO");
  expect(f.campo().value).toBe("2 2345 6789");

  f.fijarDesdeFuera("");
  expect(f.pais().value).toBe("CL");
});

it("un número pegado con prefijo cambia el país y borrar un espacio borra el dígito anterior", () => {
  const f = montar();
  fireEvent.change(f.campo(), { target: { value: "+54 9 11 2345 6789" } });
  expect(f.pais().value).toBe("AR");
  expect(f.valor()).toBe("+54 9 11 2345 6789");

  f.fijarDesdeFuera("+56 9 1234 5678");
  // "1234 5678" → se borra el espacio con el cursor tras él: se quita el 4.
  const campo = f.campo();
  Object.defineProperty(campo, "selectionStart", { configurable: true, get: () => 4 });
  fireEvent.change(campo, { target: { value: "12345678" } });
  expect(f.valor()).toBe("+56 9 1235 678");
});
