import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Auth } from "firebase/auth";
import type { DataConnect } from "firebase/data-connect";
import type {
  AceptacionCondiciones,
  ClientRegistrationInput,
  ManagedUserRegistrationInput,
} from "@/lib/auth-validation";
import { VERSION_PRIVACIDAD, VERSION_TERMINOS } from "@/lib/privacidad/modelo";

const mocks = vi.hoisted(() => ({
  createUser: vi.fn(),
  sendReset: vi.fn(),
  sendVerification: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  getProfile: vi.fn(),
  registerClient: vi.fn(),
  aceptar: vi.fn(),
  createAdminUser: vi.fn(),
  createAdminClient: vi.fn(),
  updateUser: vi.fn(),
  createSecondary: vi.fn(),
  linkFicha: vi.fn(),
}));

vi.mock("firebase/auth", () => ({
  createUserWithEmailAndPassword: mocks.createUser,
  sendPasswordResetEmail: mocks.sendReset,
  sendEmailVerification: mocks.sendVerification,
  signInWithEmailAndPassword: mocks.signIn,
  signOut: mocks.signOut,
}));

vi.mock("firebase/data-connect", () => ({
  QueryFetchPolicy: { SERVER_ONLY: "SERVER_ONLY" },
}));

vi.mock("@/src/dataconnect-generated", () => ({
  TipoCliente: { PARTICULAR: "PARTICULAR", HOTEL: "HOTEL" },
  aceptarCondicionesVigentes: mocks.aceptar,
  actualizarUsuario: mocks.updateUser,
  crearClienteAdministrado: mocks.createAdminClient,
  crearUsuarioAdministrado: mocks.createAdminUser,
  getMiPerfil: mocks.getProfile,
  registrarseComoCliente: mocks.registerClient,
  vincularMiFichaVerificada: mocks.linkFicha,
}));

vi.mock("@/lib/firebase/secondary", () => ({
  createSecondaryFirebaseContext: mocks.createSecondary,
}));

import {
  aceptarCondiciones,
  completarRegistroCliente,
  createManagedUser,
  InactiveAccountError,
  loadActiveUserProfile,
  registerPublicClient,
  requestPasswordReset,
  requiereAceptacion,
  signInAndResolveLanding,
  toggleManagedUserActive,
  updateManagedUser,
} from "@/lib/firebase/auth-flows";

const NUEVA = "Wed, 25 Nov 2026 12:00:00 GMT";
const ANTIGUA = "Mon, 02 Nov 2026 12:00:00 GMT";
const dataConnect = {} as DataConnect;
const aceptacion: AceptacionCondiciones = { aceptaTerminos: true, versionTerminos: VERSION_TERMINOS, autorizaDatos: true, versionPrivacidad: VERSION_PRIVACIDAD };
const clientInput: ClientRegistrationInput & AceptacionCondiciones = {
  ...aceptacion,
  nombre: " Ana ",
  apellido: " Pérez ",
  rut: "123456785",
  telefono: " ",
  email: " ana@example.com ",
  direccion: " ",
  tipoCliente: "PARTICULAR" as ClientRegistrationInput["tipoCliente"],
  password: "clave123",
};
const managedInput: ManagedUserRegistrationInput = {
  ...clientInput,
  rolId: "rol-cliente",
  informado: true,
};

function usuarioAuth(opciones: { emailVerified?: boolean; creationTime?: string; email?: string | null } = {}) {
  const user = {
    uid: "uid-ana",
    email: opciones.email === undefined ? "ana@example.com" : opciones.email,
    emailVerified: opciones.emailVerified ?? true,
    metadata: { creationTime: opciones.creationTime ?? NUEVA },
    reload: vi.fn().mockResolvedValue(undefined),
    getIdToken: vi.fn().mockResolvedValue("token"),
    delete: vi.fn().mockResolvedValue(undefined),
  };
  return user;
}
const authCon = (user: ReturnType<typeof usuarioAuth> | null) => ({ currentUser: user }) as unknown as Auth;

