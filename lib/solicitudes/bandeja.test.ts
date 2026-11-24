import { describe, expect, it, vi } from "vitest";
vi.mock("@/src/dataconnect-generated", () => ({}));
import { variablesBandeja } from "./bandeja";

describe("variables de la bandeja de cotizaciones", () => {
  it("omite el estado al mostrar todas las solicitudes", () => {
    const variables = variablesBandeja(null, 0);
    expect(JSON.parse(JSON.stringify(variables))).toEqual({ offset: 0, limit: 20 });
    expect(variables).not.toHaveProperty("estado");
  });
  it("filtra por estado y pagina de a 20", () => {
    expect(variablesBandeja("ATENDIDA" as never, 2)).toEqual({ estado: "ATENDIDA", offset: 40, limit: 20 });
  });
});
