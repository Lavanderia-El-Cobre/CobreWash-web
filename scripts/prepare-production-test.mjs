/**
 * Prepara una copia aislada de la configuración y esquemas `.gql` de Data Connect en
 * `scratch/production-test` para levantar el emulador de pruebas en el puerto `9499`
 * sin interferir con el entorno de desarrollo ni tocar conectores reales.
 *
 * Invocación:
 *   node scripts/prepare-production-test.mjs                 # Solo emulador aislado
 *   node scripts/prepare-production-test.mjs --sdk           # Habilita regeneración de SDK JS/React
 *   node scripts/prepare-production-test.mjs --sdk --android-sdk  # Incluye SDK Kotlin para la app móvil
 *
 * Variables de entorno requeridas: ninguna.
 */
import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
const root = resolve("scratch/production-test");
const generarSdk = process.argv.includes("--sdk");
const generarAndroid = process.argv.includes("--android-sdk");
for (const dir of ["schema", "example", "produccion"]) {
  await mkdir(root + "/dataconnect/" + dir, {recursive:true});
  for (const file of await readdir("dataconnect/" + dir)) {
    if (file.endsWith(".gql")) await writeFile(root + "/dataconnect/" + dir + "/" + file, await readFile("dataconnect/" + dir + "/" + file));
  }
  if (dir !== "schema") {
    const config = dir === "example" && generarSdk
      ? "connectorId: example\ngenerate:\n  javascriptSdk:\n    - outputDir: " + JSON.stringify(resolve("src/dataconnect-generated")) + "\n      package: \"@dataconnect/generated\"\n      packageJsonDir: " + JSON.stringify(resolve(".")) + "\n      react: true\n      angular: false\n"
      : "connectorId: " + dir + "\n";
    const kotlin = generarAndroid && dir === "example" ? "  kotlinSdk:\n    - outputDir: " + JSON.stringify(resolve("../CobreWash-App/shared/dataconnect-generated")) + "\n      package: com.elcobre.lavanderiaelcobre.dataconnect\n" : "";
    await writeFile(root + "/dataconnect/" + dir + "/connector.yaml", config + kotlin);
  }
}
await writeFile(root + "/dataconnect/dataconnect.yaml", await readFile("dataconnect/dataconnect.yaml"));
// Puertos dedicados (9499/4501/4601) para no colisionar con el emulador local estándar.
await writeFile(root + "/firebase.json", JSON.stringify({dataconnect:{source:"dataconnect"},emulators:{dataconnect:{port:9499},hub:{port:4501},logging:{port:4601},ui:{enabled:false},singleProjectMode:true}},null,2));
console.log("Emulador aislado preparado en " + root);
