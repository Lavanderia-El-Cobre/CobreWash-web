// Requiere hooks de React y eventos del navegador (`visibilitychange`, timers).
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { consultarSeguimiento } from "./consultar";
import { validarConsulta, type ConsultaSeguimiento, type PedidoPublico } from "./publico";

/**
 * Gestiona el estado de la consulta pública de pedidos (por QR o número de comanda)
 * con control de concurrencia y actualización automática cada 30 segundos mientras
 * la pestaña está visible.
 *
 * Usa un contador `secuencia` para descartar respuestas fuera de orden si el usuario
 * realiza una nueva búsqueda antes de que termine la anterior.
 */
export function useSeguimientoPublico() {
  const [pedido, setPedido] = useState<PedidoPublico | null>(null);
  const [error, setError] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [consultado, setConsultado] = useState(false);
  const [consulta, setConsulta] = useState<ConsultaSeguimiento | null>(null);
  const secuencia = useRef(0);
  const enCurso = useRef(false);

  const ejecutar = useCallback(async (entrada: ConsultaSeguimiento, actualizar = false) => {
    // El polling no desplaza una búsqueda ni acumula peticiones lentas.
    if (actualizar && enCurso.current) return;
    const version = ++secuencia.current;
    enCurso.current = true;
    let validada: ConsultaSeguimiento;
    try { validada = validarConsulta(entrada); }
    catch (error) {
      setError(error instanceof Error ? error.message : "Código inválido.");
      setConsulta(null); setPedido(null); setConsultado(false); setBuscando(false);
      enCurso.current = false;
      return;
    }
    setConsulta(validada); setError(""); setBuscando(true);
    if (!actualizar) { setPedido(null); setConsultado(false); }
    try {
      const resultado = await consultarSeguimiento(validada);
      if (version !== secuencia.current) return;
      setPedido(resultado); setConsultado(true);
    } catch {
      if (version !== secuencia.current) return;
      setError("No se pudo consultar el pedido. Revisa tu conexión y vuelve a intentar.");
    } finally {
      if (version === secuencia.current) { setBuscando(false); enCurso.current = false; }
    }
  }, []);

  // Invalida cualquier respuesta pendiente al desmontar el componente consumidor.
  useEffect(() => () => { secuencia.current++; enCurso.current = false; }, []);

  useEffect(() => {
    if (!consulta) return;
    const actualizar = () => {
      if (document.visibilityState === "visible") void ejecutar(consulta, true);
    };
    const timer = window.setInterval(actualizar, 30_000);
    document.addEventListener("visibilitychange", actualizar);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", actualizar); };
  }, [consulta, ejecutar]);

  return { pedido, error, buscando, consultado, consulta, ejecutar, actualizar: () => consulta && ejecutar(consulta, true) };
}
