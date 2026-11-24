// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
type U = { uid: string; emailVerified?: boolean; metadata?: { creationTime?: string } };
const m = vi.hoisted(() => ({ auth: { currentUser: null as U | null }, callback: null as ((user: U | null) => void) | null, cargar: vi.fn(), unsubscribe: vi.fn() }));
vi.mock("firebase/auth", () => ({ onAuthStateChanged: (_auth: unknown, callback: typeof m.callback) => { m.callback = callback; return m.unsubscribe; } }));
vi.mock("@/lib/firebase/client", () => ({ auth: m.auth, dataConnect: {} }));
vi.mock("@/lib/firebase/auth-flows", () => ({ loadActiveUserProfile: m.cargar }));
import { useUsuarioActual } from "./useUsuarioActual";
beforeEach(() => { m.auth.currentUser = null; m.cargar.mockReset(); });
afterEach(cleanup);
it("un resultado anterior no restaura el perfil después del logout", async () => {
  let resolver!: (value: unknown) => void;
  m.cargar.mockReturnValue(new Promise(resolve => { resolver = resolve; }));
  const { result } = renderHook(useUsuarioActual);
  act(() => { m.auth.currentUser = { uid: "a", emailVerified: true }; m.callback!(m.auth.currentUser); });
  act(() => { m.auth.currentUser = null; m.callback!(null); });
  await act(async () => { resolver({ id: "a" }); });
  expect(result.current.usuario).toBeNull(); expect(result.current.loading).toBe(false);
});
it("el cambio A a B descarta A y espera el perfil de B", async () => {
  let resolver!: (value: unknown) => void;
  m.cargar.mockReturnValueOnce(new Promise(resolve => { resolver = resolve; })).mockResolvedValueOnce({ id: "b" });
  const { result } = renderHook(useUsuarioActual);
  act(() => { m.auth.currentUser = { uid: "a", emailVerified: true }; m.callback!(m.auth.currentUser); });
  await act(async () => { m.auth.currentUser = { uid: "b", emailVerified: true }; m.callback!(m.auth.currentUser); });
  await act(async () => { resolver({ id: "a" }); });
  expect(result.current.usuario?.id).toBe("b");
});
it("una cuenta nueva sin correo verificado no carga su perfil", async () => {
  const { result } = renderHook(useUsuarioActual);
  await act(async () => { m.auth.currentUser = { uid: "nueva", emailVerified: false, metadata: { creationTime: "Wed, 25 Nov 2026 12:00:00 GMT" } }; m.callback!(m.auth.currentUser); });
  expect(m.cargar).not.toHaveBeenCalled();
  expect(result.current.usuario).toBeNull(); expect(result.current.loading).toBe(false);
});
it("una cuenta anterior a la verificación obligatoria sigue cargando su perfil", async () => {
  m.cargar.mockResolvedValue({ id: "antigua" });
  const { result } = renderHook(useUsuarioActual);
  await act(async () => { m.auth.currentUser = { uid: "antigua", emailVerified: false, metadata: { creationTime: "Mon, 02 Nov 2026 12:00:00 GMT" } }; m.callback!(m.auth.currentUser); });
  expect(result.current.usuario?.id).toBe("antigua");
});
