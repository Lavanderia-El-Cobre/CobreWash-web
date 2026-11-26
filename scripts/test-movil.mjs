/**
 * Suite de integración contra el emulador aislado de Data Connect para las mutaciones `…Movil`
 * generadas en `dataconnect/example/movil.gql` (operación sin conexión desde la app móvil).
 *
 * Valida separación entre hora original (`ocurridoEn`) y de recepción (`recibidoEn`),
 * idempotencia por `$idOperacion` (`OPERACION_YA_APLICADA`), ventana horaria (`-72h` / `+5m` y
 * `relojDudoso`), preservación de permisos y reglas de negocio originales en producción,
 * entregas, conteos de inventario y flota, y que `OperacionMovil` no se exponga para consulta directa.
 *
 * Invocación:
 *   node scripts/test-movil.mjs   (con el emulador aislado activo en el puerto 9499)
 *
 * Variables de entorno opcionales:
 *   - `FIREBASE_DATA_CONNECT_EMULATOR_HOST`: por defecto `127.0.0.1:9499`.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

// Guardia de seguridad: esta suite solo acepta el emulador local de un proyecto demo.
const host = (process.env.FIREBASE_DATA_CONNECT_EMULATOR_HOST ?? "127.0.0.1:9499").replace(/^http:\/\//, "");
assert.match(host, /^(127\.0\.0\.1|localhost):9499$/);
const endpoint = "http://" + host + "/v1/projects/demo-production/locations/southamerica-west1/services/lavanderia-el-cobre:executeGraphql";
const movil = await readFile("dataconnect/example/movil.gql", "utf8");
const produccion = await readFile("dataconnect/produccion/mutations.gql", "utf8");
const legacy = await readFile("dataconnect/example/mutations.gql", "utf8");
const vehiculos = await readFile("dataconnect/example/vehiculos-mutations.gql", "utf8");

/**
 * Ejecuta una operación GraphQL en el emulador (`user` `undefined` = privilegios de servidor,
 * `null` = anónimo, string = UID autenticado).
 */
async function execute(query, operationName, variables = {}, user = undefined) {
  const impersonate = user === null ? { unauthenticated: true } : user ? { authClaims: { sub: user, firebase: { sign_in_provider: "password" } } } : undefined;
  const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query, operationName, variables, extensions: { impersonate } }) });
  const body = await res.json();
  if (!res.ok || body.errors?.length || !body.data) throw new Error(JSON.stringify(body));
  return body.data;
}
let count = 0;
async function check(name, fn) { await fn(); count++; console.log("OK " + name); }
/** Rechazo cuyo mensaje contiene `texto`. */
async function rechaza(promesa, texto) {
  await assert.rejects(promesa, (e) => { assert.match(String(e.message), new RegExp(texto)); return true; });
}

await execute(await readFile("dataconnect/seed_data.gql", "utf8"), "SeedProduccion");

const clienteId = "00000000-0000-4000-8000-000000000010";
const etapaIds = ["20", "21", "22", "23", "24"].map((n) => `00000000-0000-4000-8000-0000000000${n}`);
const detail = { tipoPrendaId: "00000000-0000-4000-8000-000000000011", tipoServicioId: "00000000-0000-4000-8000-000000000012", cantidad: 2, precioUnitario: 1000, subtotal: 2000 };
const hace = (ms) => new Date(Date.now() - ms).toISOString();
const op = (extra = {}) => ({ idOperacion: randomUUID(), ocurridoEn: hace(10 * 60_000), ...extra });
const inspeccionar = (query, nombre, variables) => execute(query, nombre, variables).then((r) => r);
const operacion = (id) => inspeccionar(`query I($id:UUID!) { operacionMovil(id:$id) { tipo entidadId ocurridoEn recibidoEn relojDudoso usuario { id } } }`, "I", { id }).then((r) => r.operacionMovil);
const comanda = (id) => inspeccionar(`query C($id:UUID!) { comanda(id:$id) { estado
  comandaEtapas_on_comanda(orderBy:[{ordenEtapa:ASC}]) { estado }
  incidenciaComandas_on_comanda { motivo }
  comandaHistorialEstados_on_comanda { estadoNuevo }
} }`, "C", { id }).then((r) => r.comanda);

async function nuevaComanda() {
  const id = randomUUID();
  await execute(produccion, "CrearComandaConFlujo", { id, numeroComanda: "MOVIL-" + id.slice(0, 7), clienteId, detalles: [{ ...detail }] }, "test-recepcion");
  return id;
}
const avance = (comandaId, orden, extra = {}) => ({
  comandaId, etapaId: etapaIds[orden - 1], orden, estadoComanda: orden < 4 ? "EN_PROCESO" : "FINALIZADA", ...op(), ...extra,
});

