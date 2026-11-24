import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ verify: vi.fn(), query: vi.fn() }));
vi.mock("@/lib/firebase/admin", () => ({ serviciosAdmin: () => ({ auth: { verifyIdToken: m.verify }, db: { executeQuery: m.query } }) }));
import { autorizarAdministrador, errorPrivacidad } from "./servidor";

const request = () => new Request("https://web.test/api/privacidad/gestion", { headers: { Authorization: "Bearer token" } });
const estado = async () => { try { await autorizarAdministrador(request()); return 200; } catch (e) { return errorPrivacidad(e).status; } };
beforeEach(() => {
  vi.resetAllMocks();
  m.verify.mockResolvedValue({ uid: "admin" });
  m.query.mockResolvedValue({ data: {} });
});
it("autoriza al administrador con la sesión revisada contra revocación", async () => {
  await expect(autorizarAdministrador(request())).resolves.toMatchObject({ uid: "admin" });
  expect(m.verify).toHaveBeenCalledWith("token", true);
  expect(m.query).toHaveBeenCalledWith("AutorizarGestionPrivacidad", {}, { impersonate: { authClaims: { uid: "admin" } } });
});
it("responde 401 solo cuando el token venció o fue revocado", async () => {
  m.verify.mockRejectedValueOnce(Object.assign(new Error("x"), { code: "auth/id-token-revoked" }));
  expect(await estado()).toBe(401);
});
it("responde 503 cuando el SDK Admin no tiene credenciales válidas", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  m.verify.mockRejectedValueOnce(Object.assign(new Error("x"), { code: "app/invalid-credential" }));
  expect(await estado()).toBe(503);
  expect(m.query).not.toHaveBeenCalled();
});
it("responde 403 si el perfil no es administrador activo", async () => {
  m.query.mockRejectedValueOnce(new Error("check"));
  expect(await estado()).toBe(403);
});
