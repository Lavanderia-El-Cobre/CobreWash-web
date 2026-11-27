import { EstadoVehiculo, type GetPanelRepartidorData } from "@/src/dataconnect-generated";
import type { EvidenciaFotoInput } from "./modelo";
import { validarRetornoVehiculo, validarSalidaVehiculo } from "./validaciones";

/** Vehículo visible en el panel operativo del repartidor. */
export type VehiculoReparto = GetPanelRepartidorData["vehiculos"][number];
/** Salida propia registrada en el panel del repartidor. */
export type SalidaReparto = GetPanelRepartidorData["misSalidas"][number];

/** Disponibilidad del vehículo desde la perspectiva del repartidor autenticado. */
export type DisponibilidadVehiculo = "Disponible" | "En ruta" | "Contigo";

/** Opción de vehículo enriquecida con disponibilidad, odómetro y conductor actual. */
export interface OpcionVehiculoReparto {
  vehiculo: VehiculoReparto;
  disponibilidad: DisponibilidadVehiculo;
  /** Último kilometraje registrado; es el mínimo aceptado para una nueva salida. */
  kilometrajeActual: number;
  /** Quién tiene hoy el vehículo cuando no está disponible. */
  conductorActual: string | null;
}

/** Estado estructurado del panel del repartidor (flota, salida activa e historial). */
export interface PanelReparto {
  vehiculos: OpcionVehiculoReparto[];
  /** Salida propia en curso (a lo más una). */
  salidaEnCurso: SalidaReparto | null;
  historial: SalidaReparto[];
}

const nombre = (p: { nombre: string; apellido?: string | null }) =>
  `${p.nombre} ${p.apellido ?? ""}`.trim();

/**
 * Obtiene el mayor kilometraje registrado en las inspecciones recientes de un vehículo,
 * usado como piso mínimo al iniciar una nueva salida.
 *
 * @param vehiculo - Vehículo con sus salidas recientes e inspecciones.
 */
export function kilometrajeActualVehiculo(vehiculo: Pick<VehiculoReparto, "recientes">): number {
  let max = 0;
  for (const salida of vehiculo.recientes) {
    for (const inspeccion of salida.inspecciones) {
      if (inspeccion.kilometraje > max) max = inspeccion.kilometraje;
    }
  }
  return max;
}

/**
 * Arma y ordena la vista del repartidor: primero el vehículo que tiene en uso
 * (`Contigo`), luego los `Disponible` y al final los que otra persona tiene `En ruta`.
 *
 * @param data - Respuesta cruda de `GetPanelRepartidor`.
 * @param usuarioId - ID del repartidor autenticado.
 */
export function construirPanelReparto(data: GetPanelRepartidorData, usuarioId: string | undefined): PanelReparto {
  const salidaEnCurso = data.misSalidas.find((s) => s.estado === "EN_SERVICIO") ?? null;
  const prioridad: Record<DisponibilidadVehiculo, number> = { Contigo: 0, Disponible: 1, "En ruta": 2 };
  const vehiculos = data.vehiculos
    .map((vehiculo): OpcionVehiculoReparto => {
      const enCurso = vehiculo.enCurso[0];
      const disponibilidad: DisponibilidadVehiculo = !enCurso
        ? "Disponible"
        : enCurso.repartidor.id === usuarioId
          ? "Contigo"
          : "En ruta";
      return {
        vehiculo,
        disponibilidad,
        kilometrajeActual: kilometrajeActualVehiculo(vehiculo),
        conductorActual: enCurso ? nombre(enCurso.repartidor) : null,
      };
    })
    .sort((a, b) => prioridad[a.disponibilidad] - prioridad[b.disponibilidad]);
  return {
    vehiculos,
    salidaEnCurso,
    historial: data.misSalidas.filter((s) => s.id !== salidaEnCurso?.id),
  };
}

/** Formatea la etiqueta legible de un vehículo (`PATENTE · Marca Modelo`). */
export function etiquetaVehiculo(v: Pick<VehiculoReparto, "patente" | "marca" | "modelo">): string {
  return `${v.patente} · ${v.marca} ${v.modelo}`;
}

/** Formulario único de la sección del repartidor para la salida y el regreso. */
export interface FormMovimiento {
  tipo: "salida" | "regreso";
  vehiculoId: string;
  salidaId: string;
  patente: string;
  /** Salida: último kilometraje del vehículo. Regreso: kilometraje de salida. */
  kilometrajeMinimo: number;
  kilometraje: string;
  estadoVehiculo: EstadoVehiculo;
  observacionesInspeccion: string;
  observacionesRuta: string;
  fotos: EvidenciaFotoInput[];
}

/**
 * Valida el formulario de salida o regreso del repartidor aplicando las reglas
 * generales de flota más la obligatoriedad de describir hallazgos cuando el
 * estado del vehículo es distinto de `APTO`.
 *
 * @param form - Estado actual del formulario de movimiento.
 * @param usuarioId - ID del repartidor autenticado.
 * @returns Mensaje de error en español, o `null` si el formulario es válido.
 */
export function validarFormMovimiento(form: FormMovimiento, usuarioId: string): string | null {
  const error = form.tipo === "salida"
    ? validarSalidaVehiculo({
        vehiculoId: form.vehiculoId,
        repartidorId: usuarioId,
        kilometraje: form.kilometraje,
        kilometrajeMinimo: form.kilometrajeMinimo,
        estadoVehiculo: form.estadoVehiculo,
      })
    : validarRetornoVehiculo({
        salidaId: form.salidaId,
        kilometrajeSalida: form.kilometrajeMinimo,
        kilometrajeRetorno: form.kilometraje,
      });
  if (error) return error;
  if (form.estadoVehiculo !== EstadoVehiculo.APTO && !form.observacionesInspeccion.trim()) {
    return "Describe lo que observaste en el vehículo.";
  }
  if (form.observacionesInspeccion.trim().length > 500) return "La descripción del estado admite hasta 500 caracteres.";
  if (form.observacionesRuta.trim().length > 300) return "Los comentarios de la ruta admiten hasta 300 caracteres.";
  return null;
}
