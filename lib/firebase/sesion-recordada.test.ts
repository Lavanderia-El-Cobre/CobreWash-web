import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Auth } from "firebase/auth";

const m = vi.hoisted(() => ({ setPersistence: vi.fn(), signOut: vi.fn() }));
vi.mock("firebase/auth", () => ({
  setPersistence: m.setPersistence, signOut: m.signOut,
  browserSessionPersistence: "session", indexedDBLocalPersistence: "local",
}));

import { aplicarRecordarSesion, cerrarSesionRecordadaVencida, DIAS_SESION_RECORDADA, sesionRecordadaVencida } from "./sesion-recordada";

const DIA = 86_400_000;
const auth = { currentUser: { uid: "u1" } } as unknown as Auth;

beforeEach(() => {
  vi.resetAllMocks();
  const datos = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => datos.get(k) ?? null,
    setItem: (k: string, v: string) => { datos.set(k, v); },
    removeItem: (k: string) => { datos.delete(k); },
  });
  m.setPersistence.mockResolvedValue(undefined);
  m.signOut.mockResolvedValue(undefined);
});

describe("mantener la sesión iniciada", () => {
  it("sin marcar, la sesión dura solo mientras el navegador está abierto", async () => {
    await aplicarRecordarSesion(auth, false);
    expect(m.setPersistence).toHaveBeenCalledWith(auth, "session");
    expect(sesionRecordadaVencida()).toBe(false);
  });

  it("marcada, sobrevive al cierre del navegador con un plazo máximo", async () => {
    const ahora = Date.parse("2026-11-26T12:00:00Z");
    await aplicarRecordarSesion(auth, true, ahora);
    expect(m.setPersistence).toHaveBeenCalledWith(auth, "local");
    expect(sesionRecordadaVencida(ahora + (DIAS_SESION_RECORDADA - 1) * DIA)).toBe(false);
    expect(sesionRecordadaVencida(ahora + DIAS_SESION_RECORDADA * DIA)).toBe(true);
  });

  it("cierra la sesión vencida y olvida el plazo", async () => {
    const ahora = Date.now();
    await aplicarRecordarSesion(auth, true, ahora - (DIAS_SESION_RECORDADA + 1) * DIA);
    await expect(cerrarSesionRecordadaVencida(auth)).resolves.toBe(true);
    expect(m.signOut).toHaveBeenCalledWith(auth);
    expect(sesionRecordadaVencida()).toBe(false);
  });

  it("no cierra una sesión vigente", async () => {
    await aplicarRecordarSesion(auth, true);
    await expect(cerrarSesionRecordadaVencida(auth)).resolves.toBe(false);
    expect(m.signOut).not.toHaveBeenCalled();
  });
});
