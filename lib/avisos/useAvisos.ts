"use client";
// Requiere hooks de React y eventos de ventana/documento para refresco periódico en cliente.

import { useCallback, useEffect, useRef, useState } from "react";
import { consultarAvisos } from "./consultar";

type Resultado = Awaited<ReturnType<typeof consultarAvisos>>;

/**
 * Carga y mantiene actualizados los avisos internos paginados del usuario actual.
 * Refresca automáticamente cada 30 s y al recuperar foco o visibilidad de la pestaña,
 * descartando respuestas fuera de orden cuando cambian la página o el usuario.
 */
export function useAvisos(usuarioId: string | undefined, rol: string | undefined, habilitado: boolean, pagina: number) {
  const [resultado, setResultado] = useState<{ clave: string; data: Resultado } | null>(null);
  const [fallo, setFallo] = useState<{ clave: string; mensaje: string } | null>(null);
  // Contador monotónico para ignorar respuestas lentas de una consulta anterior.
  const secuencia = useRef(0);
  // Evita apilar refrescos silenciosos si la consulta previa aún no termina.
  const enCurso = useRef(false);
  const clave = `${usuarioId}:${rol}:${pagina}`;

  const cargar = useCallback(async (silencioso = false) => {
    if (!habilitado || !usuarioId || !rol || (silencioso && enCurso.current)) return;
    const version = ++secuencia.current;
    enCurso.current = true;
    try {
      const data = await consultarAvisos(rol, pagina);
      if (version !== secuencia.current) return;
      setResultado({ clave, data });
      setFallo(null);
    } catch {
      if (version !== secuencia.current) return;
      setFallo({ clave, mensaje: "No se pudieron cargar los avisos. Revisa tu conexión y vuelve a intentar." });
    } finally {
      if (version === secuencia.current) enCurso.current = false;
    }
  }, [clave, habilitado, pagina, rol, usuarioId]);

  useEffect(() => {
    const solicitudes = secuencia;
    // Se difiere un tick para no disparar actualizaciones síncronas dentro del efecto inicial.
    const timer = window.setTimeout(() => void cargar(), 0);
    const refrescar = () => {
      if (document.visibilityState === "visible") void cargar(true);
    };
    const intervalo = window.setInterval(refrescar, 30_000);
    window.addEventListener("focus", refrescar);
    document.addEventListener("visibilitychange", refrescar);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(intervalo);
      window.removeEventListener("focus", refrescar);
      document.removeEventListener("visibilitychange", refrescar);
      solicitudes.current++;
      enCurso.current = false;
    };
  }, [cargar]);

  // Solo expone datos o error que correspondan a la clave activa (usuario/rol/página).
  const datos = habilitado && resultado?.clave === clave ? resultado.data : null;
  const error = habilitado && fallo?.clave === clave ? fallo.mensaje : "";
  return {
    avisos: datos?.avisos ?? [], total: datos?.total ?? 0,
    cargando: habilitado && !datos && !error, error, recargar: cargar,
  };
}
