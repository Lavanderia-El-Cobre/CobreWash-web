import { expect, it } from "vitest";
import { validarContacto } from "./validar";
import { VERSION_PRIVACIDAD } from "@/lib/privacidad/modelo";
const input = { autorizaDatos: true, versionPrivacidad: VERSION_PRIVACIDAD, id: "10000000-0000-4000-8000-000000000001", nombre: " Ana ", correo: " ANA@example.test ", telefono: "+56912345678", servicio: "industrial", mensaje: " Cotizar ropa " };
it("normaliza la solicitud sin agregar campos privilegiados", () => {
  expect(validarContacto({ ...input, estado: "ATENDIDA" })).toEqual({ id: input.id, nombre: "Ana", email: "ana@example.test", telefono: "+56 9 1234 5678", servicio: "industrial", mensaje: "Cotizar ropa" });
});
it("rechaza campos extensos, email, teléfono y servicio inválidos", () => {
  for (const extra of [{ mensaje: "x".repeat(2001) }, { correo: "sin-correo" }, { telefono: "123" }, { telefono: "+51 912 345 6789" }, { telefono: "+44 20 7946 0958" }, { servicio: "interno" }, { id: "no-uuid" }]) expect(() => validarContacto({ ...input, ...extra })).toThrow();
});
it("permite cotizar sin teléfono y exige autorización específica vigente", () => {
  expect(validarContacto({ ...input, telefono: "" }).telefono).toBe("");
  expect(() => validarContacto({ ...input, autorizaDatos: false })).toThrow();
  expect(() => validarContacto({ ...input, versionPrivacidad: "obsoleta" })).toThrow();
});
it("acepta teléfonos de otros países de Latinoamérica y los guarda normalizados", () => {
  expect(validarContacto({ ...input, telefono: "+51912345678" }).telefono).toBe("+51 912 345 678");
  expect(validarContacto({ ...input, telefono: "+54 9 11 2345 6789" }).telefono).toBe("+54 9 11 2345 6789");
  expect(validarContacto({ ...input, telefono: "+56 55 234 5678" }).telefono).toBe("+56 55 234 5678");
});
