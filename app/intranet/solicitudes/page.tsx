"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, RefreshCw } from "lucide-react";
import { useRoleGuard } from "@/components/intranet/useRoleGuard";
import EncabezadoSeccion, { BOTON_ENCABEZADO_SECUNDARIO } from "@/components/intranet/EncabezadoSeccion";
import GlassSelect from "@/components/ui/GlassSelect";
import { dataConnect } from "@/lib/firebase/client";
import { actualizarEstadoSolicitudContacto, getSolicitudesContacto, SolicitudContactoEstado, type GetSolicitudesContactoData } from "@/src/dataconnect-generated";
import { fechaSeguimiento } from "@/lib/seguimiento/publico";
import { TAMANO_BANDEJA, variablesBandeja } from "@/lib/solicitudes/bandeja";

const etiquetas: Record<SolicitudContactoEstado, string> = { RECIBIDA: "Recibida", EN_REVISION: "En revisión", ATENDIDA: "Atendida" };
export default function SolicitudesPage() {
  const permitido = useRoleGuard(["admin", "recepcionista"]);
  const [datos, setDatos] = useState<GetSolicitudesContactoData | null>(null);
  const [estado, setEstado] = useState<SolicitudContactoEstado | null>(null);
  const [pagina, setPagina] = useState(0);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState<string | null>(null);
  const [error, setError] = useState("");
  const version = useRef(0);
  const cargar = useCallback(async () => {
    if (!permitido) return;
    const solicitud = ++version.current;
    setCargando(true); setError("");
    try {
      const result = await getSolicitudesContacto(dataConnect, variablesBandeja(estado, pagina),{ fetchPolicy: "SERVER_ONLY" });
      if (solicitud === version.current) setDatos(result.data);
    } catch { if (solicitud === version.current) setError("No se pudo cargar la bandeja. Intenta nuevamente."); }
    finally { if (solicitud === version.current) setCargando(false); }
  }, [estado, pagina, permitido]);
  const invalidar = useCallback(() => { version.current++; }, []);
  useEffect(() => { const timer = setTimeout(() => { setDatos(null); void cargar(); }, 0); return () => { clearTimeout(timer); invalidar(); }; }, [cargar, invalidar]);
  if (!permitido) return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-brand-500" /></div>;
  const total = datos?.total[0]?._count ?? 0;
  return <div className="min-h-screen space-y-6 p-4 text-stone-900 sm:p-6 dark:text-stone-100">
    <EncabezadoSeccion
      antetitulo="Comercial · Sitio web"
      titulo="Solicitudes de cotización"
      descripcion="Solicitudes recibidas desde el sitio web. El contacto se gestiona desde esta bandeja."
      acciones={<button disabled={cargando} onClick={() => void cargar()} className={BOTON_ENCABEZADO_SECUNDARIO}><RefreshCw className={`h-4 w-4 ${cargando ? "animate-spin" : ""}`} />Actualizar</button>}
    />
    <div className="glass-panel flex flex-wrap items-center justify-between gap-3 rounded-2xl px-5 py-4"><div className="w-full sm:w-56"><GlassSelect ariaLabel="Estado" value={estado ?? ""} onChange={v => { setPagina(0); setEstado((v || null) as SolicitudContactoEstado | null); }} options={[{ value: "", label: "Todas" }, ...Object.entries(etiquetas).map(([value, label]) => ({ value, label }))]} /></div><span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700 dark:bg-brand-500/10 dark:text-brand-400">{total} solicitudes</span></div>
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
    {cargando && <p role="status" className="flex items-center gap-2 text-sm text-stone-500"><Loader2 className="h-4 w-4 animate-spin" />Cargando solicitudes…</p>}
    {!cargando && datos?.solicitudContactos.length === 0 && <p className="glass-panel rounded-2xl px-6 py-12 text-center text-sm text-stone-500">No hay solicitudes en este estado.</p>}
    <div className="space-y-3">{datos?.solicitudContactos.map((s, i) => <motion.article key={s.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.04, 0.3) }} className="glass-panel space-y-3 rounded-2xl p-5">
      <div className="flex flex-wrap justify-between gap-3"><h2 className="font-bold">{s.nombre}</h2><span className="text-xs text-stone-500">{fechaSeguimiento(s.creadoEn)}</span></div>
      <p className="text-sm">Servicio: {s.servicio}</p><p className="whitespace-pre-wrap break-words text-sm">{s.mensaje}</p>
      <div className="flex flex-wrap gap-4 text-sm"><a className="text-brand-600 underline" href={`mailto:${encodeURIComponent(s.email)}`}>{s.email}</a>{s.telefono && <a className="text-brand-600 underline" href={`tel:${s.telefono.replace(/[^+\d]/g, "")}`}>{s.telefono}</a>}</div>
      <div className="flex flex-wrap items-center gap-3 border-t border-stone-200/70 pt-3 text-sm dark:border-white/5"><span className="text-xs font-bold uppercase tracking-wider text-stone-500">Seguimiento</span><div className="w-full sm:w-52"><GlassSelect ariaLabel={`Estado de solicitud de ${s.nombre}`} disabled={guardando !== null} value={s.estado} onChange={async valor => {
        if (valor === s.estado) return;
        const nuevo = valor as SolicitudContactoEstado; setGuardando(s.id); setError("");
        try { await actualizarEstadoSolicitudContacto(dataConnect, { id: s.id, estado: nuevo }); await cargar(); }
        catch { setError("No se pudo guardar el estado. Reintenta."); }
        finally { setGuardando(null); }
      }} options={Object.entries(etiquetas).map(([value, label]) => ({ value, label }))} /></div></div>
    </motion.article>)}</div>
    <nav aria-label="Páginas de solicitudes" className="flex items-center justify-between gap-4 text-sm"><button className="min-h-11 rounded-xl border border-stone-200 px-4 py-2 font-semibold disabled:opacity-40 dark:border-white/10" disabled={cargando || pagina === 0} onClick={() => setPagina(p => p - 1)}>Anterior</button><span>Página {pagina + 1}</span><button className="min-h-11 rounded-xl border border-stone-200 px-4 py-2 font-semibold disabled:opacity-40 dark:border-white/10" disabled={cargando || (pagina + 1) * TAMANO_BANDEJA >= total} onClick={() => setPagina(p => p + 1)}>Siguiente</button></nav>
  </div>;
}
