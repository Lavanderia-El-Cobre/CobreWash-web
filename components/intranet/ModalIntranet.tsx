"use client";

import { useEffect, useId, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";

/**
 * Modal base de la intranet. Todos los modales comparten el mismo panel
 * glass, cabecera, animación y comportamiento responsive:
 *
 * - Se monta en `document.body` (portal) para quedar sobre el Topbar y el
 *   Sidebar sin que un contenedor con transform/backdrop-filter lo recorte.
 * - En celular se abre como hoja inferior a todo el ancho; desde `sm` queda
 *   centrado. El alto nunca supera la ventana visible (`dvh`), respeta las
 *   zonas seguras y solo el cuerpo hace scroll: cabecera y acciones quedan
 *   siempre a la vista, también en portátiles bajos.
 * - Bloquea el scroll del fondo, atrapa el foco, cierra con Escape y con
 *   clic fuera (salvo `bloqueado`) y devuelve el foco al cerrar.
 */

const ANCHOS = {
  sm: "sm:max-w-md",
  md: "sm:max-w-lg",
  lg: "sm:max-w-2xl",
  xl: "sm:max-w-4xl",
  "2xl": "sm:max-w-6xl",
} as const;

export type TamanoModal = keyof typeof ANCHOS;

/** Color del ícono y del antetítulo según el tipo de acción. */
const TONOS = {
  marca: { icono: "bg-brand-500/10 text-brand-600 dark:text-brand-400", etiqueta: "text-brand-600 dark:text-brand-400" },
  peligro: { icono: "bg-red-500/10 text-red-600 dark:text-red-400", etiqueta: "text-red-600 dark:text-red-400" },
  exito: { icono: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", etiqueta: "text-emerald-600 dark:text-emerald-400" },
  aviso: { icono: "bg-amber-500/10 text-amber-600 dark:text-amber-400", etiqueta: "text-amber-600 dark:text-amber-400" },
} as const;

export type TonoModal = keyof typeof TONOS;

/** Pila de modales abiertos: Escape y el foco solo atienden al de arriba. */
const pila: string[] = [];
let scrollPrevio = "";

function apilar(id: string) {
  if (pila.length === 0) {
    scrollPrevio = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  pila.push(id);
  return () => {
    const i = pila.lastIndexOf(id);
    if (i >= 0) pila.splice(i, 1);
    if (pila.length === 0) document.body.style.overflow = scrollPrevio;
  };
}

const ENFOCABLES =
  'a[href], button:not(:disabled), input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

const suscribirse = () => () => {};

type Props = {
  /** Para modales que se montan siempre; si se renderiza condicionalmente, se deja en true. */
  abierto?: boolean;
  onCerrar: () => void;
  titulo: React.ReactNode;
  /** Antetítulo pequeño en color de marca. */
  etiqueta?: React.ReactNode;
  subtitulo?: React.ReactNode;
  icono?: React.ElementType;
  /** Contenido extra al lado del título (insignias de estado, etc.). */
  extraCabecera?: React.ReactNode;
  /** Mientras guarda no se puede cerrar. */
  bloqueado?: boolean;
  cerrarConFondo?: boolean;
  tamano?: TamanoModal;
  tono?: TonoModal;
  /** Si se entrega, el panel es un <form> que envuelve cuerpo y acciones. */
  onSubmit?: (e: React.FormEvent<HTMLFormElement>) => void;
  noValidate?: boolean;
  /** Barra de acciones fija al pie. */
  pie?: React.ReactNode;
  children: React.ReactNode;
  etiquetaCerrar?: string;
  /** Selector del elemento que recibe el foco al abrir. */
  enfoqueInicial?: string;
  claseCuerpo?: string;
  idTitulo?: string;
  rol?: "dialog" | "alertdialog";
};

export default function ModalIntranet({ abierto = true, ...props }: Props) {
  const montado = useSyncExternalStore(suscribirse, () => true, () => false);
  const modal = <AnimatePresence propagate>{abierto && <PanelModal key="modal" {...props} />}</AnimatePresence>;
  // En el servidor (y al hidratar) no hay document: se pinta en línea.
  return montado ? createPortal(modal, document.body) : modal;
}

function PanelModal({
  onCerrar,
  titulo,
  etiqueta,
  subtitulo,
  icono: Icono,
  extraCabecera,
  bloqueado = false,
  cerrarConFondo = true,
  tamano = "md",
  tono = "marca",
  onSubmit,
  noValidate,
  pie,
  children,
  etiquetaCerrar = "Cerrar",
  enfoqueInicial,
  claseCuerpo = "",
  idTitulo,
  rol = "dialog",
}: Omit<Props, "abierto">) {
  const idGenerado = useId();
  const idCabecera = idTitulo ?? `modal-${idGenerado.replace(/:/g, "")}`;
  const panel = useRef<HTMLElement | null>(null);
  const reducir = useReducedMotion();
  const cerrar = useRef(onCerrar);
  const bloqueadoRef = useRef(bloqueado);
  useEffect(() => {
    cerrar.current = onCerrar;
    bloqueadoRef.current = bloqueado;
  });

  useEffect(() => {
    const desapilar = apilar(idCabecera);
    const anterior = document.activeElement as HTMLElement | null;
    const nodo = panel.current;
    if (nodo && !nodo.contains(document.activeElement)) {
      const inicial = enfoqueInicial ? nodo.querySelector<HTMLElement>(enfoqueInicial) : null;
      (inicial ?? nodo).focus({ preventScroll: true });
    }
    const onKey = (e: KeyboardEvent) => {
      if (pila[pila.length - 1] !== idCabecera || !panel.current) return;
      if (e.key === "Escape") {
        // Un desplegable abierto dentro del modal se cierra primero.
        if (panel.current.querySelector('[aria-haspopup="listbox"][aria-expanded="true"]')) return;
        if (e.defaultPrevented || bloqueadoRef.current) return;
        e.preventDefault();
        cerrar.current();
        return;
      }
      if (e.key === "Tab") {
        const elementos = Array.from(panel.current.querySelectorAll<HTMLElement>(ENFOCABLES)).filter((el) => el.offsetParent !== null || el === document.activeElement);
        if (!elementos.length) { e.preventDefault(); return; }
        const primero = elementos[0];
        const ultimo = elementos[elementos.length - 1];
        const activo = document.activeElement;
        if (e.shiftKey && (activo === primero || activo === panel.current)) { e.preventDefault(); ultimo.focus(); }
        else if (!e.shiftKey && activo === ultimo) { e.preventDefault(); primero.focus(); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      desapilar();
      if (anterior && document.contains(anterior)) anterior.focus({ preventScroll: true });
    };
    // Solo al abrir/cerrar: el resto se lee por ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const contenido = (
    <>
      <div aria-hidden className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-stone-300/80 sm:hidden dark:bg-white/15" />
      <header className="flex shrink-0 items-start gap-3 border-b border-stone-200/70 px-5 pb-4 pt-3 sm:gap-3.5 sm:px-6 sm:pt-5 dark:border-white/10">
        {Icono && (
          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${TONOS[tono].icono}`}>
            <Icono className="h-5 w-5" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          {etiqueta && <p className={`text-[10px] font-bold uppercase tracking-[0.2em] ${TONOS[tono].etiqueta}`}>{etiqueta}</p>}
          <h2 id={idCabecera} className="break-words font-display text-lg font-extrabold leading-tight text-stone-900 sm:text-xl dark:text-white">{titulo}</h2>
          {subtitulo && <div className="mt-1 text-xs text-stone-500 dark:text-stone-400">{subtitulo}</div>}
          {extraCabecera}
        </div>
        <button
          type="button"
          onClick={onCerrar}
          disabled={bloqueado}
          aria-label={etiquetaCerrar}
          className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-xl bg-stone-100 text-stone-500 transition-colors hover:bg-stone-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white/5 dark:text-stone-400 dark:hover:bg-white/10"
        >
          <X className="h-4 w-4" />
        </button>
      </header>
      <div className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6 ${pie ? "" : "pb-[max(1.25rem,env(safe-area-inset-bottom))]"} ${claseCuerpo}`}>
        {children}
      </div>
      {pie && (
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-stone-200/70 px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6 dark:border-white/10">
          {pie}
        </div>
      )}
    </>
  );

  const animacion = reducir
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : { initial: { opacity: 0, y: 32, scale: 0.98 }, animate: { opacity: 1, y: 0, scale: 1 }, exit: { opacity: 0, y: 24, scale: 0.98 } };
  const clasePanel = `modal-intranet glass-panel relative z-10 flex max-h-full w-full flex-col overflow-hidden rounded-t-3xl border border-stone-200/80 text-stone-900 shadow-2xl outline-none sm:rounded-3xl dark:border-white/10 dark:text-stone-100 ${ANCHOS[tamano]}`;
  const comunes = {
    role: rol,
    "aria-modal": true,
    "aria-labelledby": idCabecera,
    tabIndex: -1,
    ...animacion,
    transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] as const },
    className: clasePanel,
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center pt-[max(0.75rem,env(safe-area-inset-top))] sm:items-center sm:p-4">
      <motion.div
        aria-hidden
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        onClick={() => { if (cerrarConFondo && !bloqueado) onCerrar(); }}
        className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"
      />
      {onSubmit ? (
        <motion.form ref={(n) => { panel.current = n; }} onSubmit={onSubmit} noValidate={noValidate} {...comunes}>
          {contenido}
        </motion.form>
      ) : (
        <motion.div ref={(n) => { panel.current = n; }} {...comunes}>
          {contenido}
        </motion.div>
      )}
    </div>
  );
}

/** Clases compartidas para campos y botones dentro de los modales. */
export const CAMPO_MODAL =
  "w-full rounded-xl border border-stone-200/80 bg-stone-50/70 px-4 py-3 text-base text-stone-800 placeholder-stone-400 outline-none transition-all focus:border-brand-500 disabled:opacity-60 sm:text-sm dark:border-white/10 dark:bg-stone-800/80 dark:text-stone-200 dark:placeholder-stone-500";
export const ETIQUETA_MODAL = "block text-[10px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400";
const BOTON_MODAL_BASE =
  "flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-premium transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none";
export const BOTON_MODAL_PRIMARIO = `${BOTON_MODAL_BASE} bg-gradient-brand`;
export const BOTON_MODAL_PELIGRO = `${BOTON_MODAL_BASE} bg-red-600 hover:bg-red-700`;
export const BOTON_MODAL_EXITO = `${BOTON_MODAL_BASE} bg-emerald-600 hover:bg-emerald-700`;
export const BOTON_MODAL_SECUNDARIO =
  "flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-stone-600 transition-colors hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none dark:text-stone-300 dark:hover:bg-white/5";
