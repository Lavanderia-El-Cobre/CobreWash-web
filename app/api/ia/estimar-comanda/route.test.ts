import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ query: vi.fn(), verify: vi.fn() }));
vi.mock("@/lib/firebase/admin", () => ({
  serviciosAdmin: () => ({ auth: { verifyIdToken: m.verify }, db: { executeQuery: m.query } }),
}));
import { POST } from "./route";

const LAVADO = "20000000-0000-4000-8000-000000000001";
const CLORO = "10000000-0000-4000-8000-000000000001";
const modelo = {
  configuracionIa: { margenSeguridad: 0.15 },
  tasaConsumos: [{ tipoServicioId: LAVADO, insumoId: CLORO, tasaInicial: 20, tasaActual: 20, unidad: "ml" }],
  insumos: [{ id: CLORO, nombre: "Cloro", unidadMedida: "L", stockActual: 1 }],
  modeloVigente: [],
};
const pedir = (cuerpo: unknown, token = "token") => new Request("https://web.test/api/ia/estimar-comanda", {
  method: "POST",
  headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  body: typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo),
});
let rol = "recepcionista";

beforeEach(() => {
  vi.resetAllMocks();
  rol = "recepcionista";
  m.verify.mockResolvedValue({ uid: "recep", sub: "recep" });
  m.query.mockImplementation(async (op: string) => ({
    data: op === "GetModeloComandaIa" ? modelo : op === "GetMiPerfil" ? { usuario: { rol: { nombre: rol } } } : {},
  }));
});

it("exige sesión vigente y verifica rol y cuenta activa en el servidor", async () => {
  expect((await POST(pedir({ tipoServicioId: LAVADO, pesoKg: 10 }, ""))).status).toBe(401);
  m.verify.mockRejectedValueOnce(Object.assign(new Error("revocado"), { code: "auth/id-token-revoked" }));
  expect((await POST(pedir({ tipoServicioId: LAVADO, pesoKg: 10 }))).status).toBe(401);
  m.query.mockRejectedValueOnce(new Error("operario"));
  expect((await POST(pedir({ tipoServicioId: LAVADO, pesoKg: 10 }))).status).toBe(403);
  expect(m.verify).toHaveBeenCalledWith("token", true);
  expect(m.query).toHaveBeenCalledWith("GetModeloComandaIa", {}, { impersonate: { authClaims: { uid: "recep", sub: "recep" } } });
});

it("estima el consumo y oculta el stock a recepción", async () => {
  const r = await POST(pedir({ tipoServicioId: LAVADO, pesoKg: 10 }));
  expect(r.status).toBe(200);
  expect(r.headers.get("cache-control")).toContain("no-store");
  const cuerpo = await r.json();
  expect(cuerpo.sinTasas).toBe(false);
  expect(cuerpo.insumos).toHaveLength(1);
  expect(cuerpo.insumos[0]).toMatchObject({ nombre: "Cloro", unidad: "L", nivel: "ok" });
  expect(cuerpo.insumos[0].minimo).toBeLessThan(0.2);
  expect(cuerpo.insumos[0].maximo).toBeGreaterThan(0.2);
  expect(cuerpo.insumos[0]).not.toHaveProperty("stockActual");
});

it("administración ve el stock y la alerta cuando no alcanza", async () => {
  rol = "admin";
  const cuerpo = await (await POST(pedir({ tipoServicioId: LAVADO, pesoKg: 100 }))).json();
  expect(cuerpo.alerta).toBe(true);
  expect(cuerpo.insumos[0]).toMatchObject({ nivel: "insuficiente", stockActual: 1 });
});

it("avisa cuando el servicio no tiene tasas", async () => {
  const cuerpo = await (await POST(pedir({ tipoServicioId: "30000000-0000-4000-8000-000000000009", pesoKg: 5 }))).json();
  expect(cuerpo).toEqual({ insumos: [], alerta: false, sinTasas: true });
});

it.each([
  [{ tipoServicioId: "no-es-uuid", pesoKg: 5 }],
  [{ tipoServicioId: LAVADO, pesoKg: 0 }],
  [{ tipoServicioId: LAVADO, pesoKg: 10_001 }],
  [{ tipoServicioId: LAVADO, pesoKg: "5" }],
  ["{no es json"],
])("rechaza entradas inválidas sin consultar el modelo: %j", async (cuerpo) => {
  expect((await POST(pedir(cuerpo))).status).toBe(400);
  expect(m.query).not.toHaveBeenCalled();
});
