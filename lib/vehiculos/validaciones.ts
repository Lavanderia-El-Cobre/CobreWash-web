import { EstadoVehiculo } from "@/src/dataconnect-generated";
import type {
  ConductorFlota,
  InspeccionFlota,
  KpisFlota,
  ResumenVehiculo,
  SalidaFlota,
  VehiculoFlota,
} from "./modelo";

const ROLES_CONDUCTOR_PERMITIDOS = new Set(["conductor", "repartidor"]);

/**
 * Verifica que el rol pertenezca exclusivamente a "conductor" o "repartidor".
 */
export function esRolConductorORepartidor(rolNombre?: string | null): boolean {
  if (!rolNombre) return false;
  return ROLES_CONDUCTOR_PERMITIDOS.has(rolNombre.trim().toLowerCase());
}

/**
 * Filtra la lista de usuarios dejando únicamente aquellos con rol "conductor" o "repartidor".
 */
export function filtrarConductoresFlota<
  T extends Pick<ConductorFlota, "rol">,
>(conductores: T[]): T[] {
  return conductores.filter((c) => esRolConductorORepartidor(c.rol?.nombre));
}

const PATENTE_CHILENA_REGEX = /^([A-Z]{4}-?\d{2}|[A-Z]{2}-?\d{4}|[A-Z]{3}-?\d{3})$/;

/**
 * Normaliza una patente chilena a mayúsculas y formato estándar con guion
 * (ej. "hlrt24" -> "HLRT-24", "ab1234" -> "AB-1234").
 */
export function normalizarPatente(valor: string): string {
  const limpia = valor.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (/^[A-Z]{4}\d{2}$/.test(limpia)) {
    return `${limpia.slice(0, 4)}-${limpia.slice(4)}`;
  }
  if (/^[A-Z]{2}\d{4}$/.test(limpia)) {
    return `${limpia.slice(0, 2)}-${limpia.slice(2)}`;
  }
  if (/^[A-Z]{3}\d{3}$/.test(limpia)) {
    return `${limpia.slice(0, 3)}-${limpia.slice(3)}`;
  }
  return valor.trim().toUpperCase().replace(/\s+/g, "-");
}

/**
 * Verifica que una patente (tras normalizarla) cumpla alguno de los formatos
 * chilenos vigentes (`AAAA-99`, `AA-9999` o `AAA-999`).
 */
export function esPatenteValida(valor: string): boolean {
  const normalizada = normalizarPatente(valor);
  return (
    normalizada.length >= 5 &&
    normalizada.length <= 10 &&
    PATENTE_CHILENA_REGEX.test(normalizada)
  );
}

/**
 * Valida el formulario de creación o edición de un vehículo: formato y unicidad
 * de patente, longitudes, rango de año (1980–2100) y prohibición de desactivar
 * un vehículo con salida activa.
 *
 * @param input - Campos del formulario.
 * @param existentes - Vehículos actuales para validar duplicidad de patente.
 * @param tieneSalidaActiva - Indica si el vehículo tiene una salida en curso.
 * @returns Mensaje de error en español, o `null` si todos los campos son válidos.
 */
export function validarFormularioVehiculo(
  input: {
    id?: string;
    patente: string;
    marca: string;
    modelo: string;
    anio: string;
    descripcion: string;
    activo: boolean;
  },
  existentes: Pick<VehiculoFlota, "id" | "patente">[],
  tieneSalidaActiva = false,
): string | null {
  const patente = normalizarPatente(input.patente);
  if (!patente) return "La patente es obligatoria.";
  if (!esPatenteValida(patente)) {
    return "Ingresa una patente chilena válida (ej. HLRT-24 o AB-1234).";
  }
  const duplicado = existentes.some(
    (v) =>
      v.id !== input.id &&
      normalizarPatente(v.patente) === patente,
  );
  if (duplicado) {
    return "Ya existe un vehículo registrado con esa patente.";
  }

  const marca = input.marca.trim();
  if (marca.length < 2 || marca.length > 50) {
    return "La marca debe tener entre 2 y 50 caracteres.";
  }

  const modelo = input.modelo.trim();
  if (modelo.length < 1 || modelo.length > 50) {
    return "El modelo es obligatorio (máximo 50 caracteres).";
  }

  if (input.anio.trim() !== "") {
    const anioNum = Number(input.anio);
    if (!Number.isInteger(anioNum) || anioNum < 1980 || anioNum > 2100) {
      return "El año debe ser un número entero entre 1980 y 2100.";
    }
  }

  if (input.descripcion.trim().length > 200) {
    return "La descripción no puede superar los 200 caracteres.";
  }

  if (!input.activo && tieneSalidaActiva) {
    return "No puedes desactivar un vehículo que tiene una salida en curso.";
  }

  return null;
}

/**
 * Valida las reglas de negocio previas a registrar una salida a terreno:
 * vehículo y conductor seleccionados, prohibición de salir si está `NO_APTO` y
 * odómetro no menor al último kilometraje conocido.
 *
 * @param input - Datos de la salida a validar.
 * @returns Mensaje de error en español, o `null` si es válida.
 */
