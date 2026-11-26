/**
 * Apoyo a la evaluación humana de brechas de seguridad según el art. 14 sexies
 * de la Ley 21.719 (Chile). Determina si corresponde notificar a la Agencia de
 * Protección de Datos y comunicar individualmente a los titulares afectados,
 * sin despachar notificaciones automáticamente.
 */
export function evaluarNotificacionIncidente(datos: {
  vulneracionDatosPersonales: boolean | null;
  riesgoRazonable: boolean | null;
  datosSensibles: boolean;
  menoresDe14: boolean;
  obligacionesEconomicasFinancierasBancariasComerciales: boolean;
}) {
  if (datos.vulneracionDatosPersonales === false) return { agencia: "no_aplica", titulares: "no_aplica" } as const;
  // Si aún no se determina si hubo vulneración o riesgo razonable, prioriza evaluación urgente.
  if (datos.vulneracionDatosPersonales === null || datos.riesgoRazonable === null) return { agencia: "evaluacion_urgente", titulares: "evaluacion_urgente" } as const;
  if (!datos.riesgoRazonable) return { agencia: "documentar_no_reporte", titulares: "evaluar_comunicacion" } as const;
  return {
    agencia: "sin_dilaciones_indebidas",
    // Datos sensibles, de menores de 14 años u obligaciones económicas/financieras exigen aviso individual.
    titulares: datos.datosSensibles || datos.menoresDe14 || datos.obligacionesEconomicasFinancierasBancariasComerciales
      ? "comunicacion_individual" : "evaluar_comunicacion",
  } as const;
}
