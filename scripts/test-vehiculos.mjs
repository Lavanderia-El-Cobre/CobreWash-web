import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

// Pruebas de integración en el emulador aislado de Data Connect (Sprint 08 - Vehículos).
const host = (process.env.FIREBASE_DATA_CONNECT_EMULATOR_HOST ?? "127.0.0.1:9499").replace(/^http:\/\//, "");
assert.match(host, /^(127\.0\.0\.1|localhost):9499$/);
const endpoint = `http://${host}/v1/projects/demo-production/locations/southamerica-west1/services/lavanderia-el-cobre:executeGraphql`;

const queries = await readFile("dataconnect/example/vehiculos-queries.gql", "utf8");
const mutations = await readFile("dataconnect/example/vehiculos-mutations.gql", "utf8");
const evidencias = await readFile("dataconnect/example/evidencias.gql", "utf8");

async function execute(query, operationName, variables = {}, user = undefined) {
  const impersonate =
    user === null
      ? { unauthenticated: true }
      : user
        ? { authClaims: { sub: user, firebase: { sign_in_provider: "password" } } }
        : undefined;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, operationName, variables, extensions: { impersonate } }),
  });
  const body = await res.json();
  if (!res.ok || body.errors?.length || !body.data) {
    throw new Error(JSON.stringify(body));
  }
  return body.data;
}

let count = 0;
async function check(name, fn) {
  await fn();
  count++;
  console.log("OK " + name);
}

// Simula las dos fases de la API; una confirmación sin reserva no crea filas.
async function guardarEvidencia(variables) {
  await execute(evidencias, "RegistrarEvidenciaGuardada", { ...variables, confirmar: false });
  return execute(evidencias, "RegistrarEvidenciaGuardada", { ...variables, confirmar: true });
}

await execute(await readFile("dataconnect/seed_data.gql", "utf8"), "SeedProduccion");

const patente = "HLRT-" + String(Math.floor(10 + Math.random() * 89));
let vehiculoId = "";
let salidaId = "";
let inspeccionAntesId = "";
let inspeccionDespuesId = "";

await check("RF-VE01: registra vehículo en la flota y rechaza patentes duplicadas o inválidas", async () => {
  const creado = await execute(
    mutations,
    "RegistrarVehiculoFlota",
    {
      patente,
      marca: "Peugeot",
      modelo: "Partner Maxi",
      anio: 2023,
      descripcion: "Furgón reparto hotelero",
    },
    "test-admin",
  );
  vehiculoId = creado.vehiculo_insert.id;
  assert.ok(vehiculoId);

  // Rechaza patente duplicada
  await assert.rejects(
    execute(
      mutations,
      "RegistrarVehiculoFlota",
      {
        patente,
        marca: "Hyundai",
        modelo: "H-100",
        anio: 2022,
        descripcion: "Duplicado",
      },
      "test-admin",
    ),
  );

  // Rechaza patente inválida (minúscula o corta)
  await assert.rejects(
    execute(
      mutations,
      "RegistrarVehiculoFlota",
      {
        patente: "abc",
        marca: "Hyundai",
        modelo: "H-100",
        anio: 2022,
        descripcion: "Inválido",
      },
      "test-admin",
    ),
  );
});

