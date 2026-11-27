import type { Auth } from "firebase/auth";
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { QueryFetchPolicy, type DataConnect } from "firebase/data-connect";
import {
  aceptarCondicionesVigentes,
  actualizarUsuario,
  crearClienteAdministrado,
  crearUsuarioAdministrado,
  getMiPerfil,
  registrarseComoCliente,
  vincularMiFichaVerificada,
  type GetMiPerfilData,
  type TipoCliente,
} from "@/src/dataconnect-generated";
import type {
  AceptacionCondiciones,
  ClientCompletionInput,
  ClientRegistrationInput,
  ManagedUserRegistrationInput,
} from "@/lib/auth-validation";
import { formatRut } from "@/lib/validators";
import { isPublicClientType, validateAceptacion, validateClientCompletion } from "@/lib/auth-validation";
import { LANDING_POR_ROL, type Rol } from "@/lib/roles";
import { createSecondaryFirebaseContext } from "@/lib/firebase/secondary";
import { VERSION_PRIVACIDAD, VERSION_TERMINOS } from "@/lib/privacidad/modelo";
import { CorreoNoVerificadoError, contrasenaTemporal, enviarInvitacion, enviarVerificacion, requiereVerificacion } from "@/lib/firebase/verificacion";
import { borrarRegistroPendiente, guardarRegistroPendiente } from "@/lib/registro-pendiente";
import { registrarError } from "@/lib/registro-seguro";
import { aplicarRecordarSesion } from "@/lib/firebase/sesion-recordada";

interface FirebaseContext {
  auth: Auth;
  dataConnect: DataConnect;
}

/** Perfil activo del usuario autenticado tal como lo devuelve Data Connect (`getMiPerfil`). */
export type ActiveUserProfile = NonNullable<GetMiPerfilData["usuario"]>;

/**
 * Error lanzado cuando un usuario autenticado figura como inactivo en Data Connect.
 * Expone el código `auth/user-disabled` para reutilizar el mapeo de errores de Firebase Auth.
 */
export class InactiveAccountError extends Error {
  readonly code = "auth/user-disabled";

  constructor() {
    super("La cuenta está inactiva");
    this.name = "InactiveAccountError";
  }
}

/** Datos para actualizar rol, datos básicos o estado activo de un usuario desde administración. */
export interface ManagedUserUpdateInput {
  id: string;
  rolId: string;
  nombre: string;
  apellido: string | null;
  telefono: string | null;
  activo: boolean;
}

/** Resultado de iniciar sesión: entrar, verificar el correo o terminar el registro. */
export type ResultadoIngreso =
  | { tipo: "landing"; ruta: string }
  | { tipo: "verificar"; email: string }
  | { tipo: "completar"; email: string };

function registrationVariables(input: Omit<ClientRegistrationInput, "email" | "password">) {
  return {
    rut: formatRut(input.rut),
    nombre: input.nombre.trim(),
    apellido: input.apellido.trim(),
    telefono: input.telefono.trim() || null,
  };
}

/** El cliente debe aceptar los términos y el aviso vigentes antes de usar el portal. */
export function requiereAceptacion(profile: Pick<ActiveUserProfile, "rol" | "versionPrivacidad" | "versionTerminos"> | null): boolean {
  if (!profile || profile.rol.nombre !== "cliente") return false;
  return profile.versionPrivacidad !== VERSION_PRIVACIDAD || profile.versionTerminos !== VERSION_TERMINOS;
}

/**
 * Carga el perfil del usuario actual directamente desde el servidor (`SERVER_ONLY`).
 *
 * Invariantes de seguridad:
 * - Si el usuario es cliente con correo verificado y aún no tiene ficha vinculada, intenta
 *   asociar automáticamente su ficha creada en recepción (`vincularMiFichaVerificada`).
 * - Si la cuenta está desactivada (`activo === false`), cierra la sesión local y lanza
 *   `InactiveAccountError` para bloquear el acceso.
 */
export async function loadActiveUserProfile(
  context: FirebaseContext,
): Promise<ActiveUserProfile | null> {
  let { data } = await getMiPerfil(context.dataConnect, {
    fetchPolicy: QueryFetchPolicy.SERVER_ONLY,
  });
  let profile = data.usuario ?? null;
  if (profile?.rol.nombre === "cliente" && context.auth.currentUser?.emailVerified && profile.clientes_on_usuario.length === 0) {
    try {
      await vincularMiFichaVerificada(context.dataConnect);
      data = (await getMiPerfil(context.dataConnect, { fetchPolicy: QueryFetchPolicy.SERVER_ONLY })).data;
      profile = data.usuario ?? null;
    } catch { /* La ficha permanece sin asociar si no coincide el correo verificado. */ }
  }

  if (profile && !profile.activo) {
    // Evita cerrar por error otra sesión si el usuario actual ya cambió durante la consulta.
    if (!context.auth.currentUser || context.auth.currentUser.uid === profile.id) await signOut(context.auth).catch(() => undefined);
    throw new InactiveAccountError();
  }

  return profile;
}

