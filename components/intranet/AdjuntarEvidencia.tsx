"use client";
import { useRef, useState } from "react";
import { subirEvidencia } from "@/lib/vehiculos/evidencias";
import { normalizarCodigoQr } from "@/lib/seguimiento/qr";

/**
 * Control para anexar una fotografía adicional a una inspección vehicular ya registrada.
 * Respeta el tope operativo de 20 fotografías por inspección.
 *
 * @param inspeccionId - Identificador o código QR de la inspección destino.
 * @param siguienteOrden - Posición correlativa de la nueva foto; si supera 20 bloquea nuevas cargas.
 * @param alGuardar - Callback ejecutado tras confirmar la subida para refrescar la galería.
 */
export default function AdjuntarEvidencia({ inspeccionId, siguienteOrden, alGuardar }: { inspeccionId: string; siguienteOrden: number; alGuardar: () => Promise<void> }) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  // UUID estable por archivo seleccionado para que un reintento tras error de red no duplique la evidencia.
  const id = useRef("");
  if (siguienteOrden > 20) return <p className="text-xs">Se alcanzó el máximo de 20 fotografías.</p>;
  return <div className="mt-3 space-y-2 border-t border-stone-200 pt-3">
    <p className="text-xs text-stone-500">Fotografía solo el estado del vehículo. Evita rostros, documentos, domicilios y objetos personales ajenos a la inspección.</p>
    <label className="block text-xs font-semibold">Agregar fotografía a esta inspección<input type="file" accept="image/*" disabled={guardando} onChange={e => { setArchivo(e.target.files?.[0] ?? null); id.current = crypto.randomUUID(); setError(""); }} className="mt-1 block max-w-full text-xs" /></label>
    <button type="button" disabled={guardando || !archivo} className="text-xs font-bold text-brand-600 underline disabled:opacity-50" onClick={async () => {
      if (!archivo) return;
      setGuardando(true); setError("");
      try {
        await subirEvidencia(normalizarCodigoQr(inspeccionId), { id: id.current, archivo }, siguienteOrden);
        setArchivo(null); await alGuardar();
      } catch (error) { setError(error instanceof Error ? error.message : "No se pudo guardar la fotografía. Reintenta."); }
      finally { setGuardando(false); }
    }}>{guardando ? "Guardando archivo…" : "Guardar fotografía"}</button>
    {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
  </div>;
}
