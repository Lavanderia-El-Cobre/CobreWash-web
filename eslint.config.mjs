/**
 * Configuración flat de ESLint basada en los presets de Next.js (Core Web Vitals y TypeScript).
 */
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Sobrescribe las exclusiones predeterminadas de eslint-config-next.
  globalIgnores([
    // Exclusiones predeterminadas de eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Código generado por `firebase dataconnect:sdk:generate`, no escrito a mano.
    "src/dataconnect-generated/**",
    // Artefactos locales de migración y depuración fuera del código de la aplicación.
    "scratch/**",
    // Worktrees locales: copias del repo con su propio estado.
    ".claude/**",
  ]),
]);

export default eslintConfig;
