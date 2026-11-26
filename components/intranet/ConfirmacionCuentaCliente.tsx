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

/**
 * Opción para registrar al cliente nuevo en la plataforma. Marcada, el correo
 * es obligatorio y se crea su cuenta; sin marcar, solo queda la ficha.
 */
export function OpcionCuentaCliente({ marcada, onChange, disabled = false }: { marcada: boolean; onChange: (valor: boolean) => void; disabled?: boolean }) {
  return <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-xs leading-relaxed transition-colors ${marcada
    ? "border-brand-300 bg-brand-50/70 text-stone-700 dark:border-brand-500/40 dark:bg-brand-500/10 dark:text-stone-200"
    : "border-stone-200 bg-stone-50 text-stone-600 dark:border-white/10 dark:bg-stone-800 dark:text-stone-300"}`}>
    <input type="checkbox" checked={marcada} disabled={disabled} onChange={e => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-brand-600" />
    <span>
      <strong className="block text-stone-800 dark:text-stone-100">Registrar al cliente en la plataforma</strong>
      {marcada
        ? "Se creará su cuenta con el correo indicado (obligatorio). Recibirá un enlace para crear su propia contraseña y seguir sus pedidos."
        : "Sin marcar, solo se guarda la ficha del cliente y el correo es opcional."}
    </span>
  </label>;
}
