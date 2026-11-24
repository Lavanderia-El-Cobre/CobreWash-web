"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";

/**
 * Encabezado común de las secciones de la intranet, tomado del panel de
 * producción: antetítulo pequeño en color de marca (sin íconos), título grande
 * y una descripción breve. Las acciones quedan a la derecha en escritorio y
 * debajo del texto en celular. Entra con un escalonado suave.
 */
export default function EncabezadoSeccion({
  antetitulo,
  titulo,
  descripcion,
  acciones,
  children,
}: {
  antetitulo: React.ReactNode;
  titulo: React.ReactNode;
  descripcion?: React.ReactNode;
  acciones?: React.ReactNode;
  /** Contenido adicional bajo el encabezado (avisos breves, etc.). */
  children?: React.ReactNode;
}) {
  const reducir = useReducedMotion();
  const item: Variants = reducir
    ? { oculto: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.2 } } }
    : {
      oculto: { opacity: 0, y: 10 },
      visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
    };
  return (
    <motion.header
      initial="oculto"
      animate="visible"
      variants={{ oculto: {}, visible: { transition: { staggerChildren: reducir ? 0 : 0.06 } } }}
      className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
    >
      <div className="min-w-0">
        <motion.p variants={item} className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-600 dark:text-brand-400">
          {antetitulo}
        </motion.p>
        <motion.h1 variants={item} className="mt-0.5 font-display text-2xl font-extrabold tracking-tight text-stone-900 sm:text-3xl dark:text-white">
          {titulo}
        </motion.h1>
        {descripcion && (
          <motion.p variants={item} className="mt-1 max-w-2xl text-sm text-stone-500 dark:text-stone-400">
            {descripcion}
          </motion.p>
        )}
        {children}
      </div>
      {acciones && (
        <motion.div variants={item} className="flex shrink-0 flex-wrap items-center gap-2">
          {acciones}
        </motion.div>
      )}
    </motion.header>
  );
}

/** Botón principal de las acciones del encabezado. */
export const BOTON_ENCABEZADO =
  "flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-brand px-4 py-2.5 text-sm font-bold text-white shadow-premium transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50";
/** Botón secundario (actualizar, exportar…) de las acciones del encabezado. */
export const BOTON_ENCABEZADO_SECUNDARIO =
  "flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-stone-200/80 bg-white/80 px-3.5 py-2.5 text-sm font-bold text-stone-700 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-stone-200 dark:hover:bg-white/10";

/**
 * Variantes para que los bloques de una sección aparezcan escalonados.
 * Uso: `<motion.section {...entradaBloque(1)}>`.
 */
export function entradaBloque(orden = 0) {
  return {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4, delay: 0.08 + orden * 0.05, ease: [0.16, 1, 0.3, 1] as const },
  };
}
