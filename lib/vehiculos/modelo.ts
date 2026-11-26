import type {
  EstadoVehiculo,
  GetFlotaVehiculosData,
  SalidaVehiculoEstado,
} from "@/src/dataconnect-generated";

/** Vehículo registrado tal como proviene de la consulta de flota. */
export type VehiculoFlota = GetFlotaVehiculosData["vehiculos"][number];
/** Usuario elegible como conductor/repartidor en la consulta de flota. */
export type ConductorFlota = GetFlotaVehiculosData["conductores"][number];
/** Registro de salida (en curso o histórica) con sus inspecciones asociadas. */
export type SalidaFlota = GetFlotaVehiculosData["salidas"][number];
/** Inspección de vehículo realizada antes de salir o al retornar. */
export type InspeccionFlota = SalidaFlota["inspecciones"][number];
/** Metadatos de una fotografía adjunta a una inspección. */
export type FotoInspeccionFlota = InspeccionFlota["fotos"][number];
/** Momento de la inspección dentro del ciclo de una salida (`ANTES` o `DESPUES`). */
export type MomentoInspeccion = InspeccionFlota["momento"];

/** Estado operativo derivado que se muestra en el tablero de flota. */
export type EstadoOperativoVehiculo = "Disponible" | "En ruta" | "Inactivo";

/** Vista consolidada de un vehículo junto con su estado operativo e historial resumido. */
export interface ResumenVehiculo {
  vehiculo: VehiculoFlota;
  estadoOperativo: EstadoOperativoVehiculo;
  salidaActiva: SalidaFlota | null;
  /** Mayor kilometraje registrado en las inspecciones históricas del vehículo. */
  kilometrajeActual: number;
  totalSalidas: number;
  ultimaSalida: SalidaFlota | null;
}

/** Contadores agregados de disponibilidad para las tarjetas KPI del módulo de flota. */
export interface KpisFlota {
  total: number;
  disponibles: number;
  enRuta: number;
  inactivos: number;
}

/** Fotografía de evidencia pendiente o ya subida dentro de un formulario de inspección. */
export interface EvidenciaFotoInput {
  /** UUID pregenerado en el cliente para permitir reintentos idempotentes de subida. */
  id: string;
  /** Ruta confirmada en Storage (vacía mientras la foto sigue pendiente de subida). */
  rutaStorage: string;
  descripcion: string;
  nombreArchivo?: string;
  previewUrl?: string;
  archivo?: File;
}

/** Estado del formulario de alta/edición de un vehículo de la flota. */
export interface VehiculoFormState {
  id?: string;
  patente: string;
  marca: string;
  modelo: string;
  anio: string;
  descripcion: string;
  activo: boolean;
}

/** Estado del formulario administrativo para registrar una salida a terreno. */
export interface SalidaFormState {
  vehiculoId: string;
  repartidorId: string;
  kilometraje: string;
  estadoVehiculo: EstadoVehiculo;
  observaciones: string;
  observacionesInspeccion: string;
  fotos: EvidenciaFotoInput[];
}

/** Estado del formulario administrativo para cerrar el retorno de una salida activa. */
export interface RetornoFormState {
  salidaId: string;
  vehiculoPatente: string;
  kilometrajeSalida: number;
  kilometrajeRetorno: string;
  estadoVehiculo: EstadoVehiculo;
  observacionesRetorno: string;
  observacionesInspeccion: string;
  fotos: EvidenciaFotoInput[];
}

/** Pestañas disponibles en la sección administrativa de gestión de vehículos. */
export type VistaVehiculos = "flota" | "en-ruta" | "historial";

export type { EstadoVehiculo, SalidaVehiculoEstado };
