"use client";
import { useState } from "react";
import { auth } from "@/lib/firebase/client";
import { cambiarContrasena } from "@/lib/firebase/seguridad-cuenta";
import { mapAuthError } from "@/lib/firebase/errors";

/**
 * Formulario de cambio de contraseña para el usuario autenticado.
 * Exige la contraseña actual para reautenticar en Firebase Auth y traduce códigos de error
 * del SDK a mensajes legibles para el usuario.
 */
export default function CambiarContrasena() {
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  return <form className="space-y-4" onSubmit={async e => {
    e.preventDefault(); if (guardando) return;
    setGuardando(true); setMensaje(""); setError("");
    try {
      await cambiarContrasena(auth, actual, nueva, confirmacion);
      setActual(""); setNueva(""); setConfirmacion(""); setMensaje("Tu contraseña se actualizó correctamente.");
    } catch (cause) {
      // Distingue errores tipados de Firebase Auth (`code`) de validaciones locales de negocio.
      setError(cause && typeof cause === "object" && "code" in cause ? mapAuthError(cause) : cause instanceof Error ? cause.message : "No se pudo actualizar tu contraseña.");
    } finally { setGuardando(false); }
  }}>
    <h3 className="sr-only">Cambiar contraseña</h3>
    {[["Contraseña actual", actual, setActual, "current-password"], ["Nueva contraseña", nueva, setNueva, "new-password"], ["Confirmar nueva contraseña", confirmacion, setConfirmacion, "new-password"]].map(([label, value, cambiar, autocomplete]) =>
      <label key={label as string} className="block text-[10px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">{label as string}<input required type="password" disabled={guardando} autoComplete={autocomplete as string} value={value as string} onChange={e => (cambiar as (s: string) => void)(e.target.value)} className="mt-1.5 w-full rounded-xl border border-stone-200/80 bg-stone-50/70 px-4 py-3 text-base font-medium normal-case tracking-normal text-stone-800 outline-none transition-all focus:border-brand-500 disabled:opacity-60 sm:text-sm dark:border-white/10 dark:bg-stone-800/80 dark:text-stone-200" /></label>)}
    <button disabled={guardando} className="min-h-11 cursor-pointer rounded-xl bg-gradient-brand px-5 py-3 text-sm font-bold text-white shadow-premium transition-all hover:shadow-lg disabled:opacity-50">{guardando ? "Actualizando…" : "Actualizar contraseña"}</button>
    {error && <p role="alert" className="rounded-xl bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-300">{error}</p>}
    {mensaje && <p role="status" className="rounded-xl bg-green-500/10 p-3 text-sm text-green-700 dark:text-green-300">{mensaje}</p>}
  </form>;
}
