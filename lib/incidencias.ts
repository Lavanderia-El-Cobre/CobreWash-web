/** Catálogo predefinido de motivos al registrar una incidencia operativa en planta o recepción. */
export const MOTIVOS_INCIDENCIA = [
  "Prenda dañada",
  "Mancha persistente",
  "Prenda extraviada",
  "Falla de maquinaria",
  "Retraso en producción",
  "Otro",
] as const;

/** Unión de los motivos válidos para clasificar una incidencia operativa. */
export type MotivoIncidencia = (typeof MOTIVOS_INCIDENCIA)[number];
