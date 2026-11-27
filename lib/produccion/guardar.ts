import { executeMutation, getDataConnect, mutationRef } from "firebase/data-connect";
import { app, dataConnect } from "@/lib/firebase/client";
import { connectorConfig, getMiComandaGuardada, type UnidadCobro } from "@/src/dataconnect-generated";

/** Variables para crear una comanda junto con sus líneas de detalle y flujo de etapas. */
export interface CrearComandaConFlujoVariables {
  /** UUID pregenerado en el cliente para garantizar idempotencia ante reintentos. */
  id: string;
  numeroComanda: string;
  clienteId: string;
  empresa?: string | null;
  proyecto?: string | null;
  observaciones?: string | null;
  modalidadCobro?: UnidadCobro;
  precioKg?: number | null;
  detalles: {
    tipoPrendaId: string;
    tipoServicioId: string;
    cantidad: number;
    detalle?: string;
    /** Parte del peso total de la comanda que corresponde a la línea (kg). */
    pesoKg?: number;
    precioUnitario: number;
    subtotal: number;
  }[];
}

type Resultado = { comanda_insert: { id: string } };

/** Variables para actualizar cabecera y detalles de una comanda existente con control optimista. */
export type EditarComandaConDetallesVariables = Omit<Pick<CrearComandaConFlujoVariables, "id" | "empresa" | "proyecto" | "observaciones" | "modalidadCobro" | "precioKg" | "detalles">, "detalles"> & {
  /** Marca de versión actual de la comanda usada para evitar sobrescrituras concurrentes. */
  version: string;
  modalidadCobro: UnidadCobro;
  detalles: (CrearComandaConFlujoVariables["detalles"][number] & { comandaId: string })[];
};

/**
 * Ejecuta la mutación atómica `EditarComandaConDetalles` en el conector `produccion`.
 *
 * @param variables - Datos actualizados de la comanda, sus detalles y su `version` actual.
 */
export async function editarComandaConDetalles(variables: EditarComandaConDetallesVariables) {
  const dc = getDataConnect(app, { ...connectorConfig, connector: "produccion" });
  await executeMutation(mutationRef<{ comanda_update: { id: string } }, EditarComandaConDetallesVariables>(
    dc, "EditarComandaConDetalles", variables,
  ));
}

// El generador aún no admite inputs _Data con @allow. Mantener este contrato
// acotado al input de dataconnect/produccion/mutations.gql.
/**
 * Crea una comanda junto con su flujo de etapas en el conector `produccion`.
 * Si falla la red tras enviar la mutación, verifica en el servidor si el UUID
 * ya quedó persistido para evitar duplicar la comanda en reintentos.
 *
 * @param variables - Datos de la comanda, líneas de detalle y UUID cliente.
 * @returns Identificador persistido de la comanda.
 */
export async function guardarComandaConFlujo(variables: CrearComandaConFlujoVariables) {
  const dc = getDataConnect(app, { ...connectorConfig, connector: "produccion" });
  try {
    const result = await executeMutation(mutationRef<Resultado, CrearComandaConFlujoVariables>(
      dc, "CrearComandaConFlujo", variables,
    ));
    return result.data.comanda_insert.id;
  } catch (error) {
    // Una respuesta perdida no debe provocar otro INSERT ni duplicar el flujo.
    // El UUID se conserva en el formulario hasta confirmar el guardado.
    try {
      const result = await getMiComandaGuardada(dataConnect, { id: variables.id }, { fetchPolicy: "SERVER_ONLY" });
      if (result.data.comanda) return result.data.comanda.id;
    } catch {
      // Si tampoco puede verificarse, conservar el error y el UUID para reintentar.
    }
    throw error;
  }
}
