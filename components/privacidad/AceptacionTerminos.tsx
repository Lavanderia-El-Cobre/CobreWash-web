"use client";
import Link from "next/link";
import { ArrowUpRight, FileText } from "lucide-react";
import { VERSION_TERMINOS } from "@/lib/privacidad/modelo";

/**
 * Aceptación de los Términos y Condiciones, separada de la autorización de
 * datos: aceptar las condiciones del servicio no equivale a consentir un
 * tratamiento de datos.
 */
export default function AceptacionTerminos({ aceptada, onChange, disabled = false }: { aceptada: boolean; onChange: (valor: boolean) => void; disabled?: boolean }) {
  return <div className="space-y-3 rounded-2xl border border-stone-200/80 bg-white/50 p-4 text-xs leading-relaxed text-stone-600 sm:p-5">
    <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-stone-700"><FileText className="h-4 w-4 text-brand-600" />Términos y condiciones</div>
    <label className="flex cursor-pointer items-start gap-3">
      <input type="checkbox" required checked={aceptada} disabled={disabled} onChange={e => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-brand-600" />
      <span>He leído y acepto los <Link href="/terminos" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 font-bold text-brand-700 underline decoration-brand-200 underline-offset-4">Términos y Condiciones<ArrowUpRight className="h-3 w-3" /></Link> del portal y del servicio (versión {VERSION_TERMINOS}).</span>
    </label>
  </div>;
}
