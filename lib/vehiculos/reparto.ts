import { EstadoVehiculo, type GetPanelRepartidorData } from "@/src/dataconnect-generated";
import type { EvidenciaFotoInput } from "./modelo";
import { validarRetornoVehiculo, validarSalidaVehiculo } from "./validaciones";

export type VehiculoReparto = GetPanelRepartidorData["vehiculos"][number];
export type SalidaReparto = GetPanelRepartidorData["misSalidas"][number];

export type DisponibilidadVehiculo = "Disponible" | "En ruta" | "Contigo";

export interface OpcionVehiculoReparto {
  vehiculo: VehiculoReparto;
  disponibilidad: DisponibilidadVehiculo;
  /** Último kilometraje registrado; es el mínimo aceptado para una nueva salida. */
  kilometrajeActual: number;
  /** Quién tiene hoy el vehículo cuando no está disponible. */
  conductorActual: string | null;
}

export interface PanelReparto {
  vehiculos: OpcionVehiculoReparto[];
  /** Salida propia en curso (a lo más una). */
  salidaEnCurso: SalidaReparto | null;
  historial: SalidaReparto[];
}

const nombre = (p: { nombre: string; apellido?: string | null }) =>
  `${p.nombre} ${p.apellido ?? ""}`.trim();

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
 * Ordena la vista del repartidor: primero el vehículo que tiene en uso, luego
 * los disponibles y al final los que otra persona tiene en ruta.
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
 * Reglas de la salida y el regreso de flota, más una del repartidor: si el
 * vehículo no está apto debe describir lo que observó.
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
