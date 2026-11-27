"use client";
// Requiere hooks de React, suscripción de Firebase Auth en cliente y eventos de `window`.

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, dataConnect } from "@/lib/firebase/client";
import {
  loadActiveUserProfile,
  type ActiveUserProfile,
} from "@/lib/firebase/auth-flows";
import { requiereVerificacion } from "@/lib/firebase/verificacion";
import { cerrarSesionRecordadaVencida, sesionRecordadaVencida } from "@/lib/firebase/sesion-recordada";

/** Alias público del perfil activo del usuario autenticado en el cliente. */
export type UsuarioActual = ActiveUserProfile;

/**
 * Suscribe el componente a la sesión de Firebase Auth y carga el perfil activo desde Data Connect.
 *
 * Invariantes de seguridad y concurrencia:
 * - Cierra automáticamente sesiones recordadas cuyo plazo máximo expiró.
 * - Impide el acceso mientras la cuenta nueva no tenga su correo verificado.
 * - Usa un contador `version` y bandera `montado` para descartar respuestas fuera de orden
 *   cuando cambia de usuario o se emite el evento `cobre:perfil-actualizado`.
 */
export function useUsuarioActual() {
  const [usuario, setUsuario] = useState<UsuarioActual | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let version = 0;
    let montado = true;
    const actualizar = (user: typeof auth.currentUser) => {
      const solicitud = ++version;
      setUsuario(null);
      // Pasado el plazo de "mantener la sesión iniciada" se vuelve a pedir la contraseña.
      if (user && sesionRecordadaVencida()) {
        setLoading(true);
        // El plazo se borra al cerrar, así que el reintento no vuelve a entrar aquí.
        void cerrarSesionRecordadaVencida(auth).then(() => { if (montado && solicitud === version) actualizar(auth.currentUser); });
        return;
      }
      // Una cuenta nueva sin correo verificado no ingresa: termina su alta en el inicio.
      if (!user || requiereVerificacion(user)) {
        setUsuario(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      void loadActiveUserProfile({ auth, dataConnect })
        .then(perfil => { if (montado && solicitud === version && auth.currentUser?.uid === user.uid) setUsuario(perfil); })
        .catch(() => { if (montado && solicitud === version) setUsuario(null); })
        .finally(() => { if (montado && solicitud === version) setLoading(false); });
    };
    const unsubscribe = onAuthStateChanged(auth, actualizar);
    const refrescar = () => actualizar(auth.currentUser);
    // Permite forzar la recarga del perfil tras aceptar condiciones o editar datos propios.
    window.addEventListener("cobre:perfil-actualizado", refrescar);

    return () => { montado = false; version++; unsubscribe(); window.removeEventListener("cobre:perfil-actualizado", refrescar); };
  }, []);

  return { usuario, loading };
}
