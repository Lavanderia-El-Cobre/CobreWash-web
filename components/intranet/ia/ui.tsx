"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import ModalIntranet from "@/components/intranet/ModalIntranet";

/** Mensaje transitorio mostrado por `AvisoFlotante` en el Módulo IA. */
export type Aviso = { texto: string; tipo: "success" | "warning" | "error" };
/** Callback para publicar un aviso temporal desde cualquier pestaña del Módulo IA. */
export type Avisar = (texto: string, tipo?: Aviso["tipo"]) => void;

const estiloAviso: Record<Aviso["tipo"], string> = {
  success: "border-green-200 bg-green-50 text-green-700 dark:border-green-500/20 dark:bg-stone-900 dark:text-green-300",
  warning: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/20 dark:bg-stone-900 dark:text-amber-300",
  error: "border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-stone-900 dark:text-red-300",
};

/** Notificación flotante accesible (`alert` para errores, `status` para confirmaciones). */
export function AvisoFlotante({ aviso }: { aviso: Aviso | null }) {
  return (
    <AnimatePresence>
      {aviso && (
        <motion.div
          initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          role={aviso.tipo === "error" ? "alert" : "status"} aria-live="polite"
          className={`fixed right-5 top-5 z-[120] max-w-sm rounded-2xl border px-4 py-3 text-sm font-semibold shadow-xl ${estiloAviso[aviso.tipo]}`}
        >
          {aviso.texto}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Clases utilitarias compartidas entre formularios y tarjetas del Módulo IA. */
export const claseCampo =
  "w-full rounded-xl border border-stone-200/80 bg-stone-50/70 px-4 py-3 text-sm text-stone-800 placeholder-stone-400 outline-none focus:border-brand-500 dark:border-white/10 dark:bg-stone-800/80 dark:text-stone-200 dark:placeholder-stone-500 transition-all disabled:opacity-60";
export const claseEtiqueta = "text-[10px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400";
export const claseBotonPrincipal =
  "flex items-center justify-center gap-2 rounded-xl bg-gradient-brand px-5 py-2.5 text-sm font-bold text-white shadow-premium transition-all hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer";
export const claseBotonSecundario =
  "flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-stone-500 transition-colors hover:bg-stone-100 dark:hover:bg-white/5 disabled:opacity-50 cursor-pointer";

/** Botón `submit` principal con spinner integrado durante el guardado. */
export function BotonGuardar({ guardando, children, disabled, className = "" }: { guardando: boolean; children: React.ReactNode; disabled?: boolean; className?: string }) {
  return (
    <button type="submit" disabled={guardando || disabled} className={`${claseBotonPrincipal} ${className}`}>
      {guardando && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

/** Contenedor estándar con cabecera de ícono, título, descripción y acción opcional. */
export function Tarjeta({ icono: Icono, titulo, descripcion, children, accion }: { icono: React.ElementType; titulo: string; descripcion?: string; children: React.ReactNode; accion?: React.ReactNode }) {
  return (
    <section className="glass-panel rounded-2xl p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400"><Icono className="h-5 w-5" /></span>
          <div>
            <h2 className="font-display text-lg font-extrabold dark:text-white">{titulo}</h2>
            {descripcion && <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">{descripcion}</p>}
          </div>
        </div>
        {accion}
      </div>
      {children}
    </section>
  );
}

/** Adaptador de `ModalIntranet` preconfigurado con la etiqueta del Módulo IA. */
export function Modal({ abierto, alCerrar, titulo, subtitulo, icono, bloqueado, children }: {
  abierto: boolean; alCerrar: () => void; titulo: string; subtitulo?: string; icono: React.ElementType; bloqueado?: boolean; children: React.ReactNode;
}) {
  return (
    <ModalIntranet abierto={abierto} onCerrar={alCerrar} titulo={titulo} subtitulo={subtitulo} icono={icono} bloqueado={bloqueado} etiqueta="Módulo IA" idTitulo="titulo-modal-ia">
      <div className="space-y-5">{children}</div>
    </ModalIntranet>
  );
}

/** Lee números escritos con coma o punto decimal; null si no es un número. */
export function leerNumero(valor: string): number | null {
  const limpio = valor.trim().replace(",", ".");
  if (!limpio) return null;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
}

/** Formatea un número con separadores `es-CL` y hasta `decimales` cifras decimales. */
export const formatoNumero = (valor: number, decimales = 2) =>
  valor.toLocaleString("es-CL", { maximumFractionDigits: decimales });

/** Traduce los errores de Data Connect a mensajes para el administrador. */
export function mensajeErrorIa(error: unknown) {
  const texto = error instanceof Error ? error.message : String(error);
  if (/no es compatible/i.test(texto)) return "La unidad de la tasa no es compatible con la del insumo.";
  if (/tasa, unidad o fuente/i.test(texto)) return "Revisa la tasa (entre 0 y 100.000) y la fuente (hasta 300 caracteres).";
  if (/stock cambió/i.test(texto)) return "El stock cambió mientras registrabas. Ya se actualizó: revisa el dato y vuelve a guardar.";
  if (/margen/i.test(texto)) return "El margen debe estar entre 0% y 100% y λ entre 0 y 10.000.";
  if (/cantidad/i.test(texto)) return "Revisa la cantidad ingresada.";
  if (/inactivo/i.test(texto)) return "El insumo está inactivo.";
  if (/ya no existe/i.test(texto)) return "La tasa ya había sido eliminada.";
  if (/administra|no autorizado/i.test(texto)) return "No tienes permisos para realizar esta acción.";
  return "No fue posible guardar el cambio. Intenta nuevamente.";
}