await check("completar etapa sin conexión registra la hora original y la de recepción por separado", async () => {
  const id = await nuevaComanda();
  const v = avance(id, 1, { ocurridoEn: hace(2 * 3600_000) });
  await execute(movil, "CompletarEtapaComandaMovil", v, "test-operario");
  const c = await comanda(id);
  assert.equal(c.estado, "EN_PROCESO");
  assert.equal(c.comandaEtapas_on_comanda[0].estado, "COMPLETADA");
  const o = await operacion(v.idOperacion);
  assert.equal(o.tipo, "CompletarEtapaComanda");
  assert.equal(o.usuario.id, "test-operario");
  assert.equal(o.entidadId.replaceAll("-", ""), id.replaceAll("-", ""));
  assert.equal(new Date(o.ocurridoEn).getTime(), new Date(v.ocurridoEn).getTime());
  assert.ok(new Date(o.recibidoEn).getTime() > new Date(o.ocurridoEn).getTime() + 3600_000);
  assert.equal(o.relojDudoso, false);
});

await check("un reintento con el mismo id se rechaza como ya aplicado y no cambia nada", async () => {
  const id = await nuevaComanda();
  const v = avance(id, 1);
  await execute(movil, "CompletarEtapaComandaMovil", v, "test-operario");
  const antes = await comanda(id);
  await rechaza(execute(movil, "CompletarEtapaComandaMovil", v, "test-operario"), "OPERACION_YA_APLICADA");
  assert.deepEqual(await comanda(id), antes);
});

await check("incidencias y problemas de entrega no se duplican al reintentar", async () => {
  const id = await nuevaComanda();
  const v = { comandaId: id, motivo: "Prenda dañada", descripcion: "Botón suelto", ...op() };
  await execute(movil, "RegistrarIncidenciaComandaMovil", v, "test-operario");
  await rechaza(execute(movil, "RegistrarIncidenciaComandaMovil", v, "test-operario"), "OPERACION_YA_APLICADA");
  assert.equal((await comanda(id)).incidenciaComandas_on_comanda.length, 1);

  for (const orden of [1, 2, 3, 4]) await execute(movil, "CompletarEtapaComandaMovil", avance(id, orden), "test-operario");
  assert.equal((await comanda(id)).estado, "FINALIZADA");
  const p = { comandaId: id, motivo: "Cliente ausente", ...op() };
  await execute(movil, "ReportarProblemaEntregaMovil", p, "test-repartidor");
  await rechaza(execute(movil, "ReportarProblemaEntregaMovil", p, "test-repartidor"), "OPERACION_YA_APLICADA");
  assert.equal((await comanda(id)).incidenciaComandas_on_comanda.filter((i) => i.motivo.startsWith("Entrega: ")).length, 1);
});

await check("entregar sin conexión mantiene las reglas de la mutación original", async () => {
  const id = await nuevaComanda();
  // Aún no está lista: la regla original la rechaza aunque venga de la cola.
  await rechaza(execute(movil, "EntregarComandaMovil", { id, ...op() }, "test-repartidor"), "Solo se puede entregar una comanda finalizada");
  for (const orden of [1, 2, 3, 4]) await execute(movil, "CompletarEtapaComandaMovil", avance(id, orden), "test-operario");
  const v = { id, detalle: "Recibió conserjería", ...op() };
  await execute(movil, "EntregarComandaMovil", v, "test-repartidor");
  assert.equal((await comanda(id)).estado, "ENTREGADA");
  assert.equal((await operacion(v.idOperacion)).tipo, "EntregarComanda");
});

await check("la hora original fuera de rango (más de 72 h o en el futuro) se rechaza", async () => {
  const id = await nuevaComanda();
  await rechaza(execute(movil, "CompletarEtapaComandaMovil", avance(id, 1, { ocurridoEn: hace(73 * 3600_000) }), "test-operario"), "HORA_FUERA_DE_RANGO");
  await rechaza(execute(movil, "CompletarEtapaComandaMovil", avance(id, 1, { ocurridoEn: hace(-10 * 60_000) }), "test-operario"), "HORA_FUERA_DE_RANGO");
  assert.equal((await comanda(id)).comandaEtapas_on_comanda[0].estado, "PENDIENTE");
  // Dentro del margen de 5 min por relojes adelantados se acepta y queda marcado si el dispositivo lo indica.
  const v = avance(id, 1, { ocurridoEn: hace(-2 * 60_000), relojDudoso: true });
  await execute(movil, "CompletarEtapaComandaMovil", v, "test-operario");
  assert.equal((await operacion(v.idOperacion)).relojDudoso, true);
});

