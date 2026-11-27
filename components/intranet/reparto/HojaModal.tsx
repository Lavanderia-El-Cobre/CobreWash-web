"use client";

import ModalIntranet, {
  BOTON_MODAL_SECUNDARIO,
  CAMPO_MODAL,
  ETIQUETA_MODAL,
} from "@/components/intranet/ModalIntranet";

/**
 * Formulario en modal para el repartidor. Usa el modal base de la intranet
 * (hoja inferior en celular, centrado desde `sm`) con botones grandes para
 * usarlo con una mano.
 */
export default function HojaModal({
  abierto,
  titulo,
  subtitulo,
  etiqueta,
  icono,
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
  return (
    <ModalIntranet
      abierto={abierto}
      titulo={titulo}
      subtitulo={subtitulo}
      etiqueta={etiqueta}
      icono={icono}
      bloqueado={bloqueado}
      onCerrar={onCerrar}
      onSubmit={onSubmit}
      noValidate
      tamano="md"
      claseCuerpo="space-y-4"
      pie={<div className="flex w-full gap-2">{pie}</div>}
    >
      {children}
    </ModalIntranet>
  );
}

export const INPUT_REPARTO = CAMPO_MODAL;

export const LABEL_REPARTO = ETIQUETA_MODAL;

/** Botón principal de 48 px de alto mínimo y ancho equitativo para uso táctil con una mano. */
export const BOTON_PRIMARIO =
  "flex min-h-12 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-brand px-5 py-3 text-sm font-bold text-white shadow-premium transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50";

/** Variante secundaria adaptada a la misma altura mínima (`min-h-12`) y reparto parejo en el pie. */
export const BOTON_SECUNDARIO = BOTON_MODAL_SECUNDARIO.replace("min-h-11", "min-h-12").replace(" sm:flex-none", "");
