"use client";

import { Loader2, UserRoundPen } from "lucide-react";
import type { EtapaVisible } from "@/lib/produccion/modelo";
import GlassSelect from "@/components/ui/GlassSelect";
import ModalIntranet, { BOTON_MODAL_PRIMARIO, BOTON_MODAL_SECUNDARIO } from "@/components/intranet/ModalIntranet";

/** Estado controlado del formulario de asignación o reasignación de operario en una comanda. */
export type AsignacionOperario = { comandaId: string; numero: string; etapaId: string; etapas: EtapaVisible[]; operarioId: string; motivo: string };
type Props = {
  valor: AsignacionOperario;
  operarios: { id: string; nombre: string; apellido?: string | null }[];
  guardando: boolean; error: string;
  onChange: (valor: AsignacionOperario) => void;
  onSubmit: (event: React.FormEvent) => void;
  onCerrar: () => void;
};
const inputStyle = "mt-1.5 w-full rounded-xl border border-stone-200/80 bg-stone-50/50 px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-brand-500/50 focus:bg-white dark:border-white/10 dark:bg-stone-800/50 dark:focus:bg-stone-900";

/**
 * Modal controlado para asignar o reasignar un operario a una etapa pendiente o en curso.
 * Las etapas ya completadas se excluyen de la selección y cambiar de etapa reinicia el
 * operario elegido para evitar asignaciones accidentales.
 */
export default function AsignarOperarioModal({ valor, operarios, guardando, error, onChange, onSubmit, onCerrar }: Props) {
  const actual = valor.etapas.find((e) => e.id === valor.etapaId);
  return <ModalIntranet
    onCerrar={onCerrar}
    bloqueado={guardando}
    onSubmit={onSubmit}
    icono={UserRoundPen}
    etiqueta="Producción"
    titulo="Asignar operario"
    idTitulo="titulo-reasignacion"
    etiquetaCerrar="Cerrar asignación"
    enfoqueInicial='[aria-haspopup="listbox"]'
    pie={<>
      <button type="button" disabled={guardando} onClick={onCerrar} className={BOTON_MODAL_SECUNDARIO}>Cancelar</button>
      <button disabled={guardando || !valor.operarioId || !actual || !operarios.length} className={BOTON_MODAL_PRIMARIO}>{guardando && <Loader2 className="h-4 w-4 animate-spin" />}{guardando ? "Guardando…" : "Confirmar asignación"}</button>
    </>}
  >
    <div className="space-y-5">
      <div className="grid gap-3 rounded-2xl bg-stone-50 p-4 text-sm sm:grid-cols-2 dark:bg-white/5"><div><p className="text-xs text-stone-400">Comanda</p><p className="font-bold text-brand-600 dark:text-brand-400">{valor.numero}</p></div><div><p className="text-xs text-stone-400">Operario actual</p><p className="font-semibold">{actual?.asignadoA ?? "Sin asignar"}</p></div></div>
      {error && <p role="alert" className="rounded-xl bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-300">{error}</p>}
      <fieldset disabled={guardando} className="space-y-5">
        <div className="space-y-1.5"><p className="text-sm font-semibold">Etapa <span className="text-red-500">*</span></p><GlassSelect ariaLabel="Etapa" value={valor.etapaId} disabled={guardando} onChange={(v) => onChange({ ...valor, etapaId: v, operarioId: "" })} options={valor.etapas.filter((e) => e.estado !== "COMPLETADA").map((e) => ({ value: e.id, label: `${e.orden}. ${e.nombre}` }))} /></div>
        <div className="space-y-1.5"><p className="text-sm font-semibold">Operario <span className="text-red-500">*</span></p><GlassSelect ariaLabel="Operario" value={valor.operarioId} disabled={guardando} placeholder="Selecciona un operario" onChange={(v) => onChange({ ...valor, operarioId: v })} options={operarios.map((o) => ({ value: o.id, label: [o.nombre, o.apellido].filter(Boolean).join(" ") }))} /></div>
        {!operarios.length && <p className="text-xs text-amber-700 dark:text-amber-300">No hay operarios activos disponibles.</p>}
        <label className="block text-sm font-semibold">Motivo <span className="font-normal text-stone-400">(opcional)</span><textarea maxLength={200} rows={3} placeholder="Indica el motivo de la asignación…" value={valor.motivo} onChange={(e) => onChange({ ...valor, motivo: e.target.value })} className={`${inputStyle} resize-none`} /></label>
      </fieldset>
      <div className="rounded-xl border border-stone-200/70 bg-stone-50/70 p-3.5 text-xs text-stone-500 dark:border-white/5 dark:bg-white/5">La asignación quedará registrada con fecha y responsable en el historial de la comanda.</div>
    </div>
  </ModalIntranet>;
}
