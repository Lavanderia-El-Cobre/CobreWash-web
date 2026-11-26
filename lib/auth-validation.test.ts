import { describe, expect, it } from "vitest";
import { VERSION_PRIVACIDAD, VERSION_TERMINOS } from "@/lib/privacidad/modelo";
import {
  validateClientCompletion,
  validateLogin,
  validateManagedUserRegistration,
  validateManagedUserUpdate,
  validatePasswordReset,
  validatePublicClientRegistration,
  type ClientRegistrationInput,
  type ManagedUserRegistrationInput,
  type PublicClientRegistrationInput,
} from "@/lib/auth-validation";

const validClient: ClientRegistrationInput = {
  nombre: " Ana ",
  apellido: " Pérez ",
  rut: "12.345.678-5",
  telefono: "",
  email: " ana@example.com ",
  direccion: "",
  tipoCliente: "PARTICULAR" as ClientRegistrationInput["tipoCliente"],
  password: "clave123",
};

describe("validación de acceso y recuperación", () => {
  it("exige correo y contraseña para iniciar sesión", () => {
    expect(validateLogin(" ", "clave1")).toBe("Por favor ingresa tu correo y contraseña.");
    expect(validateLogin("ana@example.com", "clave1")).toBeNull();
  });

  it("exige correo para recuperar contraseña", () => {
    expect(validatePasswordReset(" ")).toBe("Por favor ingresa tu correo electrónico.");
    expect(validatePasswordReset(" ana@example.com ")).toBeNull();
  });
});

describe("validación del registro público de clientes", () => {
  const validRegistration: PublicClientRegistrationInput = {
    ...validClient,
    confirmPassword: "clave123",
    aceptaTerminos: true, versionTerminos: VERSION_TERMINOS,
    autorizaDatos: true, versionPrivacidad: VERSION_PRIVACIDAD,
  };

  it("exige los datos personales y credenciales obligatorios", () => {
    expect(
      validatePublicClientRegistration({ ...validRegistration, apellido: " " }),
    ).toBe("Todos los campos son obligatorios.");
  });

  it("exige tipo de cliente, RUT válido, contraseña robusta y confirmación coincidente", () => {
    expect(
      validatePublicClientRegistration({ ...validRegistration, tipoCliente: "" }),
    ).toBe("Selecciona el tipo de cliente.");
    expect(
      validatePublicClientRegistration({ ...validRegistration, rut: "12.345.678-9" }),
    ).toBe("El RUT ingresado no es válido.");
    expect(
      validatePublicClientRegistration({ ...validRegistration, password: "abcdefgh", confirmPassword: "abcdefgh" }),
    ).toBe("Debe incluir al menos un número");
    expect(
      validatePublicClientRegistration({ ...validRegistration, confirmPassword: "otra1234" }),
    ).toBe("Las contraseñas no coinciden.");
  });

  it("acepta un registro válido y deja teléfono/dirección como opcionales", () => {
    expect(validatePublicClientRegistration(validRegistration)).toBeNull();
  });
  it("valida el teléfono opcional de Chile u otro país de Latinoamérica", () => {
    expect(validatePublicClientRegistration({ ...validRegistration, telefono: "+56 9 1234 5678" })).toBeNull();
    expect(validatePublicClientRegistration({ ...validRegistration, telefono: "+51 912 345 678" })).toBeNull();
    expect(validatePublicClientRegistration({ ...validRegistration, telefono: "+56 9 1234" })).toBe("El celular chileno debe tener 8 dígitos después de +56 9.");
  });
  it("requiere autorización específica de la versión vigente", () => {
    expect(validatePublicClientRegistration({ ...validRegistration, autorizaDatos: false })).toContain("autoriza");
    expect(validatePublicClientRegistration({ ...validRegistration, versionPrivacidad: "anterior" })).toContain("vigente");
  });
  it("exige aceptar los términos vigentes por separado de la autorización de datos", () => {
    expect(validatePublicClientRegistration({ ...validRegistration, aceptaTerminos: false })).toContain("Términos y Condiciones");
    expect(validatePublicClientRegistration({ ...validRegistration, versionTerminos: "anterior" })).toContain("Términos y Condiciones");
  });
  it("valida los datos para terminar un registro con correo verificado", () => {
    const completar = {
      nombre: validRegistration.nombre, apellido: validRegistration.apellido, rut: validRegistration.rut,
      telefono: validRegistration.telefono, direccion: validRegistration.direccion, tipoCliente: validRegistration.tipoCliente,
      aceptaTerminos: true, versionTerminos: VERSION_TERMINOS, autorizaDatos: true, versionPrivacidad: VERSION_PRIVACIDAD,
    };
    expect(validateClientCompletion(completar)).toBeNull();
    expect(validateClientCompletion({ ...completar, rut: "12.345.678-9" })).toBe("El RUT ingresado no es válido.");
    expect(validateClientCompletion({ ...completar, aceptaTerminos: false })).toContain("Términos y Condiciones");
    expect(validateClientCompletion({ ...completar, nombre: " " })).toBe("Completa tu nombre, apellido y RUT.");
    expect(validateClientCompletion({ ...completar, telefono: "+54 11 2345" })).toContain("Argentina");
  });

  it.each(["admin", "recepcionista", "operario", "conductor", "repartidor"])(
    "rechaza %s como tipo de cuenta en el registro público",
    (tipo) => {
      expect(validatePublicClientRegistration({
        ...validRegistration,
        tipoCliente: tipo as PublicClientRegistrationInput["tipoCliente"],
      })).toBe("Selecciona el tipo de cliente.");
    },
  );
});

