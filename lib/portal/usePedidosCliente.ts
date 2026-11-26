"use client";
// Hook de cliente: gestiona estado reactivo y ciclo de carga de pedidos en el navegador.

import { useCallback, useEffect, useRef, useState } from "react";
import type { ComandaEstado } from "@/src/dataconnect-generated";
import { consultarMisComandas, type PedidoCliente } from "./consultar";
import type { VistaPedidos } from "./vistas";

/**
 * Carga y pagina los pedidos del cliente autenticado, descartando respuestas
 * obsoletas si el usuario cambia rápido de pestaña, filtro o página.
 *
 * @param uid - Identificador del cliente autenticado; si es null no consulta.
 * @param estado - Filtro puntual de estado o null para incluir toda la vista.
 * @param pagina - Índice de página (base 0).
 * @param vista - Pestaña activa del portal (`"todos"`, `"activos"` o `"historial"`).
 */
export function usePedidosCliente(uid: string | null, estado: ComandaEstado | null, pagina: number, vista: VistaPedidos = "todos") {
  const [datos, setDatos] = useState<{ uid: string; estado: ComandaEstado | null; pagina: number; vista: VistaPedidos; pedidos: PedidoCliente[]; total: number } | null>(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  // Contador monotónico para ignorar respuestas de consultas previas que lleguen fuera de orden.
  const version = useRef(0);
  const cargar = useCallback(async () => {
    if (!uid) return;
    const actual = ++version.current;
    setCargando(true); setError("");
    try {
      const resultado = await consultarMisComandas(estado, pagina, vista);
      if (actual === version.current) setDatos({ uid, estado, pagina, vista, ...resultado });
    } catch {
      if (actual === version.current) setError("No pudimos cargar tus pedidos. Vuelve a intentarlo.");
    } finally {
      if (actual === version.current) setCargando(false);
    }
  }, [uid, estado, pagina, vista]);
  const invalidar = useCallback(() => { version.current++; }, []);
  useEffect(() => {
    // Difiere la invocación al siguiente tick para evitar setState síncrono dentro del cuerpo del efecto.
    const timer = window.setTimeout(() => void cargar(), 0);
    return () => { window.clearTimeout(timer); invalidar(); };
  }, [cargar, invalidar]);
  // Evita mostrar brevemente filas de otra vista/página mientras llega la nueva consulta.
  const vigentes = datos?.uid === uid && datos.estado === estado && datos.pagina === pagina && datos.vista === vista ? datos : null;
  return { pedidos: vigentes?.pedidos ?? [], total: vigentes?.total ?? 0, cargando, error, actualizar: cargar };
}