export function validarSalidaVehiculo(input: {
  vehiculoId: string;
  repartidorId: string;
  kilometraje: string;
  kilometrajeMinimo: number;
  estadoVehiculo: EstadoVehiculo;
}): string | null {
  if (!input.vehiculoId) return "Selecciona un vehículo disponible.";
  if (!input.repartidorId) return "Selecciona el conductor responsable.";
  if (input.estadoVehiculo === EstadoVehiculo.NO_APTO) {
    return "Un vehículo calificado como NO APTO no puede salir a terreno.";
  }
  const textoKm = input.kilometraje.trim().replace(",", ".");
  if (!textoKm) return "Ingresa el kilometraje de salida.";
  const km = Number(textoKm);
  if (!Number.isFinite(km) || km < 0) {
    return "El kilometraje debe ser un número mayor o igual a cero.";
  }
  if (km < input.kilometrajeMinimo) {
    return `El kilometraje de salida no puede ser menor al último registrado (${input.kilometrajeMinimo.toLocaleString("es-CL")} km).`;
  }
  return null;
}

/**
 * Valida el cierre de retorno de una salida, garantizando que el kilometraje
 * final sea numérico y mayor o igual al kilometraje de salida.
 *
 * @param input - Identificador de salida y lecturas de odómetro.
 * @returns Mensaje de error en español, o `null` si es válido.
 */
export function validarRetornoVehiculo(input: {
  salidaId: string;
  kilometrajeSalida: number;
  kilometrajeRetorno: string;
}): string | null {
  if (!input.salidaId) return "Salida no identificada.";
  const textoKm = input.kilometrajeRetorno.trim().replace(",", ".");
  if (!textoKm) return "Ingresa el kilometraje de retorno.";
  const km = Number(textoKm);
  if (!Number.isFinite(km) || km < 0) {
    return "El kilometraje de retorno debe ser un número válido.";
  }
  if (km < input.kilometrajeSalida) {
    return `El kilometraje de retorno (${km.toLocaleString("es-CL")} km) no puede ser menor al de salida (${input.kilometrajeSalida.toLocaleString("es-CL")} km).`;
  }
  return null;
}

/** Busca la inspección correspondiente a la salida (`ANTES`) o al retorno (`DESPUES`). */
export function obtenerInspeccionMomento(
  salida: Pick<SalidaFlota, "inspecciones">,
  momento: "ANTES" | "DESPUES",
): InspeccionFlota | null {
  return salida.inspecciones.find((i) => i.momento === momento) ?? null;
}

/**
 * Calcula los kilómetros recorridos en una salida cerrada a partir de las
 * inspecciones `ANTES` y `DESPUES` (con un decimal), o `null` si faltan datos
 * o la diferencia resulta negativa.
 *
 * @param salida - Salida con sus inspecciones asociadas.
 */
export function calcularKilometrosRecorridos(
  salida: Pick<SalidaFlota, "inspecciones">,
): number | null {
  const antes = obtenerInspeccionMomento(salida, "ANTES");
  const despues = obtenerInspeccionMomento(salida, "DESPUES");
  if (!antes || !despues) return null;
  const delta = Number((despues.kilometraje - antes.kilometraje).toFixed(1));
  return delta >= 0 ? delta : null;
}

/**
 * Consolida el estado operativo, kilometraje máximo y KPIs de la flota a partir
 * de vehículos y salidas (asume que `salidas` llega ordenada de más reciente a
 * más antigua para determinar `ultimaSalida`). Una salida activa (`EN_SERVICIO`
 * o `PROGRAMADA`) marca al vehículo `"En ruta"` por encima de su flag `activo`.
 *
 * @param vehiculos - Catálogo completo de vehículos.
 * @param salidas - Historial de salidas ordenadas descendentemente por fecha.
 */
export function construirResumenFlota(
  vehiculos: VehiculoFlota[],
  salidas: SalidaFlota[],
): { resumen: ResumenVehiculo[]; kpis: KpisFlota } {
  const salidasPorVehiculo = new Map<string, SalidaFlota[]>();
  for (const salida of salidas) {
    const id = salida.vehiculo.id;
    const lista = salidasPorVehiculo.get(id) ?? [];
    lista.push(salida);
    salidasPorVehiculo.set(id, lista);
  }

  let disponibles = 0;
  let enRuta = 0;
  let inactivos = 0;

  const resumen: ResumenVehiculo[] = vehiculos.map((vehiculo) => {
    const historial = salidasPorVehiculo.get(vehiculo.id) ?? [];
    const salidaActiva =
      historial.find(
        (s) => s.estado === "EN_SERVICIO" || s.estado === "PROGRAMADA",
      ) ?? null;

    let maxKm = 0;
    for (const s of historial) {
      for (const insp of s.inspecciones) {
        if (insp.kilometraje > maxKm) maxKm = insp.kilometraje;
      }
    }

    const estadoOperativo: ResumenVehiculo["estadoOperativo"] = salidaActiva
      ? "En ruta"
      : vehiculo.activo
        ? "Disponible"
        : "Inactivo";

    if (estadoOperativo === "En ruta") enRuta++;
    else if (estadoOperativo === "Disponible") disponibles++;
    else inactivos++;

    return {
      vehiculo,
      estadoOperativo,
      salidaActiva,
      kilometrajeActual: maxKm,
      totalSalidas: historial.length,
      ultimaSalida: historial[0] ?? null,
    };
  });

  return {
    resumen,
    kpis: {
      total: vehiculos.length,
      disponibles,
      enRuta,
      inactivos,
    },
  };
}