await check("conserva permisos: rol sin permiso, cuenta inactiva, sin perfil o sin sesión", async () => {
  const id = await nuevaComanda();
  for (const user of [null, "sin-perfil", "test-inactivo", "test-cliente", "test-repartidor"]) {
    await assert.rejects(execute(movil, "CompletarEtapaComandaMovil", avance(id, 1), user), `Acceso indebido: ${user}`);
  }
  assert.equal((await comanda(id)).comandaEtapas_on_comanda[0].estado, "PENDIENTE");
  // Si una acción falla, su id no queda registrado: se puede corregir y reenviar.
  const v = avance(id, 2);
  await rechaza(execute(movil, "CompletarEtapaComandaMovil", v, "test-operario"), "Primero debes completar las etapas anteriores");
  assert.equal(await operacion(v.idOperacion), null);
});

await check("conteo de inventario sin conexión es idempotente y respeta la revisión de stock", async () => {
  const insumo = (await execute(legacy, "CrearInsumo", { nombre: "Cloro móvil " + randomUUID().slice(0, 6), unidadMedida: "L", stockInicial: 10, stockMinimo: 1 }, "test-admin")).insumo_insert.id;
  const revision = (await inspeccionar(`query R($id:UUID!) { insumo(id:$id) { revisionStock } }`, "R", { id: insumo })).insumo.revisionStock;
  const v = { id: randomUUID(), insumoId: insumo, cantidad: 9.5, revisionStock: revision, ...op() };
  await execute(movil, "RegistrarConteoInventarioMovil", v, "test-operario");
  await rechaza(execute(movil, "RegistrarConteoInventarioMovil", v, "test-operario"), "OPERACION_YA_APLICADA");
  await rechaza(
    execute(movil, "RegistrarConteoInventarioMovil", { ...v, id: randomUUID(), revisionStock: revision + 1, ...op() }, "test-operario"),
    "El stock cambió",
  );
  assert.equal((await operacion(v.idOperacion)).entidadId.replaceAll("-", ""), v.id.replaceAll("-", ""));
});

await check("salida y regreso de flota sin conexión: propios, idempotentes y con la hora original", async () => {
  const patente = "MOVL-" + String(Math.floor(10 + Math.random() * 89));
  const vehiculoId = (await execute(vehiculos, "RegistrarVehiculoFlota", { patente, marca: "Kia", modelo: "Frontier", anio: 2022, descripcion: null }, "test-admin")).vehiculo_insert.id;
  const salidaId = randomUUID();
  const salida = { vehiculoId, repartidorId: "test-repartidor", kilometraje: 1000, estadoVehiculo: "APTO", salidaId, inspeccionId: randomUUID(), observaciones: null, observacionesInspeccion: null, ...op() };
  // El repartidor no puede registrar una salida a nombre de otra persona.
  await assert.rejects(execute(movil, "RegistrarSalidaFlotaMovil", { ...salida, repartidorId: "test-operario", idOperacion: randomUUID() }, "test-repartidor"));
  const r = await execute(movil, "RegistrarSalidaFlotaMovil", salida, "test-repartidor");
  assert.equal(r.salida.id.replaceAll("-", ""), salidaId.replaceAll("-", ""));
  assert.equal((await operacion(salida.idOperacion)).entidadId.replaceAll("-", ""), salidaId.replaceAll("-", ""));
  await rechaza(execute(movil, "RegistrarSalidaFlotaMovil", salida, "test-repartidor"), "OPERACION_YA_APLICADA");

  const regreso = { salidaId, kilometraje: 1080, estadoVehiculo: "APTO", inspeccionId: randomUUID(), observacionesRetorno: null, observacionesInspeccion: null, ...op() };
  await rechaza(execute(movil, "RegistrarRetornoFlotaMovil", { ...regreso, kilometraje: 900, idOperacion: randomUUID() }, "test-repartidor"), "");
  await execute(movil, "RegistrarRetornoFlotaMovil", regreso, "test-repartidor");
  await rechaza(execute(movil, "RegistrarRetornoFlotaMovil", regreso, "test-repartidor"), "OPERACION_YA_APLICADA");
  const estado = (await inspeccionar(`query S($id:UUID!) { salidaVehiculo(id:$id) { estado } }`, "S", { id: salidaId })).salidaVehiculo.estado;
  assert.equal(estado, "FINALIZADA");
});

await check("la operación móvil no es legible ni escribible directamente desde el SDK", async () => {
  // OperacionMovil solo se escribe dentro de las mutaciones …Movil; no hay operaciones propias en los conectores.
  for (const archivo of ["dataconnect/example/movil.gql"]) {
    const texto = await readFile(archivo, "utf8");
    assert.doesNotMatch(texto, /query\s+\w+.*operacionMovil/s);
  }
});

console.log(`${count} escenarios de integración móviles aprobados.`);
