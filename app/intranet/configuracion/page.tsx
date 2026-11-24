"use client";

import { useState } from "react";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Clock3, Laptop, Loader2, LogOut, Moon, Palette, ShieldCheck, Sun, UserRound } from "lucide-react";
import { auth } from "@/lib/firebase/client";
import { useTheme, type Theme } from "@/components/providers/ThemeProvider";
import { useRoleGuard } from "@/components/intranet/useRoleGuard";
import { useUsuarioActualContext } from "@/components/intranet/AuthGuard";
import EncabezadoSeccion from "@/components/intranet/EncabezadoSeccion";
import LimitesEtapasConfig from "@/components/intranet/LimitesEtapasConfig";
import CambiarContrasena from "@/components/intranet/CambiarContrasena";

type Tab = "apariencia" | "perfil" | "seguridad" | "limites";

const TEMAS: { id: Theme; label: string; detalle: string; icono: React.ElementType; vista: string }[] = [
  { id: "light", label: "Claro", detalle: "Fondo cálido y luminoso", icono: Sun, vista: "from-orange-50 to-stone-100" },
  { id: "dark", label: "Oscuro", detalle: "Ideal para turnos de noche", icono: Moon, vista: "from-stone-800 to-stone-950" },
  { id: "system", label: "Sistema", detalle: "Sigue el ajuste del equipo", icono: Laptop, vista: "from-orange-50 via-stone-400 to-stone-900" },
];

