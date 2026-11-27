"use client";

import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Megaphone, Plus, Loader2, Clock } from "lucide-react";
import { useRoleGuard } from "@/components/intranet/useRoleGuard";
import { useUsuarioActualContext } from "@/components/intranet/AuthGuard";
import GlassSelect from "@/components/ui/GlassSelect";
import EncabezadoSeccion, { BOTON_ENCABEZADO } from "@/components/intranet/EncabezadoSeccion";
import ModalIntranet, { BOTON_MODAL_PRIMARIO, BOTON_MODAL_SECUNDARIO } from "@/components/intranet/ModalIntranet";
import { publicarAviso } from "@/lib/avisos/publicar";
import { useAvisos } from "@/lib/avisos/useAvisos";
import { AVISOS_POR_PAGINA } from "@/lib/avisos/consultar";
import {
  CONTENIDO_MAXIMO, TITULO_MAXIMO, FORMULARIO_VACIO,
  etiquetaDestinatario, fechaAviso, validarAviso,
} from "@/lib/avisos/modelo";

/**
 * Tablón de comunicación interna (`/intranet/comunicacion`).
 * Accesible para todo el equipo interno (`admin`, `operario`, `recepcionista`, `repartidor`
 * y `conductor`). Solo `admin` puede publicar avisos generales o segmentados por rol; el resto
 * accede en modo solo lectura a los avisos que le corresponden.
 */
