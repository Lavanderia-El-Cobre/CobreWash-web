import { getMisComandas, vincularMiComanda, type ComandaEstado, type GetMisComandasData } from "@/src/dataconnect-generated";
import { auth, dataConnect } from "@/lib/firebase/client";
import { normalizarNumeroComanda } from "@/lib/seguimiento/qr";
import { ESTADOS_POR_VISTA, type VistaPedidos } from "./vistas";

/** Comanda individual retornada por Data Connect para el portal de clientes. */
export type PedidoCliente = GetMisComandasData["comandas"][number];
/** Cantidad de pedidos cargados por página en el listado del portal. */
export const TAMANO_PAGINA = 10;

/**
 * Consulta una página de pedidos del cliente autenticado filtrada por pestaña y estado.
 * Usa `SERVER_ONLY` para mostrar siempre el avance real sin caché local desactualizada.
 */
export async function consultarMisComandas(estado: ComandaEstado | null, pagina: number, vista: VistaPedidos = "todos") {
  const { data } = await getMisComandas(dataConnect, {
    ...(estado === null ? {} : { estado }),
    estados: ESTADOS_POR_VISTA[vista], limit: TAMANO_PAGINA, offset: pagina * TAMANO_PAGINA,
  }, { fetchPolicy: "SERVER_ONLY" });
  return { pedidos: data.comandas, total: data.total[0]?._count ?? 0 };
}

/**
 * Asocia una comanda existente a la cuenta del cliente autenticado mediante su número público.
 */
export async function vincularPedido(numero: string) {
  const numeroComanda = normalizarNumeroComanda(numero);
  const user = auth.currentUser;
  if (!user) throw new Error("Inicia sesión para vincular pedidos.");
  // Fuerza la recarga del perfil y del ID token para que Data Connect reciba claims vigentes (p. ej. email verificado).
  await user.reload();
  await user.getIdToken(true);
  await vincularMiComanda(dataConnect, { numeroComanda });
}