describe("flujos de autenticación", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.signOut.mockResolvedValue(undefined);
    mocks.sendVerification.mockResolvedValue(undefined);
  });

  it.each([
    ["admin", "/intranet"],
    ["recepcionista", "/intranet/comandas"],
    ["operario", "/intranet/seguimiento"],
    ["cliente", "/cuenta"],
  ])("inicia sesión y resuelve la vista del rol %s", async (role, landing) => {
    const auth = authCon(usuarioAuth());
    mocks.signIn.mockResolvedValue({});
    mocks.getProfile.mockResolvedValue({
      data: { usuario: { activo: true, rol: { nombre: role }, clientes_on_usuario: [{ id: "f" }] } },
    });

    await expect(
      signInAndResolveLanding({ auth, dataConnect }, " ana@example.com ", "clave1"),
    ).resolves.toEqual({ tipo: "landing", ruta: landing });

    expect(mocks.signIn).toHaveBeenCalledWith(auth, "ana@example.com", "clave1");
    expect(mocks.getProfile).toHaveBeenCalledWith(dataConnect, { fetchPolicy: "SERVER_ONLY" });
  });


  it("una cuenta nueva sin correo verificado no ingresa y recibe un nuevo enlace", async () => {
    const user = usuarioAuth({ emailVerified: false });
    mocks.signIn.mockResolvedValue({});

    await expect(signInAndResolveLanding({ auth: authCon(user), dataConnect }, "ana@example.com", "clave1"))
      .resolves.toEqual({ tipo: "verificar", email: "ana@example.com" });
    expect(user.reload).toHaveBeenCalled();
    expect(mocks.getProfile).not.toHaveBeenCalled();
    expect(mocks.sendVerification).toHaveBeenCalledWith(user, null);
  });

  it("una cuenta anterior a la verificación obligatoria sigue ingresando", async () => {
    const user = usuarioAuth({ emailVerified: false, creationTime: ANTIGUA });
    mocks.signIn.mockResolvedValue({});
    mocks.getProfile.mockResolvedValue({ data: { usuario: { activo: true, rol: { nombre: "operario" }, clientes_on_usuario: [] } } });

    await expect(signInAndResolveLanding({ auth: authCon(user), dataConnect }, "a@b.cl", "clave1"))
      .resolves.toEqual({ tipo: "landing", ruta: "/intranet/seguimiento" });
  });

  it("con correo verificado y sin perfil pide terminar el registro", async () => {
    mocks.signIn.mockResolvedValue({});
    mocks.getProfile.mockResolvedValue({ data: { usuario: null } });

    await expect(signInAndResolveLanding({ auth: authCon(usuarioAuth()), dataConnect }, "a@b.cl", "clave1"))
      .resolves.toEqual({ tipo: "completar", email: "ana@example.com" });
  });

  it("cierra la sesión y rechaza una cuenta inactiva", async () => {
    const auth = authCon(null);
    mocks.getProfile.mockResolvedValue({
      data: { usuario: { activo: false, rol: { nombre: "admin" }, clientes_on_usuario: [] } },
    });

    await expect(loadActiveUserProfile({ auth, dataConnect })).rejects.toBeInstanceOf(InactiveAccountError);
    expect(mocks.signOut).toHaveBeenCalledWith(auth);
  });

  it("solicita recuperación con el correo normalizado", async () => {
    const auth = authCon(null);
    mocks.sendReset.mockResolvedValue(undefined);

    await requestPasswordReset(auth, " ana@example.com ");

    expect(mocks.sendReset).toHaveBeenCalledWith(auth, "ana@example.com");
  });
});

