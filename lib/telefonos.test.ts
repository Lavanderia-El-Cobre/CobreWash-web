import { describe, expect, it } from "vitest";
import {
  PAISES_TELEFONO,
  detectarTelefono,
  esTelefonoValido,
  extraerNacional,
  formatearNacional,
  formatearTelefono,
  interpretarEntrada,
  normalizarTelefono,
  obtenerPaisTelefono,
  validarNacional,
  validarTelefono,
} from "@/lib/telefonos";
import { formatChileanPhone, isValidChileanPhone } from "@/lib/validators";

const pais = obtenerPaisTelefono;

describe("formato por país", () => {
  it("Chile celular queda igual que formatChileanPhone", () => {
    expect(formatearTelefono("CL", "12345678")).toBe("+56 9 1234 5678");
    expect(formatearTelefono("CL", "12345678")).toBe(formatChileanPhone("912345678"));
    expect(formatearTelefono("CL", "123")).toBe("+56 9 123");
    expect(formatearNacional(pais("CL"), "12345678")).toBe("1234 5678");
  });

  it("Chile fijo usa el formato de formatChileanPhone", () => {
    expect(formatearTelefono("CL-FIJO", "552345678")).toBe("+56 55 234 5678");
    expect(formatearTelefono("CL-FIJO", "223456789")).toBe("+56 2 2345 6789");
    expect(formatearNacional(pais("CL-FIJO"), "552345678")).toBe("55 234 5678");
  });

  it.each([
    ["AR", "1123456789", "+54 11 2345 6789"],
    ["AR", "91123456789", "+54 9 11 2345 6789"],
    ["BO", "71234567", "+591 7123 4567"],
    ["BR", "11912345678", "+55 11 91234 5678"],
    ["BR", "1123456789", "+55 11 2345 6789"],
    ["CO", "3001234567", "+57 300 123 4567"],
    ["EC", "991234567", "+593 99 123 4567"],
    ["MX", "5512345678", "+52 55 1234 5678"],
    ["PA", "61234567", "+507 6123 4567"],
    ["PE", "912345678", "+51 912 345 678"],
    ["PY", "981123456", "+595 981 123 456"],
    ["UY", "94123456", "+598 94 123 456"],
    ["VE", "4121234567", "+58 412 123 4567"],
    ["DO", "8091234567", "+1 809 123 4567"],
    ["GT", "51234567", "+502 5123 4567"],
  ])("%s %s → %s", (id, nacional, esperado) => {
    expect(formatearTelefono(id, nacional)).toBe(esperado);
    expect(validarTelefono(esperado)).toBeNull();
  });

  it("recorta lo que excede el largo máximo y devuelve vacío sin dígitos", () => {
    expect(formatearTelefono("CL", "123456789999")).toBe("+56 9 1234 5678");
    expect(formatearTelefono("PE", "")).toBe("");
  });

  it("incluye los países pedidos de Latinoamérica", () => {
    const ids = PAISES_TELEFONO.map((p) => p.id);
    for (const id of ["AR", "BO", "PE", "CO", "EC", "PY", "UY", "VE", "BR", "MX", "GT", "SV", "HN", "NI", "CR", "PA", "CU", "DO", "PR"]) {
      expect(ids).toContain(id);
    }
  });
});

describe("detección del país desde el valor guardado", () => {
  it.each([
    ["+56 9 1234 5678", "CL", "12345678"],
    ["+56912345678", "CL", "12345678"],
    ["912345678", "CL", "12345678"],
    ["56912345678", "CL", "12345678"],
    ["+56 55 234 5678", "CL-FIJO", "552345678"],
    ["223456789", "CL-FIJO", "223456789"],
    ["+51 912 345 678", "PE", "912345678"],
    ["+591 7123 4567", "BO", "71234567"],
    ["+593 99 123 4567", "EC", "991234567"],
    ["0054 11 2345 6789", "AR", "1123456789"],
    ["+1 787 123 4567", "PR", "7871234567"],
    ["+1 809 123 4567", "DO", "8091234567"],
  ])("%s → %s", (valor, id, nacional) => {
    expect(detectarTelefono(valor)).toMatchObject({ pais: { id }, nacional, reconocido: true });
  });

  it("vacío usa Chile celular y un prefijo ajeno queda sin reconocer", () => {
    expect(detectarTelefono("")).toMatchObject({ pais: { id: "CL" }, nacional: "" });
    expect(detectarTelefono("+44 20 7946 0958").reconocido).toBe(false);
  });

  it("lee el número según la opción elegida cuando comparten código", () => {
    expect(extraerNacional(pais("CL-FIJO"), "+56 9 1234 5678")).toBe("912345678");
    expect(extraerNacional(pais("PR"), "+1 809 123 4567")).toBe("8091234567");
    expect(extraerNacional(pais("PE"), "")).toBe("");
  });
});