function Tarjeta({ icono: Icono, titulo, descripcion, children }: { icono: React.ElementType; titulo: string; descripcion: string; children: React.ReactNode }) {
  return (
    <section className="glass-panel space-y-5 rounded-2xl p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-500/10 text-brand-600 dark:text-brand-400"><Icono className="h-5 w-5" /></span>
        <div>
          <h2 className="font-display text-lg font-extrabold text-stone-900 dark:text-white">{titulo}</h2>
          <p className="mt-0.5 text-sm text-stone-500 dark:text-stone-400">{descripcion}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

export default function ConfiguracionPage() {
  const permitido = useRoleGuard(["admin", "recepcionista", "operario", "repartidor", "conductor"]);
  const usuario = useUsuarioActualContext();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("apariencia");
  const [error, setError] = useState("");
  const tabs: { id: Tab; label: string; detalle: string; icono: React.ElementType }[] = [
    { id: "apariencia", label: "Apariencia", detalle: "Tema de la intranet", icono: Palette },
    { id: "perfil", label: "Mi perfil", detalle: "Datos de tu cuenta", icono: UserRound },
    { id: "seguridad", label: "Seguridad", detalle: "Contraseña y sesión", icono: ShieldCheck },
    ...(usuario?.rol.nombre === "admin" ? [{ id: "limites" as const, label: "Límites de etapas", detalle: "Alertas de producción", icono: Clock3 }] : []),
  ];
  if (!permitido || !usuario) {
    return <p className="flex items-center justify-center gap-2 py-24 text-sm text-stone-500"><Loader2 className="h-5 w-5 animate-spin text-brand-500" />Cargando configuración…</p>;
  }
  const nombre = [usuario.nombre, usuario.apellido].filter(Boolean).join(" ");
  const iniciales = [usuario.nombre, usuario.apellido].filter(Boolean).map((p) => p!.trim()[0]).join("").toUpperCase() || "?";

  return (
    <div className="min-h-screen space-y-6 p-4 text-stone-900 sm:p-6 dark:text-stone-100">
      <EncabezadoSeccion
        antetitulo="Cuenta · Preferencias"
        titulo="Configuración"
        descripcion="Ajusta la apariencia, revisa tu perfil y protege el acceso a tu cuenta."
      />

      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start">
        <motion.nav
          aria-label="Secciones de configuración"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="glass-panel -mx-1 flex gap-1 overflow-x-auto rounded-2xl p-1.5 lg:sticky lg:top-4 lg:mx-0 lg:flex-col lg:overflow-visible"
        >
          {tabs.map((t) => {
            const activo = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={activo}
                onClick={() => setTab(t.id)}
                className={`relative flex shrink-0 cursor-pointer items-center gap-3 rounded-xl px-3.5 py-2.5 text-left transition-colors lg:py-3 ${activo ? "text-white" : "text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-white/5"}`}
              >
                {activo && <motion.span layoutId="config-activa" transition={{ type: "spring", stiffness: 420, damping: 34 }} className="absolute inset-0 rounded-xl bg-gradient-brand shadow-premium" />}
                <t.icono className="relative h-4 w-4 shrink-0" />
                <span className="relative">
                  <span className="block whitespace-nowrap text-sm font-bold">{t.label}</span>
                  <span className={`hidden text-[11px] lg:block ${activo ? "text-white/80" : "text-stone-400"}`}>{t.detalle}</span>
                </span>
              </button>
            );
          })}
        </motion.nav>

        <div className="min-w-0 max-w-3xl">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-6"
            >
              {tab === "apariencia" && (
                <Tarjeta icono={Palette} titulo="Apariencia" descripcion="Se guarda automáticamente en este navegador.">
                  <div className="grid gap-3 sm:grid-cols-3">
                    {TEMAS.map(({ id, label, detalle, icono: Icono, vista }) => {
                      const activo = theme === id;
                      return (
                        <motion.button
                          key={id}
                          type="button"
                          whileHover={{ y: -2 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setTheme(id)}
                          aria-pressed={activo}
                          className={`group relative cursor-pointer overflow-hidden rounded-2xl border p-3 text-left transition-colors ${activo ? "border-brand-500 ring-2 ring-brand-500/20" : "border-stone-200/80 hover:border-brand-300 dark:border-white/10"}`}
                        >
                          <span aria-hidden className={`block h-20 rounded-xl bg-gradient-to-br ${vista} p-2`}>
                            <span className="flex h-full gap-1.5">
                              <span className="w-1/4 rounded-md bg-white/50 dark:bg-white/10" />
                              <span className="flex flex-1 flex-col gap-1.5">
                                <span className="h-2 w-1/2 rounded bg-brand-500/70" />
                                <span className="flex-1 rounded-md bg-white/60 dark:bg-white/10" />
                              </span>
                            </span>
                          </span>
                          <span className="mt-3 flex items-center gap-2 text-sm font-bold"><Icono className="h-4 w-4 text-brand-500" />{label}</span>
                          <span className="mt-0.5 block text-xs text-stone-500 dark:text-stone-400">{detalle}</span>
                          {activo && <span className="absolute right-4 top-4 grid h-6 w-6 place-items-center rounded-full bg-brand-500 text-white shadow"><Check className="h-3.5 w-3.5" /></span>}
                        </motion.button>
                      );
                    })}
                  </div>
                </Tarjeta>
              )}

              {tab === "perfil" && (
                <Tarjeta icono={UserRound} titulo="Mi perfil" descripcion="Para corregir los datos de tu perfil, solicita el cambio a administración en la sección Usuarios.">
                  <div className="flex items-center gap-4 rounded-2xl bg-stone-50/80 p-4 dark:bg-white/5">
                    <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-brand font-display text-lg font-extrabold text-white shadow-premium">{iniciales}</span>
                    <div className="min-w-0">
                      <p className="truncate font-display text-lg font-extrabold">{nombre || "Sin nombre"}</p>
                      <span className="mt-1 inline-block rounded-full bg-brand-500/10 px-2.5 py-0.5 text-[11px] font-bold capitalize text-brand-700 dark:text-brand-400">{usuario.rol.nombre}</span>
                    </div>
                  </div>
                  <dl className="grid gap-3 sm:grid-cols-2">
                    {[["Nombre", nombre], ["Correo", usuario.email], ["RUT", usuario.rut], ["Teléfono", usuario.telefono], ["Rol", usuario.rol.nombre]].map(([label, value]) => (
                      <div key={label} className="rounded-xl border border-stone-200/70 p-3.5 dark:border-white/10">
                        <dt className="text-[10px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">{label}</dt>
                        <dd className="mt-1 break-words text-sm font-semibold">{value || "Sin registrar"}</dd>
                      </div>
                    ))}
                  </dl>
                </Tarjeta>
              )}

              {tab === "seguridad" && (
                <>
                  <Tarjeta icono={ShieldCheck} titulo="Contraseña" descripcion="Usa una contraseña única que no utilices en otros servicios.">
                    <CambiarContrasena />
                  </Tarjeta>
                  <Tarjeta icono={LogOut} titulo="Sesión de este navegador" descripcion={`Sesión iniciada con ${usuario.email}.`}>
                    <button
                      type="button"
                      onClick={async () => { try { await signOut(auth); router.replace("/?login=1"); } catch { setError("No se pudo cerrar la sesión. Intenta nuevamente."); } }}
                      className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-600 transition-colors hover:bg-red-100 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300"
                    >
                      <LogOut className="h-4 w-4" />Cerrar esta sesión
                    </button>
                    {error && <p role="alert" className="text-sm text-red-600 dark:text-red-300">{error}</p>}
                  </Tarjeta>
                </>
              )}

              {tab === "limites" && usuario.rol.nombre === "admin" && <LimitesEtapasConfig />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