describe("registro público de clientes", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.sendVerification.mockResolvedValue(undefined);
  });

  it.each(["admin", "recepcionista", "operario", "conductor", "repartidor"])(
    "no crea ni Auth ni perfil si se inyecta el tipo interno %s",
    async (tipo) => {
      await expect(registerPublicClient({ auth: authCon(null), dataConnect }, {
        ...clientInput, tipoCliente: tipo as ClientRegistrationInput["tipoCliente"],
      })).rejects.toThrow("Selecciona el tipo de cliente.");
      expect(mocks.createUser).not.toHaveBeenCalled();
      expect(mocks.registerClient).not.toHaveBeenCalled();
      expect(mocks.createAdminUser).not.toHaveBeenCalled();
    },
  );

  it("crea solo la identidad y envía la verificación: el perfil espera el correo verificado", async () => {
    const user = usuarioAuth({ emailVerified: false });
    const auth = authCon(null);
    mocks.createUser.mockResolvedValue({ user });

    await expect(registerPublicClient({ auth, dataConnect }, clientInput)).resolves.toEqual({ email: "ana@example.com", correoEnviado: true });

    expect(mocks.createUser).toHaveBeenCalledWith(auth, "ana@example.com", "clave123");
    expect(mocks.sendVerification).toHaveBeenCalledWith(user, null);
    expect(mocks.registerClient).not.toHaveBeenCalled();
    expect(user.delete).not.toHaveBeenCalled();
  });

  it("informa si no se pudo enviar el correo sin perder la cuenta", async () => {
    mocks.createUser.mockResolvedValue({ user: usuarioAuth({ emailVerified: false }) });
    mocks.sendVerification.mockRejectedValue(new Error("cuota"));
    await expect(registerPublicClient({ auth: authCon(null), dataConnect }, clientInput)).resolves.toMatchObject({ correoEnviado: false });
  });

  it("no crea una identidad Firebase sin aceptar términos ni autorizar datos de la versión vigente", async () => {
    const auth = authCon(null);
    await expect(registerPublicClient({ auth, dataConnect }, { ...clientInput, autorizaDatos: false })).rejects.toThrow("autoriza");
    await expect(registerPublicClient({ auth, dataConnect }, { ...clientInput, versionPrivacidad: "anterior" })).rejects.toThrow("vigente");
    await expect(registerPublicClient({ auth, dataConnect }, { ...clientInput, aceptaTerminos: false })).rejects.toThrow("Términos y Condiciones");
    await expect(registerPublicClient({ auth, dataConnect }, { ...clientInput, versionTerminos: "anterior" })).rejects.toThrow("Términos y Condiciones");
    expect(mocks.createUser).not.toHaveBeenCalled();
  });

  it("elimina la identidad si Firebase no devuelve el correo autenticado", async () => {
    const user = usuarioAuth({ email: null });
    mocks.createUser.mockResolvedValue({ user });
    await expect(registerPublicClient({ auth: authCon(null), dataConnect }, clientInput)).rejects.toThrow("correo de la cuenta");
    expect(user.delete).toHaveBeenCalledOnce();
    expect(mocks.sendVerification).not.toHaveBeenCalled();
  });
});