/**
 * Determina qué hacer con la sesión actual. Las cuentas nuevas no ingresan
 * hasta verificar su correo; un registro verificado sin perfil se completa.
 */
export async function resolverIngreso(context: FirebaseContext): Promise<ResultadoIngreso> {
  const user = context.auth.currentUser;
  if (!user) throw new Error("Inicia sesión nuevamente.");
  const email = user.email ?? "";
  if (requiereVerificacion(user)) {
    await user.reload().catch(() => undefined);
    if (requiereVerificacion(user)) return { tipo: "verificar", email };
    // Fuerza la renovación del ID token para propagar el claim `email_verified` a Data Connect.
    await user.getIdToken(true).catch(() => undefined);
  }
  const profile = await loadActiveUserProfile(context);
  if (!profile) return user.emailVerified ? { tipo: "completar", email } : { tipo: "verificar", email };
  const role = profile.rol.nombre as Rol;
  return { tipo: "landing", ruta: LANDING_POR_ROL[role] ?? "/cuenta" };
}

/**
 * Configura la persistencia de sesión, autentica con correo/contraseña y resuelve
 * el destino correspondiente (`landing`, `verificar` o `completar`).
 */
export async function signInAndResolveLanding(
  context: FirebaseContext,
  email: string,
  password: string,
  recordar = false,
): Promise<ResultadoIngreso> {
  // Sin "mantener la sesión iniciada" la sesión termina al cerrar el navegador.
  await aplicarRecordarSesion(context.auth, recordar);
  await signInWithEmailAndPassword(context.auth, email.trim(), password);
  const resultado = await resolverIngreso(context);
  // Al entrar sin verificar se reenvía el enlace; un fallo no impide mostrar el aviso.
  if (resultado.tipo === "verificar" && context.auth.currentUser) await enviarVerificacion(context.auth.currentUser).catch(() => undefined);
  return resultado;
}

/**
 * Primer paso del registro público: crea la identidad de Firebase y envía el
 * correo de verificación. El perfil se crea al verificar el correo
 * (completarRegistroCliente), con la aceptación registrada en ese momento.
 */
export async function registerPublicClient(
  context: FirebaseContext,
  input: ClientRegistrationInput & AceptacionCondiciones,
): Promise<{ email: string; correoEnviado: boolean }> {
  if (!isPublicClientType(input.tipoCliente)) {
    throw new Error("Selecciona el tipo de cliente.");
  }
  const aceptacion = validateAceptacion(input);
  if (aceptacion) throw new Error(aceptacion);
  // La sesión debe sobrevivir a la pestaña: el enlace de verificación suele abrir otra.
  await aplicarRecordarSesion(context.auth, true);
  const credential = await createUserWithEmailAndPassword(
    context.auth,
    input.email.trim(),
    input.password,
  );
  const email = credential.user.email;
  if (!email) {
    await credential.user.delete().catch(() => undefined);
    throw new Error("No se pudo confirmar el correo de la cuenta autenticada.");
  }
  guardarRegistroPendiente(credential.user.uid, {
    nombre: input.nombre.trim(), apellido: input.apellido.trim(), rut: input.rut, telefono: input.telefono.trim(),
    direccion: input.direccion.trim(), tipoCliente: input.tipoCliente,
  });
  const correoEnviado = await enviarVerificacion(credential.user).then(() => true, (error) => {
    // El código queda en la consola para diagnosticar envíos rechazados.
    registrarError("No se pudo enviar el correo de verificación", error);
    return false;
  });
  return { email, correoEnviado };
}

