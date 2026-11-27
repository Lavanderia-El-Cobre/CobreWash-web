import { crearAviso, getRoles } from "@/src/dataconnect-generated";
import { dataConnect } from "@/lib/firebase/client";
import { validarAviso, type FormularioAviso } from "./modelo";

/**
 * Valida y publica un aviso interno en Data Connect.
 * Cuando `destinatario` es `"todos"`, guarda `rolDestinatarioId = null`; en otro
 * caso resuelve el ID del rol directamente desde el servidor.
 */
export async function publicarAviso(form: FormularioAviso) {
  const { titulo, contenido, destinatario } = validarAviso(form);
  let rolDestinatarioId: string | null = null;
  if (destinatario !== "todos") {
    const { data } = await getRoles(dataConnect, { fetchPolicy: "SERVER_ONLY" });
    const rol = data.rols.find((r) => r.nombre === destinatario);
    if (!rol) throw new Error("El rol destinatario no está configurado.");
    rolDestinatarioId = rol.id;
  }
  return crearAviso(dataConnect, { titulo, contenido, rolDestinatarioId });
}