describe("término del registro con correo verificado", () => {
  const completar = {
    ...aceptacion, nombre: " Ana ", apellido: " Pérez ", rut: "123456785", telefono: " ", direccion: " ",
    tipoCliente: "PARTICULAR" as ClientRegistrationInput["tipoCliente"],
  };

  beforeEach(() => {
    vi.resetAllMocks();
    mocks.registerClient.mockResolvedValue({});
    mocks.getProfile.mockResolvedValue({ data: { usuario: { activo: true, rol: { nombre: "cliente" }, clientes_on_usuario: [{ id: "f" }] } } });
  });

  it("refresca el token y crea Usuario+Cliente con la aceptación de ambas versiones", async () => {
    const user = usuarioAuth();
    await expect(completarRegistroCliente({ auth: authCon(user), dataConnect }, completar)).resolves.toBe("/cuenta");

    expect(user.getIdToken).toHaveBeenCalledWith(true);
    expect(mocks.registerClient).toHaveBeenCalledWith(dataConnect, {
      versionPrivacidad: VERSION_PRIVACIDAD,
      versionTerminos: VERSION_TERMINOS,
      rut: "12.345.678-5",
      nombre: "Ana",
      apellido: "Pérez",
      telefono: null,
      email: "ana@example.com",
      direccion: null,
      tipoCliente: "PARTICULAR",
    });
  });

  it("descarta roles inyectados y solo llama a la operación de clientes", async () => {
    await completarRegistroCliente({ auth: authCon(usuarioAuth()), dataConnect }, { ...completar, rolId: "rol-admin", rol: "admin", activo: true } as typeof completar);
    const variables = mocks.registerClient.mock.calls[0][1];
    expect(variables).not.toHaveProperty("rolId");
    expect(variables).not.toHaveProperty("rol");
    expect(variables).not.toHaveProperty("activo");
    expect(mocks.createAdminUser).not.toHaveBeenCalled();
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("no crea el perfil si el correo aún no está verificado", async () => {
    await expect(completarRegistroCliente({ auth: authCon(usuarioAuth({ emailVerified: false })), dataConnect }, completar))
      .rejects.toMatchObject({ code: "auth/email-not-verified" });
    expect(mocks.registerClient).not.toHaveBeenCalled();
  });

  it("reutiliza la ficha de recepción con el mismo RUT sin duplicarla", async () => {
    mocks.registerClient.mockRejectedValueOnce(new Error("FICHA_RUT_EXISTENTE"));
    await completarRegistroCliente({ auth: authCon(usuarioAuth()), dataConnect }, completar);
    expect(mocks.registerClient).toHaveBeenLastCalledWith(dataConnect, expect.objectContaining({ crearFicha: false }));
  });

  it("exige aceptar términos y autorizar datos", async () => {
    await expect(completarRegistroCliente({ auth: authCon(usuarioAuth()), dataConnect }, { ...completar, aceptaTerminos: false })).rejects.toThrow("Términos");
    expect(mocks.registerClient).not.toHaveBeenCalled();
  });
});

describe("aceptación de condiciones vigentes", () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.aceptar.mockResolvedValue({}); });

  it("registra ambas versiones vigentes", async () => {
    await aceptarCondiciones(dataConnect, aceptacion);
    expect(mocks.aceptar).toHaveBeenCalledWith(dataConnect, { versionPrivacidad: VERSION_PRIVACIDAD, versionTerminos: VERSION_TERMINOS });
  });

  it("no registra nada sin las dos casillas", async () => {
    await expect(aceptarCondiciones(dataConnect, { ...aceptacion, autorizaDatos: false })).rejects.toThrow("autoriza");
    expect(mocks.aceptar).not.toHaveBeenCalled();
  });

  it("solo exige la aceptación a clientes con versiones distintas de las vigentes", () => {
    const cliente = { rol: { nombre: "cliente" }, versionPrivacidad: VERSION_PRIVACIDAD, versionTerminos: VERSION_TERMINOS } as Parameters<typeof requiereAceptacion>[0];
    expect(requiereAceptacion(cliente)).toBe(false);
    expect(requiereAceptacion({ ...cliente!, versionTerminos: null })).toBe(true);
    expect(requiereAceptacion({ ...cliente!, versionPrivacidad: "2026-11-01" })).toBe(true);
    expect(requiereAceptacion({ ...cliente!, rol: { ...cliente!.rol, nombre: "operario" }, versionTerminos: null })).toBe(false);
  });
});

