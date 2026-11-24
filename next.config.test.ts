import { describe, expect, it } from "vitest";
import nextConfig from "./next.config";

async function connectSrc() {
  const reglas = await nextConfig.headers!();
  const csp = reglas.flatMap((r) => r.headers).find((h) => h.key === "Content-Security-Policy")!.value;
  return csp.split(";").map((d) => d.trim()).find((d) => d.startsWith("connect-src"))!.split(/\s+/).slice(1);
}

describe("Content-Security-Policy", () => {
  it("permite el WebSocket de Data Connect que usa subscribe() en tiempo real", async () => {
    expect(await connectSrc()).toContain("wss://firebasedataconnect.googleapis.com");
  });
  it("no abre WebSocket a hosts arbitrarios", async () => {
    const fuentes = await connectSrc();
    expect(fuentes.filter((f) => f.startsWith("wss:") || f.startsWith("ws:"))).toEqual(["wss://firebasedataconnect.googleapis.com"]);
    expect(fuentes).not.toContain("*");
  });
});
