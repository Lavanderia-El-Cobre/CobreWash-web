// @vitest-environment jsdom
import { createElement } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { VERSION_PRIVACIDAD, VERSION_TERMINOS } from "@/lib/privacidad/modelo";

const m = vi.hoisted(() => ({
  push: vi.fn(), registrar: vi.fn(), ingresar: vi.fn(), resolver: vi.fn(), completar: vi.fn(), reset: vi.fn(),
  auth: { currentUser: null as null | { uid: string; reload: () => Promise<void>; emailVerified: boolean }, authStateReady: () => Promise.resolve() },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: m.push }) }));
vi.mock("next/image", () => ({ default: (props: Record<string, unknown>) => createElement("img", { alt: props.alt as string }) }));
vi.mock("firebase/auth", () => ({ signOut: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/firebase/client", () => ({ auth: m.auth, dataConnect: {} }));
vi.mock("@/lib/firebase/verificacion", () => ({ enviarVerificacion: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/firebase/auth-flows", () => ({
  registerPublicClient: m.registrar, signInAndResolveLanding: m.ingresar, resolverIngreso: m.resolver,
  completarRegistroCliente: m.completar, requestPasswordReset: m.reset,
}));
import Navbar from "./Navbar";

beforeEach(() => {
  vi.resetAllMocks();
  m.auth.currentUser = null;
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ publicada: true, version: VERSION_PRIVACIDAD }) }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.history.replaceState(null, "", "/"); });

const escribir = (placeholder: string, valor: string) => fireEvent.change(screen.getByPlaceholderText(placeholder), { target: { value: valor } });

async function abrir(ruta: string) {
  window.history.replaceState(null, "", ruta);
  render(createElement(Navbar));
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}

it("el registro exige marcar términos y autorización por separado y luego pide verificar el correo", async () => {
  m.registrar.mockResolvedValue({ email: "ana@example.com", correoEnviado: true });
  await abrir("/?login=1&registro=1");
  expect(screen.getByText("Crear cuenta de cliente")).toBeTruthy();

  escribir("Juan", "Ana"); escribir("Pérez", "Pérez"); escribir("12.345.678-9", "12.345.678-5");
  escribir("correo@ejemplo.com", "ana@example.com");
  // El teléfono trae +56 9 y solo se escriben los 8 dígitos restantes.
  fireEvent.change(screen.getByLabelText("Teléfono (opcional)"), { target: { value: "12345678" } });
  for (const campo of screen.getAllByPlaceholderText("••••••••")) fireEvent.change(campo, { target: { value: "clave123" } });
  fireEvent.click(screen.getByRole("button", { name: "Tipo de cliente" }));
  fireEvent.click(screen.getByRole("button", { name: "Particular" }));

  const registrar = screen.getByRole("button", { name: "Registrarse" }) as HTMLButtonElement;
  const [terminos, datos] = screen.getAllByRole("checkbox") as HTMLInputElement[];
  await waitFor(() => expect(terminos.disabled).toBe(false));
  expect(terminos.closest("label")?.textContent).toContain("Términos y Condiciones");
  expect(datos.closest("label")?.textContent).toContain("Autorizo expresamente");
  expect(registrar.disabled).toBe(true);
  fireEvent.click(terminos);
  expect(registrar.disabled).toBe(true);
  fireEvent.click(datos);
  expect(registrar.disabled).toBe(false);

  await act(async () => { fireEvent.click(registrar); });
  expect(m.registrar).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
    aceptaTerminos: true, versionTerminos: VERSION_TERMINOS, autorizaDatos: true, versionPrivacidad: VERSION_PRIVACIDAD, email: "ana@example.com",
    telefono: "+56 9 1234 5678",
  }));
  expect(screen.getByText("Verifica tu correo")).toBeTruthy();
  expect(await screen.findByText("ana@example.com", {}, { timeout: 3000 })).toBeTruthy();
  expect(await screen.findByRole("button", { name: "Ya verifiqué mi correo" })).toBeTruthy();
  expect(m.push).not.toHaveBeenCalled();
});

it("un ingreso sin correo verificado queda en espera y, al verificarlo, pide completar los datos", async () => {
  m.ingresar.mockResolvedValue({ tipo: "verificar", email: "ana@example.com" });
  await abrir("/?login=1");
  escribir("correo@ejemplo.com", "ana@example.com");
  fireEvent.change(screen.getByPlaceholderText("••••••••"), { target: { value: "clave123" } });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Ingresar" })); });
  expect(screen.getByText("Verifica tu correo")).toBeTruthy();
  await screen.findByRole("button", { name: "Ya verifiqué mi correo" }, { timeout: 3000 });

  m.auth.currentUser = { uid: "uid-ana", emailVerified: false, reload: vi.fn().mockResolvedValue(undefined) };
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Ya verifiqué mi correo" })); });
  expect(screen.getByRole("alert").textContent).toContain("Aún no vemos tu correo verificado");
  expect(m.resolver).not.toHaveBeenCalled();

  m.auth.currentUser.emailVerified = true;
  m.resolver.mockResolvedValue({ tipo: "completar", email: "ana@example.com" });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Ya verifiqué mi correo" })); });
  expect(screen.getByText("Termina de crear tu cuenta")).toBeTruthy();
  expect(await screen.findByText(/Correo verificado: ana@example.com/, {}, { timeout: 3000 })).toBeTruthy();
  expect(screen.queryByPlaceholderText("••••••••")).toBeNull();
  expect((screen.getByRole("button", { name: "Crear mi cuenta" }) as HTMLButtonElement).disabled).toBe(true);
});

it("si el envío del correo no se confirma, lo avisa sin mostrarlo como error", async () => {
  m.registrar.mockResolvedValue({ email: "ana@example.com", correoEnviado: false });
  await abrir("/?login=1&registro=1");
  escribir("Juan", "Ana"); escribir("Pérez", "Pérez"); escribir("12.345.678-9", "12.345.678-5");
  escribir("correo@ejemplo.com", "ana@example.com");
  for (const campo of screen.getAllByPlaceholderText("••••••••")) fireEvent.change(campo, { target: { value: "clave123" } });
  fireEvent.click(screen.getByRole("button", { name: "Tipo de cliente" }));
  fireEvent.click(screen.getByRole("button", { name: "Particular" }));
  const [terminos, datos] = screen.getAllByRole("checkbox") as HTMLInputElement[];
  await waitFor(() => expect(terminos.disabled).toBe(false));
  fireEvent.click(terminos); fireEvent.click(datos);
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Registrarse" })); });
  expect(screen.getByText("Verifica tu correo")).toBeTruthy();
  expect((await screen.findByRole("status", {}, { timeout: 3000 })).textContent).toContain("No pudimos confirmar el envío");
  expect(screen.queryByRole("alert")).toBeNull();
});

it("una cuenta con perfil entra directo a su vista", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  m.ingresar.mockResolvedValue({ tipo: "landing", ruta: "/intranet" });
  await abrir("/?login=1");
  escribir("correo@ejemplo.com", "admin@example.com");
  fireEvent.change(screen.getByPlaceholderText("••••••••"), { target: { value: "clave123" } });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Ingresar" })); });
  await act(async () => { vi.advanceTimersByTime(1500); });
  expect(m.push).toHaveBeenCalledWith("/intranet");
  vi.useRealTimers();
});
