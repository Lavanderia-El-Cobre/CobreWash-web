import { execFileSync } from "node:child_process";
import { expect, it } from "vitest";

it("las mutaciones móviles están al día con las originales", () => {
  // Si se cambia una mutación original, hay que regenerar: pnpm dataconnect:movil
  const salida = execFileSync(process.execPath, ["scripts/generar-mutaciones-movil.mjs", "--check"], { encoding: "utf8" });
  expect(salida).toContain("está al día");
});