await check("RF-VE02: registra salida con inspección inicial, adjunta fotos y bloquea NO_APTO, rol no conductor o doble salida", async () => {
  // Rechaza salida si estadoVehiculo es NO_APTO
  await assert.rejects(
    execute(
      mutations,
      "RegistrarSalidaFlota",
      {
        vehiculoId,
        repartidorId: "test-repartidor",
        kilometraje: 15200,
        estadoVehiculo: "NO_APTO",
        observaciones: "Falla de frenos",
        observacionesInspeccion: "No apto para circular",
      },
      "test-admin",
    ),
  );

  // Rechaza asignar un usuario cuyo rol no sea conductor o repartidor
  await assert.rejects(
    execute(
      mutations,
      "RegistrarSalidaFlota",
      {
        vehiculoId,
        repartidorId: "test-operario",
        kilometraje: 15200,
        estadoVehiculo: "APTO",
      },
      "test-admin",
    ),
  );

  const salida = await execute(
    mutations,
    "RegistrarSalidaFlota",
    {
      vehiculoId,
      repartidorId: "test-repartidor",
      kilometraje: 15200,
      estadoVehiculo: "APTO",
      observaciones: "Ruta Hotelera Calama",
      observacionesInspeccion: "Neumáticos y luces OK",
    },
    "test-admin",
  );
  salidaId = salida.salida.id;
  inspeccionAntesId = salida.inspeccion.id;
  assert.ok(salidaId);
  assert.ok(inspeccionAntesId);

  // El cliente no puede insertar metadatos sin que la API confirme el archivo.
  await assert.rejects(execute(
    mutations,
    "AdjuntarFotoInspeccionFlota",
    {
      inspeccionId: inspeccionAntesId,
      rutaStorage: `vehiculos/${patente}/antes-${randomUUID()}.jpg`,
      descripcion: "Vista frontal antes de salir",
      orden: 1,
    },
    "test-admin",
  ));
  await guardarEvidencia({
    id: randomUUID(), inspeccionId: inspeccionAntesId,
    rutaStorage: "fixture-servidor/antes.jpg", descripcion: "Vista frontal", orden: 1,
  });

  // Impide registrar una segunda salida simultánea para el mismo vehículo
  await assert.rejects(
    execute(
      mutations,
      "RegistrarSalidaFlota",
      {
        vehiculoId,
        repartidorId: "test-conductor",
        kilometraje: 15210,
        estadoVehiculo: "APTO",
      },
      "test-admin",
    ),
  );

  // Impide desactivar un vehículo mientras está en ruta
  await assert.rejects(
    execute(
      mutations,
      "EditarVehiculoFlota",
      {
        id: vehiculoId,
        patente,
        marca: "Peugeot",
        modelo: "Partner Maxi",
        anio: 2023,
        descripcion: "En ruta",
        activo: false,
      },
      "test-admin",
    ),
  );
});

await check("RF-VE03: valida odómetro no decreciente al regresar y cierra la salida con evidencia", async () => {
  // Rechaza kilometraje menor al de salida (15200)
  await assert.rejects(
    execute(
      mutations,
      "RegistrarRetornoFlota",
      {
        salidaId,
        kilometraje: 15199.5,
        estadoVehiculo: "APTO",
        observacionesRetorno: "Retorno inválido",
      },
      "test-admin",
    ),
  );

  const retorno = await execute(
    mutations,
    "RegistrarRetornoFlota",
    {
      salidaId,
      kilometraje: 15268.5,
      estadoVehiculo: "CON_OBSERVACIONES",
      observacionesRetorno: "Entrega completada en 4 hoteles",
      observacionesInspeccion: "Leve barro en tapabarros trasero",
    },
    "test-admin",
  );
  inspeccionDespuesId = retorno.inspeccion.id;
  assert.ok(inspeccionDespuesId);

  await guardarEvidencia(
    {
      id: randomUUID(),
      inspeccionId: inspeccionDespuesId,
      rutaStorage: `vehiculos/${patente}/despues-${randomUUID()}.jpg`,
      descripcion: "Vista trasera al retornar",
      orden: 1,
    },
  );

  // Rechaza cerrar una salida que ya está FINALIZADA
  await assert.rejects(
    execute(
      mutations,
      "RegistrarRetornoFlota",
      {
        salidaId,
        kilometraje: 15300,
        estadoVehiculo: "APTO",
      },
      "test-admin",
    ),
  );
});

