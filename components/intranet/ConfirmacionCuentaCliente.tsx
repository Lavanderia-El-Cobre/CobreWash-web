"use client";
import Link from "next/link";
import { UserRoundPlus } from "lucide-react";

/**
 * Confirmación que el personal marca al registrar un cliente con cuenta: el
 * cliente recibirá un enlace para activarla y deberá aceptar personalmente los
 * términos y el aviso de privacidad al ingresar por primera vez.
 */
export default function ConfirmacionCuentaCliente({ marcada, onChange, disabled = false }: { marcada: boolean; onChange: (valor: boolean) => void; disabled?: boolean }) {
  return <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-brand-100 bg-brand-50/50 p-3 text-xs leading-relaxed text-stone-600 dark:border-white/10 dark:bg-white/5 dark:text-stone-300">
    <input type="checkbox" required checked={marcada} disabled={disabled} onChange={e => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-brand-600" />
    <span>
      <UserRoundPlus className="mr-1 inline h-3.5 w-3.5 text-brand-600" />
      Confirmo que informé al cliente que se le creará una cuenta, que recibirá un correo para activarla y que al ingresar deberá aceptar los{" "}
      <Link href="/terminos" target="_blank" rel="noopener noreferrer" className="font-bold text-brand-700 underline dark:text-brand-400">Términos y Condiciones</Link> y el{" "}
      <Link href="/privacidad" target="_blank" rel="noopener noreferrer" className="font-bold text-brand-700 underline dark:text-brand-400">Aviso de Privacidad</Link>.
    </span>
  </label>;
}