describe("validación de usuarios creados por administración", () => {
  const validManagedUser: ManagedUserRegistrationInput = {
    ...validClient,
    rolId: "rol-cliente",
    informado: true,
  };

  it("no pide contraseña: la persona la crea con el enlace de su correo", () => {
    const { password: _sinClave, ...sinClave } = validClient;
    void _sinClave;
    expect(validateManagedUserRegistration({ ...sinClave, rolId: "rol-operario", informado: true }, "operario")).toBeNull();
    expect(validateManagedUserRegistration({ ...validManagedUser, email: "sin-arroba" }, "operario")).toContain("correo válido");
  });

  it("exige confirmar que se informó a la persona de los términos y el aviso", () => {
    expect(validateManagedUserRegistration({ ...validManagedUser, informado: false }, "operario")).toContain("Confirma que informaste");
  });

  it("exige tipo de cliente solo para el rol cliente", () => {
    expect(validateManagedUserRegistration({ ...validManagedUser, tipoCliente: "" }, "cliente")).toBe(
      "Selecciona el tipo de cliente.",
    );
    expect(validateManagedUserRegistration({ ...validManagedUser, tipoCliente: "" }, "operario")).toBeNull();
  });

  it("valida el teléfono al crear y al editar una cuenta", () => {
    expect(validateManagedUserRegistration({ ...validManagedUser, telefono: "+591 7123 4567" }, "operario")).toBeNull();
    expect(validateManagedUserRegistration({ ...validManagedUser, telefono: "+56 88 123 4567" }, "operario")).toContain("fijo chileno");
    expect(validateManagedUserUpdate("rol-cliente", "Ana", "+57 300 123 4567")).toBeNull();
    expect(validateManagedUserUpdate("rol-cliente", "Ana", "+57 300")).toContain("Colombia");
  });

  it("exige rol y nombre al editar una cuenta", () => {
    expect(validateManagedUserUpdate("", "Ana")).toBe("El rol y el nombre son obligatorios.");
    expect(validateManagedUserUpdate("rol-cliente", " ")).toBe("El rol y el nombre son obligatorios.");
    expect(validateManagedUserUpdate("rol-cliente", " Ana ")).toBeNull();
  });
});
