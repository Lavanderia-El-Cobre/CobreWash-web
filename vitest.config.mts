import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    // Los worktrees locales (.claude/worktrees) y scratch/ son copias o archivos
    // de trabajo fuera del proyecto: sus pruebas no deben ejecutarse aquí.
    exclude: [...configDefaults.exclude, ".claude/**", "scratch/**"],
    clearMocks: true,
    restoreMocks: true,
  },
});