describe("creación de usuarios desde administración", () => {
  const secondaryAuth = {} as Auth;
  const cleanup = vi.fn();
  let creado: ReturnType<typeof usuarioAuth>;

  beforeEach(() => {
    vi.resetAllMocks();
    creado = { ...usuarioAuth({ emailVerified: false }), uid: "nuevo-uid" };
    mocks.createSecondary.mockReturnValue({ auth: secondaryAuth, cleanup });
    mocks.createUser.mockResolvedValue({ user: creado });
    mocks.createAdminUser.mockResolvedValue({});
    mocks.createAdminClient.mockResolvedValue({});
    mocks.sendReset.mockResolvedValue(undefined);
    cleanup.mockResolvedValue(undefined);
  });

  it("usa Auth secundario y la sesión Data Connect principal para crear clientes", async () => {
    await expect(createManagedUser(dataConnect, { ...managedInput, direccion: " Calle Uno 123 " }, "cliente"))
      .resolves.toEqual({ invitacionEnviada: true });

    // La contraseña inicial es aleatoria: el administrador nunca la define ni la conoce.
    const [, , clave] = mocks.createUser.mock.calls[0];
    expect(mocks.createUser).toHaveBeenCalledWith(secondaryAuth, "ana@example.com", expect.any(String));
    expect(clave).not.toBe("clave123");
    expect(clave.length).toBeGreaterThanOrEqual(24);
    expect(mocks.createAdminClient).toHaveBeenCalledWith(
      dataConnect,
      expect.objectContaining({ id: "nuevo-uid", direccion: "Calle Uno 123", tipoCliente: "PARTICULAR", email: "ana@example.com" }),
    );
    // La persona recibe el enlace para crear su contraseña.
    expect(mocks.sendReset).toHaveBeenCalledWith(secondaryAuth, "ana@example.com", undefined);
    expect(mocks.sendVerification).not.toHaveBeenCalled();
    expect(mocks.createAdminUser).not.toHaveBeenCalled();
    expect(creado.delete).not.toHaveBeenCalled();
    expect(cleanup).toHaveBeenCalledOnce();
  });

  it("crea solo Usuario para un rol interno y envía la invitación", async () => {
    await createManagedUser(dataConnect, { ...managedInput, rolId: "rol-operario", tipoCliente: "" }, "operario");

    expect(mocks.createAdminUser).toHaveBeenCalledWith(
      dataConnect,
      expect.objectContaining({ id: "nuevo-uid", rolId: "rol-operario", email: "ana@example.com" }),
    );
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
    expect(mocks.sendReset).toHaveBeenCalledOnce();
    expect(cleanup).toHaveBeenCalledOnce();
  });

  it("no crea la cuenta sin la confirmación del administrador", async () => {
    await expect(createManagedUser(dataConnect, { ...managedInput, informado: false }, "operario")).rejects.toThrow("Confirma que informaste");
    expect(mocks.createUser).not.toHaveBeenCalled();
  });

  it("la cuenta queda creada aunque falle el envío de la invitación", async () => {
    mocks.sendReset.mockRejectedValue(new Error("cuota"));
    await expect(createManagedUser(dataConnect, managedInput, "cliente")).resolves.toEqual({ invitacionEnviada: false });
    expect(creado.delete).not.toHaveBeenCalled();
  });

  it("elimina la cuenta Auth y el contexto secundario si falla Data Connect", async () => {
    const error = new Error("falló la creación");
    mocks.createAdminClient.mockRejectedValue(error);

    await expect(createManagedUser(dataConnect, managedInput, "cliente")).rejects.toBe(error);
    expect(creado.delete).toHaveBeenCalledOnce();
    expect(cleanup).toHaveBeenCalledOnce();
  });

  it("no intenta rollback si Firebase Auth falla antes de crear la cuenta", async () => {
    const error = new Error("falló Auth");
    mocks.createUser.mockRejectedValue(error);

    await expect(createManagedUser(dataConnect, managedInput, "cliente")).rejects.toBe(error);
    expect(creado.delete).not.toHaveBeenCalled();
    expect(cleanup).toHaveBeenCalledOnce();
  });
});

describe("edición y estado de usuarios", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.updateUser.mockResolvedValue({});
  });

  it("normaliza campos editables y conserva el estado actual", async () => {
    await updateManagedUser(dataConnect, {
      id: "usuario-1",
      rolId: "rol-cliente",
      nombre: " Ana ",
      apellido: " ",
      telefono: " +56912345678 ",
      activo: true,
    });

    expect(mocks.updateUser).toHaveBeenCalledWith(dataConnect, {
      id: "usuario-1",
      rolId: "rol-cliente",
      nombre: "Ana",
      apellido: null,
      telefono: "+56912345678",
      activo: true,
    });
  });

  it("invierte únicamente el estado activo", async () => {
    await toggleManagedUserActive(dataConnect, {
      id: "usuario-1",
      rolId: "rol-cliente",
      nombre: "Ana",
      apellido: null,
      telefono: null,
      activo: true,
    });

    expect(mocks.updateUser).toHaveBeenCalledWith(
      dataConnect,
      expect.objectContaining({ id: "usuario-1", activo: false }),
    );
  });
});
