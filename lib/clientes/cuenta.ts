import { createUserWithEmailAndPassword } from "firebase/auth";
import { executeMutation, mutationRef, type DataConnect } from "firebase/data-connect";
import { crearClienteConCuenta, TipoCliente } from "@/src/dataconnect-generated";
import { createSecondaryFirebaseContext } from "@/lib/firebase/secondary";
import { contrasenaTemporal, enviarInvitacion } from "@/lib/firebase/verificacion";

export interface FichaClienteNueva {
  nombre: string;
  tipoCliente: TipoCliente;
  rut?: string;
  telefono?: string;
  email: string;
  direccion?: string;
}

export interface ResultadoClienteConCuenta {
  id: string;
  /** "creada": se creó la cuenta e invitó al cliente; "existente": el correo ya tenía cuenta. */
  cuenta: "creada" | "existente";
  invitacionEnviada: boolean;
}

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Separa el nombre de la ficha en nombre y apellido para el perfil de la cuenta. */
export function nombreDeCuenta(nombre: string, tipoCliente: TipoCliente) {
  const limpio = nombre.trim().replace(/\s+/g, " ");
  if (tipoCliente !== TipoCliente.PARTICULAR) return { nombreUsuario: limpio.slice(0, 80), apellidoUsuario: null };
  const [primero, ...resto] = limpio.split(" ");
  return { nombreUsuario: primero.slice(0, 80), apellidoUsuario: resto.join(" ").slice(0, 80) || null };
}

type CrearFichaData = { cliente_insert: { id: string } };
type CrearFichaVariables = Omit<FichaClienteNueva, "email"> & { email?: string };

/**
 * Registra solo la ficha del cliente, sin cuenta en la plataforma. El correo es
 * opcional; si se indica debe ser válido. Devuelve el id de la ficha.
 */
export async function registrarFichaCliente(dataConnect: DataConnect, ficha: Omit<FichaClienteNueva, "email"> & { email?: string }): Promise<string> {
  const email = ficha.email?.trim().toLowerCase() || undefined;
  if (email && !CORREO.test(email)) throw new Error("Ingresa un correo válido o déjalo en blanco.");
  const creada = await executeMutation(mutationRef<CrearFichaData, CrearFichaVariables>(dataConnect, "CrearClienteComanda", {
    nombre: ficha.nombre.trim(), tipoCliente: ficha.tipoCliente, email,
    rut: ficha.rut?.trim() || undefined, telefono: ficha.telefono?.trim() || undefined, direccion: ficha.direccion?.trim() || undefined,
  }));
  return creada.data.cliente_insert.id;
}

/**
 * Registra un cliente desde recepción con una cuenta asociada. Crea la
 * identidad en una app Firebase secundaria (sin cerrar la sesión del personal),
 * guarda Usuario y Cliente en una transacción y envía al cliente un enlace para
 * definir su contraseña. Si el correo ya tiene cuenta, solo crea la ficha: se
 * asocia cuando esa cuenta inicie sesión con su correo verificado y el mismo RUT.
 */
export async function registrarClienteConCuenta(dataConnect: DataConnect, ficha: FichaClienteNueva): Promise<ResultadoClienteConCuenta> {
  const email = ficha.email.trim().toLowerCase();
  if (!CORREO.test(email)) throw new Error("Ingresa el correo del cliente: se usa para crear su cuenta.");
  const datos = {
    nombre: ficha.nombre.trim(), tipoCliente: ficha.tipoCliente, email,
    rut: ficha.rut?.trim() || null, telefono: ficha.telefono?.trim() || null, direccion: ficha.direccion?.trim() || null,
  };
  const contexto = createSecondaryFirebaseContext();
  let credencial: Awaited<ReturnType<typeof createUserWithEmailAndPassword>> | null = null;
  try {
    try {
      credencial = await createUserWithEmailAndPassword(contexto.auth, email, contrasenaTemporal());
    } catch (error) {
      if ((error as { code?: string } | null)?.code !== "auth/email-already-in-use") throw error;
      const id = await registrarFichaCliente(dataConnect, ficha);
      return { id, cuenta: "existente", invitacionEnviada: false };
    }
    const resultado = await crearClienteConCuenta(dataConnect, {
      ...datos, usuarioId: credencial.user.uid, ...nombreDeCuenta(datos.nombre, datos.tipoCliente),
    });
    const invitacionEnviada = await enviarInvitacion(contexto.auth, email).then(() => true, () => false);
    return { id: resultado.data.cliente_insert.id, cuenta: "creada", invitacionEnviada };
  } catch (error) {
    if (credencial) await credencial.user.delete().catch(() => undefined);
    throw error;
  } finally {
    await contexto.cleanup().catch(() => undefined);
  }
}

/** Mensaje para el personal después de registrar la ficha. */
export function avisoClienteConCuenta(resultado: ResultadoClienteConCuenta, email: string) {
  if (resultado.cuenta === "existente") return `Cliente registrado. ${email} ya tenía una cuenta: la ficha se asociará cuando inicie sesión con su correo verificado.`;
  return resultado.invitacionEnviada
    ? `Cliente registrado con cuenta. Enviamos a ${email} un enlace para activar su cuenta y crear su contraseña.`
    : `Cliente registrado con cuenta, pero no se pudo enviar la invitación a ${email}. Pídele usar "¿Olvidaste tu contraseña?" para activarla.`;
}
