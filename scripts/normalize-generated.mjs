/**
 * Normaliza los archivos `.js`, `.ts` y `.md` generados por Firebase Data Connect en
 * `src/dataconnect-generated` (saltos de línea LF, sin espacios finales y salto de línea al final).
 * Evita diffs ruidosos entre Windows/Linux y errores de `git diff --check` en CI.
 *
 * Invocación:
 *   node scripts/normalize-generated.mjs   # Ejecutar después de regenerar el SDK
 *
 * Variables de entorno requeridas: ninguna.
 */
import { readdir, readFile, writeFile } from "node:fs/promises";

/** Recorre recursivamente un directorio normalizando formato de archivos de texto generados. */
async function normalize(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = dir + "/" + entry.name;
    if (entry.isDirectory()) await normalize(path);
    else if (/\.(js|ts|md)$/.test(entry.name)) {
      const text = await readFile(path, "utf8");
      await writeFile(path, text.replace(/\r\n?/g, "\n").replace(/[ \t]+$/gm, "").trimEnd() + "\n");
    }
  }
}
await normalize("src/dataconnect-generated");
