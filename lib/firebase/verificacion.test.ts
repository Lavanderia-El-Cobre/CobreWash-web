// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ verificar: vi.fn(), reset: vi.fn() }));
vi.mock("firebase/auth", () => ({ sendEmailVerification: m.verificar, sendPasswordResetEmail: m.reset }));
import { contrasenaTemporal, enviarInvitacion, enviarVerificacion, requiereVerificacion } from "./verificacion";
import type { Auth, User } from "firebase/auth";

beforeEach(() => { vi.resetAllMocks(); });

it("exige verificar solo cuentas nuevas con correo sin verificar", () => {
  expect(requiereVerificacion({ emailVerified: false, metadata: { creationTime: "Wed, 25 Nov 2026 12:00:00 GMT" } } as User)).toBe(true);
  expect(requiereVerificacion({ emailVerified: true, metadata: { creationTime: "Wed, 25 Nov 2026 12:00:00 GMT" } } as User)).toBe(false);
  expect(requiereVerificacion({ emailVerified: false, metadata: { creationTime: "Mon, 02 Nov 2026 12:00:00 GMT" } } as User)).toBe(false);
  expect(requiereVerificacion({ emailVerified: false, metadata: {} } as User)).toBe(true);
  expect(requiereVerificacion(null)).toBe(false);
});

it("el enlace vuelve al inicio de sesión del sitio", async () => {
  const user = {} as User;
  await enviarVerificacion(user);
  expect(m.verificar).toHaveBeenCalledWith(user, { url: `${window.location.origin}/?login=1` });
});

it("si el dominio no está autorizado en Firebase reintenta sin enlace de retorno", async () => {
  m.reset.mockRejectedValueOnce({ code: "auth/unauthorized-continue-uri" }).mockResolvedValueOnce(undefined);
  const auth = {} as Auth;
  await enviarInvitacion(auth, "a@b.cl");
  expect(m.reset).toHaveBeenLastCalledWith(auth, "a@b.cl", undefined);
});

it("no oculta otros errores de envío", async () => {
  m.verificar.mockRejectedValue({ code: "auth/too-many-requests" });
  await expect(enviarVerificacion({} as User)).rejects.toMatchObject({ code: "auth/too-many-requests" });
  expect(m.verificar).toHaveBeenCalledOnce();
});

it("genera contraseñas temporales distintas y robustas", () => {
  const a = contrasenaTemporal(), b = contrasenaTemporal();
  expect(a).not.toBe(b);
  expect(a.length).toBeGreaterThanOrEqual(24);
  expect(a).toMatch(/[A-Z]/); expect(a).toMatch(/[a-z]/); expect(a).toMatch(/\d/);
});

it("también reintenta sin enlace de retorno si el dominio no está autorizado", async () => {
  m.verificar.mockRejectedValueOnce({ code: "auth/unauthorized-domain" }).mockResolvedValueOnce(undefined);
  const user = {} as User;
  await enviarVerificacion(user);
  expect(m.verificar).toHaveBeenLastCalledWith(user, null);
});
