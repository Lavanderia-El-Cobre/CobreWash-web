import { describe, expect, it, vi } from "vitest";
import { esFallaCredencialesAdmin, verificarSesionAdmin } from "./sesion-admin";

const conCodigo = (code: string) => Object.assign(new Error("detalle interno"), { code });
const errores = { sesionVencida: () => new Error("vencida"), servidor: () => new Error("servidor") };

describe("verificación de sesión con Firebase Admin", () => {
  it("devuelve el token verificado y siempre revisa la revocación", async () => {
    const verifyIdToken = vi.fn().mockResolvedValue({ uid: "u1" });
    await expect(verificarSesionAdmin({ verifyIdToken }, "tok", errores)).resolves.toEqual({ uid: "u1" });
    expect(verifyIdToken).toHaveBeenCalledWith("tok", true);
  });

  it.each(["auth/id-token-expired", "auth/id-token-revoked", "auth/argument-error", "auth/user-disabled", ""])(
    "trata %s como sesión vencida",
    async (codigo) => {
      const verifyIdToken = vi.fn().mockRejectedValue(codigo ? conCodigo(codigo) : new Error("sin código"));
      await expect(verificarSesionAdmin({ verifyIdToken }, "tok", errores)).rejects.toThrow("vencida");
    },
  );

  it.each(["app/invalid-credential", "auth/internal-error", "auth/insufficient-permission"])(
    "no disfraza %s de sesión vencida y registra solo el código",
    async (codigo) => {
      const log = vi.spyOn(console, "error").mockImplementation(() => {});
      const verifyIdToken = vi.fn().mockRejectedValue(conCodigo(codigo));
      await expect(verificarSesionAdmin({ verifyIdToken }, "tok", errores)).rejects.toThrow("servidor");
      expect(log).toHaveBeenCalledWith(expect.stringContaining("FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON"), codigo);
      expect(JSON.stringify(log.mock.calls)).not.toContain("tok");
      expect(JSON.stringify(log.mock.calls)).not.toContain("detalle interno");
    },
  );

  it("clasifica solo errores con código de credenciales o permisos", () => {
    expect(esFallaCredencialesAdmin(conCodigo("app/invalid-credential"))).toBe(true);
    expect(esFallaCredencialesAdmin(conCodigo("auth/id-token-expired"))).toBe(false);
    expect(esFallaCredencialesAdmin(null)).toBe(false);
  });
});
