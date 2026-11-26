import type { GetMiPerfilData, GetModeloComandaIaData } from "@/src/dataconnect-generated";
import { serviciosAdmin } from "@/lib/firebase/admin";
import { verificarSesionAdmin } from "@/lib/firebase/sesion-admin";
import { estimarConsumoComanda, PESO_MAXIMO_KG, type ModeloComanda } from "@/lib/ia/comanda";
import { ErrorIa, errorIa, leerJson, responder } from "@/lib/ia/servidor";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;

/**
 * Estimación de consumo de insumos de una comanda que se está registrando, la misma
 * que muestra `ConsumoEstimado` en el formulario de la intranet. La usa la app móvil,
 * que no incluye el modelo de IA: solo envía el servicio y el peso total.
 *
 * Autorización en el servidor: ID token vigente y no revocado, y `GetModeloComandaIa`
 * ejecutado en nombre de quien llama (exige admin o recepcionista con cuenta activa).
 * Solo informa: no guarda nada ni cambia el stock. La recepción recibe el rango y si
 * el stock alcanza; administración además recibe el stock disponible, como en la web.
 */
export async function POST(request: Request) {
  try {
    const bearer = request.headers.get("authorization")?.match(/^Bearer (\S+)$/)?.[1];
    if (!bearer) throw new ErrorIa(401, "Inicia sesión.");
    const admin = serviciosAdmin();
    const token = await verificarSesionAdmin(admin.auth, bearer, {
      sesionVencida: () => new ErrorIa(401, "La sesión venció. Vuelve a iniciar sesión."),
      servidor: () => new ErrorIa(503, "El servidor no pudo validar la sesión con Firebase."),
    });

    const cuerpo = (await leerJson(request, 1_000)) as { tipoServicioId?: unknown; pesoKg?: unknown } | null;
    const servicioId = cuerpo?.tipoServicioId;
    const kg = cuerpo?.pesoKg;
    if (typeof servicioId !== "string" || !UUID.test(servicioId)) throw new ErrorIa(400, "Servicio inválido.");
    if (typeof kg !== "number" || !Number.isFinite(kg) || kg <= 0 || kg > PESO_MAXIMO_KG) {
      throw new ErrorIa(400, `El peso debe ser mayor que 0 y hasta ${PESO_MAXIMO_KG.toLocaleString("es-CL")} kg.`);
    }

    const como = { impersonate: { authClaims: token } };
    let modelo: ModeloComanda;
    try {
      modelo = (await admin.db.executeQuery<GetModeloComandaIaData, Record<string, never>>("GetModeloComandaIa", {}, como)).data;
    } catch {
      throw new ErrorIa(403, "Solo administración y recepción con cuenta activa pueden ver la estimación.");
    }
    const { data: perfil } = await admin.db.executeQuery<GetMiPerfilData, Record<string, never>>("GetMiPerfil", {}, como);
    const verStock = perfil.usuario?.rol.nombre === "admin";

    const r = estimarConsumoComanda(modelo, servicioId, kg);
    return responder({
      insumos: r.insumos.map((i) => ({
        insumoId: i.insumoId,
        nombre: i.nombre,
        unidad: i.unidad,
        minimo: i.minimo,
        maximo: i.maximo,
        nivel: i.nivel,
        ...(verStock ? { stockActual: i.stockActual } : {}),
      })),
      alerta: r.alerta,
      /** El servicio aún no tiene tasas de consumo en el Módulo IA. */
      sinTasas: r.insumos.length === 0,
    });
  } catch (e) {
    return errorIa(e);
  }
}