export default function ComunicacionPage() {
  const permitido = useRoleGuard(["admin", "operario", "recepcionista", "repartidor", "conductor"]);
  const usuario = useUsuarioActualContext();
  const esAdmin = usuario?.rol.nombre === "admin";

  const [pagina, setPagina] = useState(1);
  const { avisos, total, cargando, error, recargar } = useAvisos(usuario?.id, usuario?.rol.nombre, permitido, pagina);
  const [nuevo, setNuevo] = useState(false);
  const [form, setForm] = useState(FORMULARIO_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [errorPublicacion, setErrorPublicacion] = useState("");
  const [mensaje, setMensaje] = useState("");
  // Bloqueo síncrono para evitar doble envío y cierre del modal mientras la mutación está en vuelo.
  const envioEnCurso = useRef(false);

  const cerrarModal = () => {
    if (envioEnCurso.current) return;
    setNuevo(false);
    setErrorPublicacion("");
  };

  const publicar = async () => {
    if (!esAdmin || envioEnCurso.current) return;
    let entrada;
    try { entrada = validarAviso(form); }
    catch (error) {
      setErrorPublicacion(error instanceof Error ? error.message : "Revisa los datos del aviso.");
      return;
    }
    envioEnCurso.current = true;
    setGuardando(true);
    setErrorPublicacion("");
    setMensaje("");
    try {
      await publicarAviso(entrada);
      setForm(FORMULARIO_VACIO);
      setNuevo(false);
      setMensaje("Aviso publicado correctamente.");
      if (pagina === 1) await recargar();
      else setPagina(1);
    } catch {
      setErrorPublicacion("No se pudo confirmar la publicación. Revisa los avisos antes de volver a intentarlo.");
    } finally {
      envioEnCurso.current = false;
      setGuardando(false);
    }
  };

  if (!permitido) {
    return (
      <div className="flex h-full items-center justify-center py-24">
        <Loader2 className="w-6 h-6 text-brand-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen text-stone-900 dark:text-stone-100 p-4 sm:p-6 space-y-6">
      <EncabezadoSeccion
        antetitulo={esAdmin ? "Equipo · Comunicación interna" : "Equipo · Avisos"}
        titulo={esAdmin ? "Comunicación Interna" : "Avisos"}
        descripcion={esAdmin ? "Publica avisos para los equipos de la lavandería" : "Avisos generales y de tu equipo · solo lectura"}
        acciones={esAdmin && (
          <button
            onClick={() => { setErrorPublicacion(""); setMensaje(""); setNuevo(true); }}
            className={BOTON_ENCABEZADO}
          >
            <Plus className="w-4 h-4" />
            Publicar aviso
          </button>
        )}
      />

      {mensaje && <p role="status" className="text-sm text-green-700 dark:text-green-400">{mensaje}</p>}
      {error && (
        <div role="alert" className="rounded-xl border border-red-200 dark:border-red-500/20 p-4 text-sm text-red-700 dark:text-red-400">
          <p>{error}</p>
          <button onClick={() => void recargar()} className="mt-2 font-bold cursor-pointer">Reintentar</button>
        </div>
      )}
      {cargando && <p role="status" className="flex items-center gap-2 text-sm text-stone-500"><Loader2 className="w-4 h-4 animate-spin" /> Cargando avisos…</p>}
      {!cargando && !error && avisos.length === 0 && (
        <p className="rounded-2xl border border-stone-200 dark:border-white/10 p-8 text-center text-sm text-stone-500">No hay avisos publicados.</p>
      )}
      <div className="space-y-3">
        {avisos.map((a, i) => (
          <motion.div
            key={a.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-white/5 rounded-2xl p-5 shadow-sm dark:shadow-none"
          >
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-brand-100 dark:bg-brand-500/10 flex items-center justify-center shrink-0">
                <Megaphone className="w-5 h-5 text-brand-600 dark:text-brand-400" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-stone-900 dark:text-white font-bold text-sm break-words">{a.titulo}</h3>
                  <span className="text-[10px] font-bold bg-stone-100 dark:bg-white/5 text-stone-500 dark:text-stone-400 px-2 py-0.5 rounded-full">
                    {etiquetaDestinatario(a.rolDestinatario?.nombre)}
                  </span>
                </div>
                <p className="text-stone-600 dark:text-stone-300 text-sm mt-1.5 leading-relaxed whitespace-pre-wrap break-words">{a.contenido}</p>
                <p className="text-stone-400 dark:text-stone-600 text-[11px] mt-2 flex items-center gap-1.5">
                  <Clock className="w-3 h-3 shrink-0" /> {[a.autor.nombre, a.autor.apellido].filter(Boolean).join(" ")} · {fechaAviso(a.fechaPublicacion)}
                </p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {total > AVISOS_POR_PAGINA && (
        <nav aria-label="Páginas de avisos" className="flex items-center justify-center gap-4 text-sm">
          <button disabled={pagina === 1 || cargando} onClick={() => setPagina((p) => p - 1)} className="font-bold disabled:opacity-40 cursor-pointer">Anterior</button>
          <span>Página {pagina} de {Math.ceil(total / AVISOS_POR_PAGINA)}</span>
          <button disabled={pagina * AVISOS_POR_PAGINA >= total || cargando} onClick={() => setPagina((p) => p + 1)} className="font-bold disabled:opacity-40 cursor-pointer">Siguiente</button>
        </nav>
      )}

      <AnimatePresence>
        {nuevo && esAdmin && (
          <ModalIntranet
            onCerrar={cerrarModal}
            bloqueado={guardando}
            icono={Megaphone}
            etiqueta="Comunicación interna"
            titulo="Publicar aviso"
            subtitulo="Difunde novedades al equipo de la lavandería."
            idTitulo="titulo-publicar-aviso"
            etiquetaCerrar="Cerrar publicación de aviso"
            pie={
              <>
                <button onClick={cerrarModal} disabled={guardando} className={BOTON_MODAL_SECUNDARIO}>
                  Cancelar
                </button>
                <button
                  onClick={publicar}
                  disabled={guardando || !form.titulo.trim() || !form.contenido.trim()}
                  className={BOTON_MODAL_PRIMARIO}
                >
                  {guardando ? "Publicando…" : "Publicar aviso"}
                </button>
              </>
            }
          >
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="aviso-titulo" className="text-[10px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">Título</label>
                  <input
                    id="aviso-titulo"
                    maxLength={TITULO_MAXIMO}
                    disabled={guardando}
                    value={form.titulo}
                    onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                    placeholder="Ej: Cambio de turno, mantenimiento o protocolo..."
                    className="w-full px-4 py-3 rounded-xl border border-stone-200/80 dark:border-white/10 bg-stone-50/70 dark:bg-stone-800/80 text-stone-800 dark:text-stone-200 text-sm focus:outline-none focus:border-brand-500 transition-all placeholder-stone-400"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="aviso-contenido" className="text-[10px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">Contenido</label>
                  <textarea
                    id="aviso-contenido"
                    maxLength={CONTENIDO_MAXIMO}
                    disabled={guardando}
                    value={form.contenido}
                    onChange={(e) => setForm({ ...form, contenido: e.target.value })}
                    rows={4}
                    placeholder="Escribe el mensaje detallado para el equipo..."
                    className="w-full px-4 py-3 rounded-xl border border-stone-200/80 dark:border-white/10 bg-stone-50/70 dark:bg-stone-800/80 text-stone-800 dark:text-stone-200 text-sm focus:outline-none focus:border-brand-500 transition-all resize-none placeholder-stone-400"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">Destinatario</label>
                  <GlassSelect
                    disabled={guardando}
                    value={form.destinatario}
                    onChange={(v) => { if (!guardando) setForm({ ...form, destinatario: v }); }}
                    ariaLabel="Destinatario"
                    options={[
                      { value: "todos", label: "Todos los equipos" },
                      { value: "operario", label: "Solo Operarios" },
                      { value: "recepcionista", label: "Solo Recepción" },
                      { value: "repartidor", label: "Solo Reparto" },
                    ]}
                  />
                </div>
                {errorPublicacion && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{errorPublicacion}</p>}
              </div>
          </ModalIntranet>
        )}
      </AnimatePresence>
    </div>
  );
}
