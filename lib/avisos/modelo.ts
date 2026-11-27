/** Largo máximo admitido para el título de un aviso interno. */
export const TITULO_MAXIMO = 120;
/** Largo máximo admitido para el cuerpo de un aviso interno. */
export const CONTENIDO_MAXIMO = 1000;

/** Destinatario permitido al publicar un aviso interno desde administración. */
export type Destinatario = "todos" | "operario" | "recepcionista" | "repartidor";

/** Estado controlado del formulario de publicación de avisos. */
export interface FormularioAviso {
  titulo: string;
  contenido: string;
  destinatario: string;
}

/** Valores iniciales del formulario de publicación de avisos. */
export const FORMULARIO_VACIO: FormularioAviso = {
  titulo: "", contenido: "", destinatario: "todos",
};

/** Normaliza y valida los campos de un aviso antes de enviarlo; lanza un `Error` si algo incumple las reglas. */
export function validarAviso(form: FormularioAviso) {
  const titulo = form.titulo.trim();
  const contenido = form.contenido.trim();
  if (!titulo || titulo.length > TITULO_MAXIMO) {
    throw new Error(`Escribe un título de hasta ${TITULO_MAXIMO} caracteres.`);
  }
  if (!contenido || contenido.length > CONTENIDO_MAXIMO) {
    throw new Error(`Escribe un contenido de hasta ${CONTENIDO_MAXIMO} caracteres.`);
  }
  if (!["todos", "operario", "recepcionista", "repartidor"].includes(form.destinatario)) {
    throw new Error("Selecciona un destinatario válido.");
  }
  return { titulo, contenido, destinatario: form.destinatario as Destinatario };
}

/** Convierte el nombre técnico del rol destinatario (o `null` si es general) en una etiqueta legible. */
export function etiquetaDestinatario(rol: string | null | undefined) {
  if (!rol) return "Todos";
  if (rol === "operario") return "Operarios";
  if (rol === "recepcionista") return "Recepción";
  if (rol === "repartidor") return "Reparto";
  return rol;
}

/** Formatea una marca de tiempo ISO en formato corto chileno fijo a zona horaria `America/Santiago`. */
export function fechaAviso(fecha: string) {
  return new Intl.DateTimeFormat("es-CL", {
    dateStyle: "short", timeStyle: "short", timeZone: "America/Santiago",
  }).format(new Date(fecha));
}