await check("RF-VE04: consulta historial completo con inspecciones ANTES/DESPUES, fotos y odómetro", async () => {
  const flota = await execute(queries, "GetFlotaVehiculos", {}, "test-admin");
  const encontrado = flota.vehiculos.find((v) => v.id === vehiculoId);
  assert.ok(encontrado);
  assert.equal(encontrado.patente, patente);
  assert.ok(
    flota.conductores.length >= 2 &&
      flota.conductores.every((c) => ["conductor", "repartidor"].includes(c.rol.nombre)),
  );
  // La web envía ambos parámetros; el conector debe aceptarlos antes de cargar el historial.
  for (const offset of [0, 1, flota.salidas.length]) {
    const pagina = await execute(queries, "GetFlotaVehiculos", { limit: 1, offset }, "test-admin");
    assert.deepEqual(pagina.salidas.map(s => s.id), flota.salidas.slice(offset, offset + 1).map(s => s.id));
    assert.deepEqual(pagina.vehiculos, flota.vehiculos);
  }

  const hist = await execute(
    queries,
    "GetHistorialVehiculos",
    { vehiculoId, estado: "FINALIZADA" },
    "test-admin",
  );
  assert.equal(hist.salidas.length, 1);
  const registro = hist.salidas[0];
  assert.equal(registro.estado, "FINALIZADA");
  assert.equal(registro.repartidor.id, "test-repartidor");
  assert.equal(registro.inspecciones.length, 2);

  const antes = registro.inspecciones.find((i) => i.momento === "ANTES");
  const despues = registro.inspecciones.find((i) => i.momento === "DESPUES");
  assert.equal(antes.kilometraje, 15200);
  assert.equal(antes.fotos.length, 1);
  assert.equal(despues.kilometraje, 15268.5);
  assert.equal(despues.estadoVehiculo, "CON_OBSERVACIONES");
  assert.equal(despues.fotos.length, 1);
});

// ===================== Sección del repartidor =====================
// La web envía siempre los opcionales; la CEL de las mutaciones los compara con null.
const SIN_OBS = { observaciones: null, observacionesInspeccion: null };
const SIN_OBS_RETORNO = { observacionesRetorno: null, observacionesInspeccion: null };
const crearVehiculo = async (p) =>
  (await execute(mutations, "RegistrarVehiculoFlota", { patente: p, marca: "Hyundai", modelo: "H-100", anio: 2022, descripcion: null }, "test-admin")).vehiculo_insert.id;
const sufijo = () => String(Math.floor(10 + Math.random() * 89));
const vehiculoRepartoId = await crearVehiculo("RPTO-" + sufijo());
const segundoVehiculoId = await crearVehiculo("RPTB-" + sufijo());
let salidaRepartoId = "";
let inspeccionRepartoId = "";

await check("el panel de reparto solo lo abren repartidores activos y muestra disponibilidad y último kilometraje", async () => {
  for (const user of [null, "test-admin", "test-recepcion", "test-operario", "test-cliente", "test-inactivo", "sin-perfil"]) {
    await assert.rejects(execute(queries, "GetPanelRepartidor", {}, user), undefined, `Acceso indebido: ${user}`);
  }
  for (const user of ["test-repartidor", "test-conductor"]) {
    const panel = await execute(queries, "GetPanelRepartidor", {}, user);
    const vehiculo = panel.vehiculos.find((v) => v.id === vehiculoId);
    assert.equal(vehiculo.enCurso.length, 0);
    assert.equal(Math.max(...vehiculo.recientes.flatMap((s) => s.inspecciones.map((i) => i.kilometraje))), 15268.5);
    assert(panel.misSalidas.every((s) => user === "test-repartidor" || s.id !== salidaId));
  }
  const propio = await execute(queries, "GetPanelRepartidor", {}, "test-repartidor");
  assert.equal(propio.misSalidas.find((s) => s.id === salidaId).inspecciones.length, 2);
  const ajeno = await execute(queries, "GetPanelRepartidor", {}, "test-conductor");
  assert.equal(ajeno.misSalidas.find((s) => s.id === salidaId), undefined);
});

