"use client";
import { useRef, useState } from "react";
import { FileDown, ImageDown, Loader2, QrCode as QrIcon } from "lucide-react";
import QrCode from "@/components/ui/QrCode";
import ModalIntranet from "@/components/intranet/ModalIntranet";

/**
 * Modal que muestra el código QR de un insumo de inventario y permite descargar
 * su etiqueta lista para impresión en formato PDF o imagen PNG.
 */
export default function QrInsumo({ insumo, cerrar }: {
  insumo: { nombre: string; codigoQr: string; unidadMedida: string }; cerrar: () => void;
}) {
  const codigo = useRef<HTMLDivElement>(null);
  const [preparando, setPreparando] = useState<"png" | "pdf" | null>(null);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  async function descargar(formato: "png" | "pdf") {
    const svg = codigo.current?.querySelector("svg");
    if (!svg || preparando) return;
    setPreparando(formato); setError(""); setMensaje("");
    try {
      // Carga diferida para evitar incluir las utilidades de generación de PDF/PNG en el bundle inicial.
      const { exportarEtiquetaInsumo } = await import("@/lib/inventario/etiqueta");
      await exportarEtiquetaInsumo(svg, insumo, formato);
      setMensaje("Descarga iniciada. Puedes imprimir la etiqueta desde el PDF.");
    } catch { setError("No se pudo descargar la etiqueta. Intenta nuevamente."); }
    finally { setPreparando(null); }
  }
  return <ModalIntranet
    onCerrar={cerrar}
    bloqueado={!!preparando}
    tamano="sm"
    icono={QrIcon}
    etiqueta="Etiqueta de inventario"
    titulo={insumo.nombre}
    subtitulo="Escanea este código desde el inventario de la app."
    idTitulo="titulo-qr-insumo"
    etiquetaCerrar="Cerrar etiqueta"
  >
    <div className="space-y-5 text-center">
      <div ref={codigo} className="mx-auto w-fit rounded-2xl border border-stone-100 bg-white p-2"><QrCode value={insumo.codigoQr} size={220} title={`QR del insumo ${insumo.nombre}`} /></div>
      <p className="break-all font-mono text-[10px] text-stone-500">{insumo.codigoQr}</p>
      <div className="grid gap-2"><button onClick={() => void descargar("pdf")} disabled={!!preparando} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-brand px-4 py-3 text-sm font-bold text-white disabled:opacity-40">{preparando === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}Descargar PDF para imprimir</button><button onClick={() => void descargar("png")} disabled={!!preparando} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-brand-200 bg-brand-500/5 px-4 py-3 text-sm font-bold text-brand-700 disabled:opacity-40 dark:border-brand-500/20 dark:text-brand-300">{preparando === "png" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageDown className="h-4 w-4" />}Descargar imagen</button></div>
      {error && <p role="alert" className="text-xs text-red-600 dark:text-red-300">{error}</p>}{mensaje && <p role="status" className="text-xs text-brand-700 dark:text-brand-300">{mensaje}</p>}
    </div>
  </ModalIntranet>;
}
