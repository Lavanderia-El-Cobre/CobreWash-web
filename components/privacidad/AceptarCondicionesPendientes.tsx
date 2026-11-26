"use client";
import { useState } from "react";
import { Loader2, LogOut, ShieldCheck } from "lucide-react";
import { dataConnect } from "@/lib/firebase/client";
import { aceptarCondiciones } from "@/lib/firebase/auth-flows";
import { VERSION_PRIVACIDAD, VERSION_TERMINOS } from "@/lib/privacidad/modelo";
import AceptacionTerminos from "@/components/privacidad/AceptacionTerminos";
import AutorizacionDatos, { useAvisoPublicado } from "@/components/privacidad/AutorizacionDatos";

/**
 * Pantalla bloqueante para clientes cuya cuenta fue creada por el personal o que
 * aceptaron una versión anterior: exige aceptación directa del titular antes de usar
 * el portal.
 *
 * @param props.nombre - Nombre del titular para personalizar el saludo inicial.
 * @param props.primeraVez - `true` cuando la cuenta se creó en recepción y nunca aceptó condiciones; `false` si es actualización de versión.
 * @param props.onSalir - Acción para cerrar sesión si el titular decide no aceptar ahora.
 */
export default function AceptarCondicionesPendientes({ nombre, primeraVez, onSalir }: { nombre: string; primeraVez: boolean; onSalir: () => void }) {
  const publicada = useAvisoPublicado();
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const [autorizaDatos, setAutorizaDatos] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  async function aceptar(event: React.FormEvent) {
    event.preventDefault();
    setGuardando(true); setError("");
    try {
      await aceptarCondiciones(dataConnect, { aceptaTerminos, versionTerminos: VERSION_TERMINOS, autorizaDatos, versionPrivacidad: VERSION_PRIVACIDAD });
      // Notifica al layout/guard de sesión para recargar el perfil y desbloquear el portal sin refrescar la página.
      window.dispatchEvent(new Event("cobre:perfil-actualizado"));
    } catch (e) {
      setError(e instanceof Error && e.message.startsWith("Lee") ? e.message : "No pudimos registrar tu aceptación. Intenta nuevamente.");
    } finally { setGuardando(false); }
  }

  return <main className="relative isolate flex min-h-screen items-center justify-center overflow-hidden px-4 py-12 text-stone-900">
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[600px] bg-gradient-to-b from-brand-50/80 via-copper-50/40 to-transparent" />
    <form onSubmit={aceptar} className="glass-card w-full max-w-lg space-y-5 rounded-3xl bg-white/75 p-6 shadow-premium backdrop-blur-lg sm:p-8">
      <span className="inline-flex rounded-2xl bg-gradient-brand p-3 text-white shadow-premium"><ShieldCheck className="h-6 w-6" /></span>
      <div className="space-y-2">
        <h1 className="font-display text-2xl font-extrabold">{primeraVez ? `Bienvenido, ${nombre}` : "Actualizamos nuestras condiciones"}</h1>
        <p className="text-sm leading-relaxed text-stone-600">{primeraVez
          ? "Tu cuenta fue creada en nuestra recepción. Antes de ver tus pedidos, revisa y acepta los Términos y Condiciones y el Aviso de Privacidad."
          : "Publicamos una nueva versión de los Términos y Condiciones y del Aviso de Privacidad. Revísalos y acéptalos para seguir usando tu cuenta."}</p>
      </div>
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">{error}</p>}
      <AceptacionTerminos aceptada={aceptaTerminos} onChange={setAceptaTerminos} disabled={!publicada} />
      <AutorizacionDatos finalidad="cuenta" aceptada={autorizaDatos} onChange={setAutorizaDatos} publicada={publicada} />
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={guardando || !publicada || !aceptaTerminos || !autorizaDatos} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-brand px-5 py-3 text-sm font-bold text-white shadow-premium transition-shadow hover:shadow-lg disabled:opacity-50">
          {guardando && <Loader2 className="h-4 w-4 animate-spin" />}Aceptar y continuar
        </button>
        <button type="button" onClick={onSalir} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-stone-200 bg-white/60 px-4 text-sm font-semibold text-stone-500 hover:bg-stone-50"><LogOut className="h-4 w-4" />Salir</button>
      </div>
    </form>
  </main>;
}