await check("el repartidor registra su propia salida, no la de otro ni dos vehículos a la vez", async () => {
  await assert.rejects(execute(mutations, "RegistrarSalidaFlota", { ...SIN_OBS,
    vehiculoId: vehiculoRepartoId, repartidorId: "test-conductor", kilometraje: 100, estadoVehiculo: "APTO",
  }, "test-repartidor"), /propio repartidor/);
  for (const user of ["test-operario", "test-recepcion", "test-cliente", "test-inactivo"]) {
    await assert.rejects(execute(mutations, "RegistrarSalidaFlota", { ...SIN_OBS,
      vehiculoId: vehiculoRepartoId, repartidorId: user, kilometraje: 100, estadoVehiculo: "APTO",
    }, user));
  }
  await assert.rejects(execute(mutations, "RegistrarSalidaFlota", { ...SIN_OBS,
    vehiculoId: vehiculoRepartoId, repartidorId: "test-repartidor", kilometraje: 100, estadoVehiculo: "NO_APTO",
  }, "test-repartidor"), /NO_APTO/);
  const salida = await execute(mutations, "RegistrarSalidaFlota", { ...SIN_OBS,
    salidaId: randomUUID(), inspeccionId: randomUUID(),
    vehiculoId: vehiculoRepartoId, repartidorId: "test-repartidor", kilometraje: 120.5,
    estadoVehiculo: "CON_OBSERVACIONES", observaciones: "Ruta hoteles centro", observacionesInspeccion: "Rayón puerta trasera",
  }, "test-repartidor");
  salidaRepartoId = salida.salida.id;
  inspeccionRepartoId = salida.inspeccion.id;
  await assert.rejects(execute(mutations, "RegistrarSalidaFlota", { ...SIN_OBS,
    vehiculoId: segundoVehiculoId, repartidorId: "test-repartidor", kilometraje: 0, estadoVehiculo: "APTO",
  }, "test-repartidor"), /Ya tienes un vehículo en ruta/);
  // Otro repartidor no puede tomar un vehículo que ya está en ruta.
  await assert.rejects(execute(mutations, "RegistrarSalidaFlota", { ...SIN_OBS,
    vehiculoId: vehiculoRepartoId, repartidorId: "test-conductor", kilometraje: 130, estadoVehiculo: "APTO",
  }, "test-conductor"), /en ruta|salida activa/);
  const panel = await execute(queries, "GetPanelRepartidor", {}, "test-conductor");
  const enRuta = panel.vehiculos.find((v) => v.id === vehiculoRepartoId);
  assert.equal(enRuta.enCurso[0].repartidor.id, "test-repartidor");
  assert.equal(enRuta.enCurso[0].estado, "EN_SERVICIO");
});

await check("la evidencia y la confirmación de un movimiento quedan acotadas al repartidor de la salida", async () => {
  const confirmado = await execute(evidencias, "GetMovimientoFlotaPorInspeccion", { id: inspeccionRepartoId }, "test-repartidor");
  assert.equal(confirmado.inspeccionVehiculo.salidaId, salidaRepartoId);
  assert.equal(confirmado.inspeccionVehiculo.salida, undefined);
  assert.equal((await execute(evidencias, "GetMovimientoFlotaPorInspeccion", { id: randomUUID() }, "test-repartidor")).inspeccionVehiculo, null);
  await execute(evidencias, "GetMovimientoFlotaPorInspeccion", { id: inspeccionRepartoId }, "test-admin");
  for (const user of ["test-conductor", "test-operario", "test-cliente", null]) {
    await assert.rejects(execute(evidencias, "GetMovimientoFlotaPorInspeccion", { id: inspeccionRepartoId }, user));
    await assert.rejects(execute(evidencias, "GetInspeccionParaEvidencias", { id: inspeccionRepartoId }, user));
  }
  await execute(evidencias, "GetInspeccionParaEvidencias", { id: inspeccionRepartoId }, "test-repartidor");
  await guardarEvidencia({ id: randomUUID(), inspeccionId: inspeccionRepartoId, rutaStorage: `fixture-servidor/${randomUUID()}.jpg`, descripcion: "Rayón", orden: 1 });
});

