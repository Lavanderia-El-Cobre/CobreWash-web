"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { cabeceraEvidencia, endpointEvidencia } from "@/lib/vehiculos/evidencias";

/**
 * Renderiza una fotografía de evidencia vehicular almacenada en un endpoint privado.
 * Descarga el binario con credenciales de sesión mediante `fetch` y lo muestra con un
 * `ObjectURL` temporal, ya que `<img>` no permite adjuntar cabeceras `Authorization`.
 *
 * @param ruta - Ruta de almacenamiento registrada para la evidencia.
 * @param descripcion - Texto alternativo descriptivo para accesibilidad.
 */
export default function FotoEvidencia({ ruta, descripcion }: { ruta: string; descripcion: string }) {
  const [imagen, setImagen] = useState("");
  const [error, setError] = useState(false);
  useEffect(() => {
    let vigente = true;
    let objectUrl = "";
    const controller = new AbortController();
    void (async () => {
      const endpoint = endpointEvidencia(ruta);
      if (!endpoint) throw new Error("Evidencia anterior sin archivo confirmado.");
      const response = await fetch(endpoint, { headers: await cabeceraEvidencia(), signal: controller.signal });
      if (!response.ok) throw new Error("No disponible");
      objectUrl = URL.createObjectURL(await response.blob());
      if (vigente) setImagen(objectUrl);
    })().catch(() => { if (vigente) setError(true); });
    // Aborta la descarga pendiente y libera el blob en memoria al desmontar o cambiar de ruta.
    return () => { vigente = false; controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [ruta]);
  if (error) return <p className="p-3 text-xs text-amber-700">Archivo de evidencia no disponible. No se ha confirmado su recuperación.</p>;
  return imagen ? <Image src={imagen} alt={descripcion} width={320} height={220} unoptimized className="h-32 w-full object-cover" /> : <p className="p-3 text-xs">Cargando evidencia…</p>;
}