describe("entrada del usuario", () => {
  it("quita el código o el 9 del celular si se pegan junto al número", () => {
    expect(interpretarEntrada(pais("CL"), "912345678").nacional).toBe("12345678");
    expect(interpretarEntrada(pais("CL"), "56912345678").nacional).toBe("12345678");
    expect(interpretarEntrada(pais("PE"), "51912345678").nacional).toBe("912345678");
    expect(interpretarEntrada(pais("CL"), "1234 56")).toMatchObject({ nacional: "123456" });
  });

  it("un número pegado con + cambia de país", () => {
    expect(interpretarEntrada(pais("CL"), "+51 912 345 678")).toMatchObject({ pais: { id: "PE" }, nacional: "912345678" });
  });
});

describe("validación", () => {
  it("mensajes claros por país", () => {
    expect(validarNacional(pais("CL"), "1234")).toBe("El celular chileno debe tener 8 dígitos después de +56 9.");
    expect(validarNacional(pais("CL-FIJO"), "912345678")).toMatch(/no empiezan con 9/);
    expect(validarNacional(pais("CL-FIJO"), "881234567")).toMatch(/fijo chileno válido/);
    expect(validarNacional(pais("PE"), "9123")).toBe("El número de Perú debe tener 8 o 9 dígitos después de +51.");
    expect(validarNacional(pais("PA"), "123")).toBe("El número de Panamá debe tener 7 u 8 dígitos después de +507.");
    expect(validarNacional(pais("DO"), "7871234567")).toMatch(/República Dominicana/);
    expect(validarNacional(pais("CO"), "")).toBeNull();
  });

  it("valida valores completos, antiguos e internacionales", () => {
    expect(esTelefonoValido("+56 9 8765 4321")).toBe(true);
    expect(esTelefonoValido("+56 41 234 5678")).toBe(true);
    expect(esTelefonoValido("987654321")).toBe(true);
    expect(esTelefonoValido("+56 9 1234")).toBe(false);
    expect(esTelefonoValido("+56 88 123 4567")).toBe(false);
    expect(esTelefonoValido("+51 912 345 678")).toBe(true);
    expect(esTelefonoValido("+51 912 345 6789")).toBe(false);
    expect(esTelefonoValido("123")).toBe(false);
    expect(esTelefonoValido("")).toBe(false);
    expect(validarTelefono("")).toBeNull();
    expect(validarTelefono("+44 20 7946 0958")).toMatch(/Latinoamérica/);
  });

  it("coincide con isValidChileanPhone para números chilenos", () => {
    for (const valor of ["+56 9 8765 4321", "+56 2 2345 6789", "+56 55 234 5678", "+56 9 1234", "+56 88 123 4567", "+56 41 234 5678"]) {
      expect(esTelefonoValido(valor)).toBe(isValidChileanPhone(valor));
    }
  });

  it("normaliza al formato canónico y deja intactos los inválidos", () => {
    expect(normalizarTelefono(" +56912345678 ")).toBe("+56 9 1234 5678");
    expect(normalizarTelefono("+51912345678")).toBe("+51 912 345 678");
    expect(normalizarTelefono("552345678")).toBe("+56 55 234 5678");
    expect(normalizarTelefono(" 123 ")).toBe("123");
    expect(normalizarTelefono("")).toBe("");
  });
});
