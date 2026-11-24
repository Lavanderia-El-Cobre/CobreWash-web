"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

/**
 * Modal con el mismo estilo glass-panel del resto de la intranet. En celular
 * se abre como hoja inferior a pantalla casi completa para usarla con una mano.
 */
export default function HojaModal({
  abierto,
  titulo,
  subtitulo,
  etiqueta,
  icono: Icono,
  bloqueado = false,
  onCerrar,
  onSubmit,
  children,
  pie,
}: {
  abierto: boolean;
  titulo: string;
  subtitulo?: string;
  etiqueta?: string;
  icono?: React.ElementType;
  /** Mientras guarda no se puede cerrar. */
  bloqueado?: boolean;
  onCerrar: () => void;
  onSubmit: (e: React.FormEvent) => void;
  children: React.ReactNode;
  pie: React.ReactNode;
}) {
  useEffect(() => {
    if (!abierto) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !bloqueado) onCerrar(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [abierto, bloqueado, onCerrar]);

  const idTitulo = `hoja-${titulo.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <AnimatePresence>
      {abierto && (
        <div role="dialog" aria-modal="true" aria-labelledby={idTitulo} className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !bloqueado && onCerrar()}
            className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"
          />
          <motion.form
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            onSubmit={onSubmit}
            noValidate
            className="glass-panel relative z-10 flex max-h-[92dvh] w-full max-w-xl flex-col rounded-t-3xl border border-stone-200/80 shadow-2xl sm:rounded-3xl dark:border-white/10"
          >
            <div className="flex items-start gap-3 border-b border-stone-200/70 p-5 pr-14 dark:border-white/10">
              {Icono && (
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-600 dark:text-brand-400">
                  <Icono className="h-5 w-5" />
                </div>
              )}
              <div className="min-w-0">
                {etiqueta && <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-600 dark:text-brand-400">{etiqueta}</p>}
                <h2 id={idTitulo} className="font-display text-lg font-extrabold text-stone-900 dark:text-white">{titulo}</h2>
                {subtitulo && <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">{subtitulo}</p>}
              </div>
              <button
                type="button"
                onClick={onCerrar}
                disabled={bloqueado}
                aria-label="Cerrar"
                className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-xl bg-stone-100 text-stone-500 transition-colors hover:bg-stone-200 disabled:opacity-50 dark:bg-white/5 dark:text-stone-400 dark:hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto p-5">{children}</div>
            <div className="flex gap-2 border-t border-stone-200/70 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] dark:border-white/10">{pie}</div>
          </motion.form>
        </div>
      )}
    </AnimatePresence>
  );
}

export const INPUT_REPARTO =
  "w-full rounded-xl border border-stone-200/80 bg-stone-50/70 px-4 py-3 text-base text-stone-800 placeholder-stone-400 outline-none transition-all focus:border-brand-500 disabled:opacity-60 sm:text-sm dark:border-white/10 dark:bg-stone-800/80 dark:text-stone-200 dark:placeholder-stone-500";

export const LABEL_REPARTO =
  "block text-[10px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400";

export const BOTON_PRIMARIO =
  "flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-brand px-5 py-3 text-sm font-bold text-white shadow-premium transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50";

export const BOTON_SECUNDARIO =
  "flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-stone-600 transition-colors hover:bg-stone-100 disabled:opacity-50 dark:text-stone-300 dark:hover:bg-white/5";