/** Segundo paso: con el correo verificado crea Usuario y Cliente y registra la aceptación. */
export async function completarRegistroCliente(
  context: FirebaseContext,
  input: ClientCompletionInput & { direccion: string },
): Promise<string> {
  const error = validateClientCompletion(input);
  if (error) throw new Error(error);
  const user = context.auth.currentUser;
  if (!user?.email) throw new Error("Inicia sesión nuevamente para terminar tu registro.");
  await user.reload();
  if (!user.emailVerified) throw new CorreoNoVerificadoError();
  // El token debe incluir email_verified para que el servidor acepte el registro.
  await user.getIdToken(true);
  const variables = {
    ...registrationVariables(input), email: user.email, direccion: input.direccion.trim() || null,
    tipoCliente: input.tipoCliente as TipoCliente, versionPrivacidad: VERSION_PRIVACIDAD, versionTerminos: VERSION_TERMINOS,
  };
  try { await registrarseComoCliente(context.dataConnect, variables); }
  catch (e) {
    // Si recepción ya había registrado una ficha con el mismo RUT, se crea solo el usuario y se vincula abajo.
    if (!String(e).includes("FICHA_RUT_EXISTENTE")) throw e;
    await registrarseComoCliente(context.dataConnect, { ...variables, crearFicha: false });
  }
  borrarRegistroPendiente(user.uid);
  // Asocia la ficha de recepción con el mismo RUT y correo verificado, si existe.
  await loadActiveUserProfile(context);
  return "/cuenta";
}

/** El titular acepta los términos y el aviso vigentes desde su propia sesión. */
export async function aceptarCondiciones(dataConnect: DataConnect, input: AceptacionCondiciones) {
  const error = validateAceptacion(input);
  if (error) throw new Error(error);
  await aceptarCondicionesVigentes(dataConnect, { versionPrivacidad: VERSION_PRIVACIDAD, versionTerminos: VERSION_TERMINOS });
}

/** Envía un correo de restablecimiento de contraseña mediante Firebase Auth. */
export async function requestPasswordReset(auth: Auth, email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim());
}

/**
 * Crea la cuenta de otra persona desde administración. La contraseña inicial es
 * aleatoria y nadie la conoce: la persona recibe un enlace en su correo para
 * crear la suya, de modo que nunca debe decírsela al personal. Al definirla con
 * ese enlace también queda confirmado su correo.
 */
export async function createManagedUser(
  dataConnect: DataConnect,
  input: ManagedUserRegistrationInput,
  roleName: string,
): Promise<{ invitacionEnviada: boolean }> {
  if (input.informado !== true) throw new Error("Confirma que informaste a la persona de los Términos y Condiciones y del Aviso de Privacidad.");
  const context = createSecondaryFirebaseContext();
  let credential: Awaited<ReturnType<typeof createUserWithEmailAndPassword>> | null = null;
  try {
    credential = await createUserWithEmailAndPassword(
      context.auth,
      input.email.trim(),
      contrasenaTemporal(),
    );
    const variables = { ...registrationVariables(input), email: input.email.trim() };

    if (roleName === "cliente") {
      const datos = { ...variables, id: credential.user.uid, direccion: input.direccion.trim() || null, tipoCliente: input.tipoCliente as TipoCliente };
      try { await crearClienteAdministrado(dataConnect, datos); }
      catch (error) {
        // Si ya existe una ficha con ese RUT, crea solo el usuario sin duplicar la ficha.
        if (!String(error).includes("FICHA_RUT_EXISTENTE")) throw error;
        await crearClienteAdministrado(dataConnect, { ...datos, crearFicha: false });
      }
    } else {
      await crearUsuarioAdministrado(dataConnect, {
        ...variables,
        id: credential.user.uid,
        rolId: input.rolId,
      });
    }
    // La cuenta queda creada; la persona la activa definiendo su contraseña con el enlace.
    const invitacionEnviada = await enviarInvitacion(context.auth, input.email.trim()).then(() => true, (error) => {
      registrarError("No se pudo enviar la invitación de la cuenta", error);
      return false;
    });
    return { invitacionEnviada };
  } catch (error) {
    // Rollback: elimina la identidad creada en Firebase Auth si falla el alta en Data Connect.
    if (credential) {
      await credential.user.delete().catch(() => undefined);
    }
    throw error;
  } finally {
    await context.cleanup().catch(() => undefined);
  }
}

/** Actualiza los datos editables y el rol de un usuario administrado en Data Connect. */
export async function updateManagedUser(
  dataConnect: DataConnect,
  input: ManagedUserUpdateInput,
): Promise<void> {
  await actualizarUsuario(dataConnect, {
    ...input,
    nombre: input.nombre.trim(),
    apellido: input.apellido?.trim() || null,
    telefono: input.telefono?.trim() || null,
  });
}

/** Alterna el estado `activo` de un usuario administrado (habilitar o suspender acceso). */
export async function toggleManagedUserActive(
  dataConnect: DataConnect,
  input: ManagedUserUpdateInput,
): Promise<void> {
  await updateManagedUser(dataConnect, { ...input, activo: !input.activo });
}
