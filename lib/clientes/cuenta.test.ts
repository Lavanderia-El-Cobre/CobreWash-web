import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DataConnect } from "firebase/data-connect";

const m = vi.hoisted(() => ({
  createUser: vi.fn(), sendReset: vi.fn(), executeMutation: vi.fn(), mutationRef: vi.fn(),
  crearConCuenta: vi.fn(), cleanup: vi.fn(), borrar: vi.fn(),
}));
vi.mock("firebase/auth", () => ({ createUserWithEmailAndPassword: m.createUser, sendPasswordResetEmail: m.sendReset, sendEmailVerification: vi.fn() }));
vi.mock("firebase/data-connect", () => ({ executeMutation: m.executeMutation, mutationRef: m.mutationRef }));
vi.mock("@/src/dataconnect-generated", () => ({ TipoCliente: { PARTICULAR: "PARTICULAR", HOTEL: "HOTEL" }, crearClienteConCuenta: m.crearConCuenta }));
vi.mock("@/lib/firebase/secondary", () => ({ createSecondaryFirebaseContext: () => ({ auth: { secundaria: true }, cleanup: m.cleanup }) }));

import { avisoClienteConCuenta, nombreDeCuenta, registrarClienteConCuenta, registrarFichaCliente } from "./cuenta";
import { TipoCliente } from "@/src/dataconnect-generated";

const dc = {} as DataConnect;
const ficha = { nombre: " Ana  María Pérez ", tipoCliente: TipoCliente.PARTICULAR, rut: "12.345.678-5", telefono: "+56 9 1234 5678", email: " ANA@Example.cl ", direccion: "" };

beforeEach(() => {
  vi.resetAllMocks();
  m.cleanup.mockResolvedValue(undefined);
  m.borrar.mockResolvedValue(undefined);
  m.createUser.mockResolvedValue({ user: { uid: "uid-cliente", delete: m.borrar } });
  m.crearConCuenta.mockResolvedValue({ data: { cliente_insert: { id: "ficha-1" } } });
  m.sendReset.mockResolvedValue(undefined);
});

describe("cliente registrado por recepción con cuenta asociada", () => {
  it("crea la identidad secundaria, guarda Usuario+Cliente y envía la invitación", async () => {
    await expect(registrarClienteConCuenta(dc, ficha)).resolves.toEqual({ id: "ficha-1", cuenta: "creada", invitacionEnviada: true });
    const [auth, email, clave] = m.createUser.mock.calls[0];
    expect(auth).toEqual({ secundaria: true });
    expect(email).toBe("ana@example.cl");
    expect(clave.length).toBeGreaterThanOrEqual(24);
    expect(m.crearConCuenta).toHaveBeenCalledWith(dc, expect.objectContaining({
      usuarioId: "uid-cliente", nombreUsuario: "Ana", apellidoUsuario: "María Pérez", nombre: "Ana  María Pérez", email: "ana@example.cl", direccion: null,
    }));
    expect(m.sendReset).toHaveBeenCalledWith({ secundaria: true }, "ana@example.cl", undefined);
    expect(m.borrar).not.toHaveBeenCalled();
    expect(m.cleanup).toHaveBeenCalledOnce();
  });

  it("exige un correo válido antes de crear nada", async () => {
    await expect(registrarClienteConCuenta(dc, { ...ficha, email: "sin-correo" })).rejects.toThrow("correo");
    expect(m.createUser).not.toHaveBeenCalled();
  });

  it("si el correo ya tiene cuenta, crea solo la ficha para asociarla al verificarse", async () => {
    m.createUser.mockRejectedValue({ code: "auth/email-already-in-use" });
    m.executeMutation.mockResolvedValue({ data: { cliente_insert: { id: "ficha-2" } } });
    await expect(registrarClienteConCuenta(dc, ficha)).resolves.toEqual({ id: "ficha-2", cuenta: "existente", invitacionEnviada: false });
    expect(m.mutationRef).toHaveBeenCalledWith(dc, "CrearClienteComanda", expect.objectContaining({ email: "ana@example.cl" }));
    expect(m.crearConCuenta).not.toHaveBeenCalled();
  });

  it("elimina la identidad creada si falla la base de datos", async () => {
    const error = new Error("ALREADY_EXISTS rut");
    m.crearConCuenta.mockRejectedValue(error);
    await expect(registrarClienteConCuenta(dc, ficha)).rejects.toBe(error);
    expect(m.borrar).toHaveBeenCalledOnce();
    expect(m.sendReset).not.toHaveBeenCalled();
    expect(m.cleanup).toHaveBeenCalledOnce();
  });

  it("la ficha queda creada aunque falle el envío de la invitación", async () => {
    m.sendReset.mockRejectedValue(new Error("cuota"));
    await expect(registrarClienteConCuenta(dc, ficha)).resolves.toMatchObject({ cuenta: "creada", invitacionEnviada: false });
    expect(m.borrar).not.toHaveBeenCalled();
  });
});

describe("cliente registrado solo con ficha", () => {
  it("no crea cuenta y acepta el correo vacío", async () => {
    m.executeMutation.mockResolvedValue({ data: { cliente_insert: { id: "ficha-3" } } });
    await expect(registrarFichaCliente(dc, { ...ficha, email: "  " })).resolves.toBe("ficha-3");
    expect(m.mutationRef).toHaveBeenCalledWith(dc, "CrearClienteComanda", expect.objectContaining({ email: undefined, nombre: "Ana  María Pérez", direccion: undefined }));
    expect(m.createUser).not.toHaveBeenCalled();
    expect(m.sendReset).not.toHaveBeenCalled();
  });

  it("guarda el correo opcional normalizado y rechaza uno inválido", async () => {
    m.executeMutation.mockResolvedValue({ data: { cliente_insert: { id: "ficha-4" } } });
    await registrarFichaCliente(dc, ficha);
    expect(m.mutationRef).toHaveBeenCalledWith(dc, "CrearClienteComanda", expect.objectContaining({ email: "ana@example.cl" }));
    await expect(registrarFichaCliente(dc, { ...ficha, email: "malo" })).rejects.toThrow("correo válido");
  });
});

describe("nombre del perfil y avisos", () => {
  it("separa nombre y apellido de particulares y conserva la razón social de empresas", () => {
    expect(nombreDeCuenta("Ana Pérez", TipoCliente.PARTICULAR)).toEqual({ nombreUsuario: "Ana", apellidoUsuario: "Pérez" });
    expect(nombreDeCuenta("Hotel Altos del Loa", TipoCliente.HOTEL)).toEqual({ nombreUsuario: "Hotel Altos del Loa", apellidoUsuario: null });
  });

  it("explica al personal qué ocurrió con la cuenta", () => {
    expect(avisoClienteConCuenta({ id: "1", cuenta: "creada", invitacionEnviada: true }, "a@b.cl")).toContain("enlace para activar");
    expect(avisoClienteConCuenta({ id: "1", cuenta: "creada", invitacionEnviada: false }, "a@b.cl")).toContain("no se pudo enviar");
    expect(avisoClienteConCuenta({ id: "1", cuenta: "existente", invitacionEnviada: false }, "a@b.cl")).toContain("ya tenía una cuenta");
  });
});
