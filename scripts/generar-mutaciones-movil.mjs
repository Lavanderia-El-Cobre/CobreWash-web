/**
 * Genera `dataconnect/example/movil.gql` con variantes `…Movil` de las mutaciones que
 * la app móvil puede encolar sin conexión.
 *
 * Cada variante conserva la lógica y permisos de la mutación original y agrega:
 * - `$idOperacion` (UUID generado en el dispositivo), `$ocurridoEn` (hora original) y `$relojDudoso`;
 * - rechazo `OPERACION_YA_APLICADA` para garantizar idempotencia ante reintentos;
 * - rechazo `HORA_FUERA_DE_RANGO` si la marca temporal supera 72 h de atraso o 5 min de adelanto;
 * - registro de trazabilidad en `OperacionMovil` dentro de la misma transacción.
 *
 * Las mutaciones originales no se modifican para mantener compatibilidad con apps instaladas.
 *
 * Invocación:
 *   node scripts/generar-mutaciones-movil.mjs           # Regenera el archivo
 *   node scripts/generar-mutaciones-movil.mjs --check   # Verifica en CI que esté al día
 *
 * Variables de entorno requeridas: ninguna.
 */
import { readFile, writeFile } from "node:fs/promises";

const DESTINO = "dataconnect/example/movil.gql";
const MAX_ATRASO = "72h";
const MAX_ADELANTO = "5m";

/** Tuplas `[nombreMutacion, archivoFuente, expresionIdEntidad]` a transformar. */
const OPERACIONES = [
  ["CompletarEtapaComanda", "dataconnect/example/produccion-mutations.gql", "vars.comandaId"],
  ["RegistrarIncidenciaComanda", "dataconnect/example/produccion-mutations.gql", "vars.comandaId"],
  ["EntregarComanda", "dataconnect/example/mutations.gql", "vars.id"],
  ["ReportarProblemaEntrega", "dataconnect/example/mutations.gql", "vars.comandaId"],
  ["RegistrarSalidaFlota", "dataconnect/example/vehiculos-mutations.gql", "response.salida.id"],
  ["RegistrarRetornoFlota", "dataconnect/example/vehiculos-mutations.gql", "vars.salidaId"],
  ["RegistrarConteoInventario", "dataconnect/example/inventario-conteos.gql", "vars.id"],
];

/** Extrae el bloque completo `mutation <nombre> ... }` desde un archivo `.gql`. */
function extraer(texto, nombre) {
  const inicio = texto.search(new RegExp(`^mutation ${nombre}[ (]`, "m"));
  if (inicio < 0) throw new Error(`No se encontró la mutación ${nombre}`);
  const fin = texto.indexOf("\n}", inicio);
  return texto.slice(inicio, fin + 2);
}

/** Posición de la primera "{" fuera de paréntesis desde `desde`. */
function llaveDeBloque(texto, desde) {
  let profundidad = 0;
  for (let i = desde; i < texto.length; i++) {
    const c = texto[i];
    if (c === "(") profundidad++;
    else if (c === ")") profundidad--;
    else if (c === "{" && profundidad === 0) return i;
  }
  throw new Error("Bloque sin llave de apertura");
}

/**
 * Construye la variante `<nombre>Movil` inyectando variables, controles `@check`
 * de idempotencia/ventana horaria y el `operacionMovil_insert` final.
 */
function variante(original, nombre, entidad) {
  let m = original.replace(new RegExp(`^mutation ${nombre}`), `mutation ${nombre}Movil`);
  const vars = "\n  $idOperacion: UUID!\n  $ocurridoEn: Timestamp!\n  $relojDudoso: Boolean! = false";
  const abre = m.indexOf("(");
  const cierraVars = m.indexOf(")", abre);
  // Variables en una línea ($a: X, $b: Y) o en varias: se agregan al final de la lista.
  const lista = m.slice(abre + 1, cierraVars).replace(/\s+$/, "");
  m = m.slice(0, abre + 1) + lista + (lista.includes("\n") ? "" : ",") + vars + "\n" + m.slice(cierraVars);
  const query = m.indexOf("query @redact");
  if (query < 0) throw new Error(`${nombre} no tiene bloque query @redact`);
  const llave = llaveDeBloque(m, query);
  const controles = `
    operacionPrevia: operacionMovil(id: $idOperacion) @check(expr: "this == null", message: "OPERACION_YA_APLICADA") { id }
    horaAccion: operacionMovil(id: $idOperacion)
      @check(expr: "vars.ocurridoEn >= request.time - duration('${MAX_ATRASO}') && vars.ocurridoEn <= request.time + duration('${MAX_ADELANTO}')", message: "HORA_FUERA_DE_RANGO") { id }`;
  m = m.slice(0, llave + 1) + controles + m.slice(llave + 1);
  const registro = `
  operacion: operacionMovil_insert(data: {
    id: $idOperacion
    usuarioId_expr: "auth.uid"
    tipo: "${nombre}"
    entidadId_expr: "${entidad}"
    ocurridoEn: $ocurridoEn
    relojDudoso: $relojDudoso
  })
}`;
  return m.replace(/\n}$/, registro);
}

const encabezado = `# GENERADO por scripts/generar-mutaciones-movil.mjs — no editar a mano.
# Variantes de las mutaciones que la app móvil puede enviar después de trabajar sin
# conexión: misma lógica y permisos que la original, más idempotencia por
# $idOperacion y la hora original de la acción ($ocurridoEn), guardadas en
# OperacionMovil junto con la hora de recepción del servidor.
`;

const archivos = new Map();
const partes = [];
for (const [nombre, archivo, entidad] of OPERACIONES) {
  if (!archivos.has(archivo)) archivos.set(archivo, await readFile(archivo, "utf8"));
  partes.push(variante(extraer(archivos.get(archivo).replaceAll("\r\n", "\n"), nombre), nombre, entidad));
}
// Sin espacios al final de línea: el CI rechaza los "trailing whitespace" (git diff --check).
const salida = (encabezado + "\n" + partes.join("\n\n") + "\n").replace(/[ \t]+$/gm, "");

if (process.argv.includes("--check")) {
  const actual = (await readFile(DESTINO, "utf8").catch(() => "")).replaceAll("\r\n", "\n");
  if (actual !== salida) {
    console.error(`${DESTINO} no está al día. Ejecuta: node scripts/generar-mutaciones-movil.mjs`);
    process.exit(1);
  }
  console.log(`${DESTINO} está al día.`);
} else {
  await writeFile(DESTINO, salida);
  console.log(`Generado ${DESTINO} (${OPERACIONES.length} mutaciones).`);
}
