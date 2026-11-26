import { serviciosAdmin } from "@/lib/firebase/admin";
import { verificarSesionAdmin } from "@/lib/firebase/sesion-admin";
import { ErrorPrivacidad, errorPrivacidad, responder } from "@/lib/privacidad/servidor";
import type { GetMiPerfilData } from "@/src/dataconnect-generated";

// Requiere runtime Node.js para Firebase Admin SDK y verificación de token no revocado.
export const runtime = "nodejs";

/**
 * Descarga una copia estructurada en JSON del perfil del cliente autenticado
 * (acceso/portabilidad básica en formato `cobrewash.perfil.v1`).
 *
 * - **Contrato HTTP**: `GET /api/privacidad/mis-datos`. Devuelve un archivo
 *   adjunto `mis-datos-cobrewash.json` con `X-Content-Type-Options: nosniff`.
 * - **Autenticación y roles**: exige `Authorization: Bearer <ID token>` vigente
 *   y no revocado, correo verificado (`email_verified === true`), usuario activo
 *   con `id === token.uid` y rol `cliente`. Consulta `GetMiPerfil` con
 *   impersonación de los claims verificados.
 * - **Respuestas**:
 *   - `200`: archivo JSON descargable con proyección explícita del perfil.
 *   - `401`: falta token Bearer o la sesión venció/fue revocada.
 *   - `403`: correo sin verificar, cuenta inactiva o rol distinto de `cliente`.
 *   - `503`: servicio de validación de sesión o base de datos no disponible.
 */
export async function GET(request: Request) {
  try {
    const bearer = request.headers.get("authorization")?.match(/^Bearer (\S+)$/)?.[1];
    if (!bearer) throw new ErrorPrivacidad(401, "Inicia sesión para descargar tus datos.");
    const { auth, db } = serviciosAdmin();
    const token = await verificarSesionAdmin(auth, bearer, {
      sesionVencida: () => new ErrorPrivacidad(401, "La sesión venció."),
      servidor: () => new ErrorPrivacidad(503, "La descarga no está disponible en este momento. Intenta más tarde o utiliza el canal de derechos."),
    });
    if (token.email_verified !== true) throw new ErrorPrivacidad(403, "Verifica el correo de tu cuenta o utiliza el canal de derechos.");
    const { data } = await db.executeQuery<GetMiPerfilData, Record<string, never>>("GetMiPerfil", {}, { impersonate: { authClaims: token } });
    const perfil = data.usuario;
    if (!perfil || perfil.id !== token.uid || !perfil.activo || perfil.rol.nombre !== "cliente") {
      throw new ErrorPrivacidad(403, "Utiliza el canal de derechos para solicitar tus datos.");
    }
    // Proyección explícita: nunca enviar la respuesta completa ni datos de fichas
    // comerciales compartidas, roles, tokens, secretos o información de terceros.
    const r = responder({
      formato: "cobrewash.perfil.v1", generadoEn: new Date().toISOString(),
      alcance: "Datos del perfil de cuenta. Para pedidos, otras fuentes o una respuesta íntegra de acceso o portabilidad utiliza el canal de derechos.",
      canalDerechos: "/privacidad/derechos",
      perfil: { id: perfil.id, nombre: perfil.nombre, apellido: perfil.apellido, rut: perfil.rut, email: perfil.email, telefono: perfil.telefono, creadoEn: perfil.creadoEn },
    });
    r.headers.set("Content-Disposition", 'attachment; filename="mis-datos-cobrewash.json"');
    r.headers.set("X-Content-Type-Options", "nosniff");
    return r;
  } catch (error) { return errorPrivacidad(error); }
}