await check("solo el repartidor de la salida (o administración) registra el regreso", async () => {
  await assert.rejects(execute(mutations, "RegistrarRetornoFlota", { ...SIN_OBS_RETORNO,
    salidaId: salidaRepartoId, kilometraje: 180, estadoVehiculo: "APTO",
  }, "test-conductor"), /no está registrada a tu nombre/);
  await assert.rejects(execute(mutations, "RegistrarRetornoFlota", { ...SIN_OBS_RETORNO,
    salidaId: salidaRepartoId, kilometraje: 180, estadoVehiculo: "APTO",
  }, "test-operario"), /Solo administración/);
  await assert.rejects(execute(mutations, "RegistrarRetornoFlota", { ...SIN_OBS_RETORNO,
    salidaId: salidaRepartoId, kilometraje: 100, estadoVehiculo: "APTO",
  }, "test-repartidor"), /no puede ser menor/);
  const retorno = await execute(mutations, "RegistrarRetornoFlota", { ...SIN_OBS_RETORNO,
    inspeccionId: randomUUID(), salidaId: salidaRepartoId, kilometraje: 185.3, estadoVehiculo: "APTO",
    observacionesRetorno: "Ruta hoteles centro: 5 entregas", observacionesInspeccion: "Sin novedades",
  }, "test-repartidor");
  assert.ok(retorno.inspeccion.id);
  const panel = await execute(queries, "GetPanelRepartidor", {}, "test-repartidor");
  const cerrada = panel.misSalidas.find((s) => s.id === salidaRepartoId);
  assert.equal(cerrada.estado, "FINALIZADA");
  assert.equal(cerrada.observaciones, "Ruta hoteles centro: 5 entregas");
  assert.deepEqual(cerrada.inspecciones.map((i) => [i.momento, i.kilometraje, i.fotos.length]), [["ANTES", 120.5, 1], ["DESPUES", 185.3, 0]]);
  assert.equal(panel.vehiculos.find((v) => v.id === vehiculoRepartoId).enCurso.length, 0);
  // Liberado el vehículo, puede tomar otro; el historial de administración lo ve completo.
  const otra = await execute(mutations, "RegistrarSalidaFlota", { ...SIN_OBS,
    vehiculoId: segundoVehiculoId, repartidorId: "test-repartidor", kilometraje: 0, estadoVehiculo: "APTO",
  }, "test-repartidor");
  await execute(mutations, "RegistrarRetornoFlota", { ...SIN_OBS_RETORNO, salidaId: otra.salida.id, kilometraje: 12, estadoVehiculo: "APTO" }, "test-admin");
  const hist = await execute(queries, "GetHistorialVehiculos", { repartidorId: "test-repartidor", vehiculoId: vehiculoRepartoId }, "test-admin");
  assert.equal(hist.salidas.length, 1);
  assert.equal(hist.salidas[0].inspecciones.length, 2);
});

await check("restringe todas las consultas y mutaciones de flota exclusivamente a administradores activos", async () => {
  for (const user of [null, "test-recepcion", "test-operario", "test-cliente", "test-inactivo", "sin-perfil", "test-repartidor", "test-conductor"]) {
    await assert.rejects(execute(queries, "GetFlotaVehiculos", { limit: 200, offset: 0 }, user));
    await assert.rejects(execute(queries, "GetHistorialVehiculos", {}, user));
    await assert.rejects(
      execute(
        mutations,
        "RegistrarVehiculoFlota",
        { patente: "ZZZZ-99", marca: "Ford", modelo: "Transit" },
        user,
      ),
    );
  }
});

console.log(`${count} verificaciones de flota y vehículos completadas.`);
