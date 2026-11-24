"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  Clock,
  Gauge,
  History,
  Loader2,
  Navigation,
  PackageCheck,
  RotateCcw,
  Truck,
  User,
} from "lucide-react";
import Link from "next/link";
import { registrarError } from "@/lib/registro-seguro";
import { useRoleGuard } from "@/components/intranet/useRoleGuard";
import { useUsuarioActualContext } from "@/components/intranet/AuthGuard";
import FotoEvidencia from "@/components/intranet/FotoEvidencia";
import AdjuntarEvidencia from "@/components/intranet/AdjuntarEvidencia";
import HojaModal, { BOTON_PRIMARIO, BOTON_SECUNDARIO, INPUT_REPARTO, LABEL_REPARTO } from "@/components/intranet/reparto/HojaModal";
import FotosInspeccion from "@/components/intranet/reparto/FotosInspeccion";
import { dataConnect } from "@/lib/firebase/client";
import {
  EstadoVehiculo,
  getPanelRepartidor,
  registrarRetornoFlota,
  registrarSalidaFlota,
  type GetPanelRepartidorData,
} from "@/src/dataconnect-generated";
import {
  calcularMinutosEnRuta,
  formatearDuracionRuta,
  formatearFechaHoraVehiculo,
  mapearErrorVehiculos,
} from "@/lib/vehiculos/flota";
import { calcularKilometrosRecorridos, obtenerInspeccionMomento } from "@/lib/vehiculos/validaciones";
import { confirmarMovimientoFlota, MENSAJE_FOTOS_PENDIENTES, subirEvidenciasInspeccion } from "@/lib/vehiculos/movimientos";
import {
  construirPanelReparto,
  etiquetaVehiculo,
  validarFormMovimiento,
  type FormMovimiento,
  type OpcionVehiculoReparto,
  type SalidaReparto,
} from "@/lib/vehiculos/reparto";

type Aviso = { texto: string; tipo: "exito" | "error" };

const ESTADOS: { valor: EstadoVehiculo; etiqueta: string; ayuda: string; clase: string }[] = [
  { valor: EstadoVehiculo.APTO, etiqueta: "Apto", ayuda: "Sin novedades", clase: "border-green-500 bg-green-500/10 text-green-700 dark:text-green-300" },
  { valor: EstadoVehiculo.CON_OBSERVACIONES, etiqueta: "Con observaciones", ayuda: "Detalles menores", clase: "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  { valor: EstadoVehiculo.NO_APTO, etiqueta: "No apto", ayuda: "No debe circular", clase: "border-red-500 bg-red-500/10 text-red-700 dark:text-red-300" },
];

const etiquetaEstado: Record<EstadoVehiculo, string> = {
  [EstadoVehiculo.APTO]: "Apto",
  [EstadoVehiculo.CON_OBSERVACIONES]: "Con observaciones",
  [EstadoVehiculo.NO_APTO]: "No apto",
};

const chipEstado: Record<EstadoVehiculo, string> = {
  [EstadoVehiculo.APTO]: "bg-green-500/10 text-green-700 dark:text-green-400",
  [EstadoVehiculo.CON_OBSERVACIONES]: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  [EstadoVehiculo.NO_APTO]: "bg-red-500/15 text-red-700 dark:text-red-300",
};

const km = (n: number) => `${n.toLocaleString("es-CL")} km`;

export default function RepartoPage() {
  const permitido = useRoleGuard(["repartidor", "conductor"]);
  const usuario = useUsuarioActualContext();
  const [datos, setDatos] = useState<GetPanelRepartidorData | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState("");
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [form, setForm] = useState<FormMovimiento | null>(null);
  const [formError, setFormError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [movimientoGuardado, setMovimientoGuardado] = useState(false);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [ahora, setAhora] = useState(() => Date.now());
  const operacion = useRef({ salidaId: "", inspeccionId: "" });
  const solicitud = useRef(0);

  const cargar = useCallback(async (silencioso = false) => {
    const actual = ++solicitud.current;
    if (!silencioso) setCargando(true);
    try {
      const { data } = await getPanelRepartidor(dataConnect, { limit: 30 }, { fetchPolicy: "SERVER_ONLY" });
      if (actual === solicitud.current) { setDatos(data); setErrorCarga(""); setAhora(Date.now()); }
    } catch (error) {
      registrarError("No se pudo cargar el panel de reparto:", error);
      if (actual === solicitud.current && !silencioso) setErrorCarga("No se pudieron cargar los vehículos. Revisa tu conexión e intenta nuevamente.");
    } finally {
      if (actual === solicitud.current) setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (!permitido) return;
    const inicial = window.setTimeout(() => void cargar(), 0);
    const refrescar = () => document.visibilityState === "visible" && void cargar(true);
    const timer = window.setInterval(refrescar, 30_000);
    window.addEventListener("focus", refrescar);
    document.addEventListener("visibilitychange", refrescar);
    return () => {
      window.clearTimeout(inicial);
      window.clearInterval(timer);
      window.removeEventListener("focus", refrescar);
      document.removeEventListener("visibilitychange", refrescar);
    };
  }, [cargar, permitido]);

  useEffect(() => {
    if (!aviso) return;
    const t = window.setTimeout(() => setAviso(null), 6000);
    return () => window.clearTimeout(t);
  }, [aviso]);

  const panel = useMemo(() => (datos ? construirPanelReparto(datos, usuario?.id) : null), [datos, usuario?.id]);

  const abrirSalida = (opcion: OpcionVehiculoReparto) => {
    operacion.current = { salidaId: crypto.randomUUID(), inspeccionId: crypto.randomUUID() };
    setMovimientoGuardado(false);
    setFormError("");
    setForm({
      tipo: "salida",
      vehiculoId: opcion.vehiculo.id,
      salidaId: "",
      patente: opcion.vehiculo.patente,
      kilometrajeMinimo: opcion.kilometrajeActual,
      kilometraje: opcion.kilometrajeActual ? String(opcion.kilometrajeActual) : "",
      estadoVehiculo: EstadoVehiculo.APTO,
      observacionesInspeccion: "",
      observacionesRuta: "",
      fotos: [],
    });
  };

  const abrirRegreso = (salida: SalidaReparto) => {
    operacion.current = { salidaId: salida.id, inspeccionId: crypto.randomUUID() };
    const kmSalida = obtenerInspeccionMomento(salida, "ANTES")?.kilometraje ?? 0;
    setMovimientoGuardado(false);
    setFormError("");
    setForm({
      tipo: "regreso",
      vehiculoId: salida.vehiculo.id,
      salidaId: salida.id,
      patente: salida.vehiculo.patente,
      kilometrajeMinimo: kmSalida,
      kilometraje: "",
      estadoVehiculo: EstadoVehiculo.APTO,
      observacionesInspeccion: "",
      // El regreso reemplaza las observaciones de la salida: se parte de las actuales.
      observacionesRuta: salida.observaciones ?? "",
      fotos: [],
    });
  };

  const cerrarForm = useCallback(() => { if (!guardando) { setForm(null); setFormError(""); } }, [guardando]);

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form || !usuario || guardando) return;
    const error = validarFormMovimiento(form, usuario.id);
    if (error) { setFormError(error); return; }
    const kilometraje = Number(form.kilometraje.trim().replace(",", "."));
    const observacionesInspeccion = form.observacionesInspeccion.trim() || null;
    const observacionesRuta = form.observacionesRuta.trim() || null;
    setGuardando(true);
    setFormError("");
    let guardado = movimientoGuardado;
    try {
      const inspeccionId = await confirmarMovimientoFlota(operacion.current.inspeccionId, () =>
        form.tipo === "salida"
          ? registrarSalidaFlota(dataConnect, {
              ...operacion.current,
              vehiculoId: form.vehiculoId,
              repartidorId: usuario.id,
              kilometraje,
              estadoVehiculo: form.estadoVehiculo,
              observaciones: observacionesRuta,
              observacionesInspeccion,
            })
          : registrarRetornoFlota(dataConnect, {
              inspeccionId: operacion.current.inspeccionId,
              salidaId: form.salidaId,
              kilometraje,
              estadoVehiculo: form.estadoVehiculo,
              observacionesRetorno: observacionesRuta,
              observacionesInspeccion,
            }),
      );
      guardado = true;
      setMovimientoGuardado(true);
      await subirEvidenciasInspeccion(inspeccionId, form.fotos);
      setAviso({
        tipo: "exito",
        texto: form.tipo === "salida"
          ? `Salida de ${form.patente} registrada con ${km(kilometraje)}. ¡Buen viaje!`
          : `Regreso de ${form.patente} registrado (+${km(Math.max(0, Number((kilometraje - form.kilometrajeMinimo).toFixed(1))))}).`,
      });
      setForm(null);
      await cargar(true);
    } catch (error) {
      setFormError(guardado ? MENSAJE_FOTOS_PENDIENTES + (error instanceof Error ? error.message : "") : mapearErrorVehiculos(error));
      if (!guardado) void cargar(true);
    } finally {
      setGuardando(false);
    }
  };

  if (!permitido) return null;

  const enCurso = panel?.salidaEnCurso ?? null;
  const antesEnCurso = enCurso ? obtenerInspeccionMomento(enCurso, "ANTES") : null;
  const minutosRuta = enCurso ? calcularMinutosEnRuta(enCurso.fechaSalida, ahora) : 0;

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6 lg:p-8">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-brand-600 dark:text-brand-400">
            <Truck className="h-3 w-3" /> Reparto
          </p>
          <h1 className="font-display text-2xl font-extrabold text-stone-900 dark:text-white">Mi vehículo</h1>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            Elige un vehículo, registra la inspección de salida con fotos y, al volver, el regreso.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void cargar()}
          disabled={cargando}
          aria-label="Actualizar"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-stone-200/80 bg-white/80 text-stone-600 transition hover:bg-stone-100 disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-stone-300"
        >
          {cargando ? <Loader2 className="h-4 w-4 animate-spin text-brand-500" /> : <RotateCcw className="h-4 w-4" />}
        </button>
      </motion.div>

      {aviso && (
        <p role="status" className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${aviso.tipo === "exito" ? "border-green-200 bg-green-50 text-green-700 dark:border-green-500/20 dark:bg-stone-900 dark:text-green-300" : "border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-stone-900 dark:text-red-300"}`}>
          {aviso.texto}
        </p>
      )}
      {errorCarga && <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-500/20 dark:bg-stone-900 dark:text-red-300">{errorCarga}</p>}

      {cargando && !panel ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-brand-500" /></div>
      ) : panel && (
        <>
          {enCurso ? (
            <section aria-labelledby="titulo-en-ruta" className="glass-card rounded-3xl border border-amber-300/60 bg-white/70 p-5 shadow-premium dark:border-amber-500/20 dark:bg-white/5">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-700 dark:text-amber-400">
                <Navigation className="h-3 w-3 animate-pulse" /> En ruta
              </div>
              <h2 id="titulo-en-ruta" className="mt-1 font-display text-xl font-extrabold text-stone-900 dark:text-white">
                {etiquetaVehiculo(enCurso.vehiculo)}
              </h2>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-xs text-stone-500">Salida</dt><dd className="font-semibold">{formatearFechaHoraVehiculo(enCurso.fechaSalida)}</dd></div>
                <div><dt className="text-xs text-stone-500">Tiempo en ruta</dt><dd className="font-semibold">{formatearDuracionRuta(minutosRuta)}</dd></div>
                <div><dt className="text-xs text-stone-500">Km de salida</dt><dd className="font-semibold">{antesEnCurso ? km(antesEnCurso.kilometraje) : "—"}</dd></div>
                <div><dt className="text-xs text-stone-500">Estado al salir</dt><dd>{antesEnCurso ? <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${chipEstado[antesEnCurso.estadoVehiculo]}`}>{etiquetaEstado[antesEnCurso.estadoVehiculo]}</span> : "—"}</dd></div>
              </dl>
              {enCurso.observaciones && <p className="mt-3 text-sm text-stone-600 dark:text-stone-300">Ruta: {enCurso.observaciones}</p>}
              {antesEnCurso && antesEnCurso.fotos.length === 0 && (
                <p className="mt-3 flex items-center gap-2 text-xs font-semibold text-amber-700 dark:text-amber-300"><AlertTriangle className="h-4 w-4" /> La salida no tiene fotografías. Puedes agregarlas en el detalle.</p>
              )}
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <button type="button" onClick={() => abrirRegreso(enCurso)} className={BOTON_PRIMARIO}>
                  <ArrowDownLeft className="h-4 w-4" /> Registrar regreso
                </button>
                <Link href="/intranet/entregas" className={`${BOTON_SECUNDARIO} border border-stone-200/80 dark:border-white/10`}>
                  <PackageCheck className="h-4 w-4" /> Ir a entregas
                </Link>
              </div>
              <DetalleSalida salida={enCurso} abierta={abierta === enCurso.id} onAlternar={() => setAbierta(abierta === enCurso.id ? null : enCurso.id)} alGuardar={() => cargar(true)} />
            </section>
          ) : (
            <section aria-labelledby="titulo-vehiculos" className="space-y-3">
              <h2 id="titulo-vehiculos" className="text-sm font-bold text-stone-700 dark:text-stone-200">Elige el vehículo para salir</h2>
              {panel.vehiculos.length === 0 && (
                <p className="rounded-2xl border border-dashed border-stone-300 p-6 text-center text-sm text-stone-500 dark:border-white/10">
                  No hay vehículos activos. Pide a administración que registre uno.
                </p>
              )}
              <ul className="grid gap-3 sm:grid-cols-2">
                {panel.vehiculos.map((op) => {
                  const disponible = op.disponibilidad === "Disponible";
                  return (
                    <li key={op.vehiculo.id} className={`glass-card flex flex-col rounded-2xl border bg-white/70 p-4 shadow-premium dark:bg-white/5 ${disponible ? "border-stone-200/80 dark:border-white/10" : "border-stone-200/50 opacity-70 dark:border-white/5"}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-display text-lg font-extrabold text-stone-900 dark:text-white">{op.vehiculo.patente}</p>
                          <p className="truncate text-sm text-stone-500 dark:text-stone-400">{op.vehiculo.marca} {op.vehiculo.modelo}{op.vehiculo.anio ? ` · ${op.vehiculo.anio}` : ""}</p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${disponible ? "bg-green-500/10 text-green-700 dark:text-green-400" : "bg-amber-500/15 text-amber-700 dark:text-amber-400"}`}>
                          {disponible ? "Disponible" : "En ruta"}
                        </span>
                      </div>
                      {op.vehiculo.descripcion && <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">{op.vehiculo.descripcion}</p>}
                      <p className="mt-2 flex items-center gap-1.5 text-xs text-stone-500"><Gauge className="h-3.5 w-3.5" /> Último registro: {km(op.kilometrajeActual)}</p>
                      {!disponible && op.conductorActual && <p className="mt-1 flex items-center gap-1.5 text-xs text-stone-500"><User className="h-3.5 w-3.5" /> Lo tiene {op.conductorActual}</p>}
                      <button type="button" disabled={!disponible} onClick={() => abrirSalida(op)} className={`${BOTON_PRIMARIO} mt-3 w-full flex-none`}>
                        <ArrowUpRight className="h-4 w-4" /> Registrar salida
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <section aria-labelledby="titulo-historial" className="space-y-3">
            <h2 id="titulo-historial" className="flex items-center gap-2 text-sm font-bold text-stone-700 dark:text-stone-200"><History className="h-4 w-4" /> Mis salidas recientes</h2>
            {panel.historial.length === 0 ? (
              <p className="text-sm text-stone-500">Aún no registras salidas.</p>
            ) : (
              <ul className="space-y-2">
                {panel.historial.map((s) => {
                  const recorrido = calcularKilometrosRecorridos(s);
                  return (
                    <li key={s.id} className="glass-card rounded-2xl border border-stone-200/80 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-bold text-stone-800 dark:text-stone-100">{etiquetaVehiculo(s.vehiculo)}</p>
                        <span className="flex items-center gap-1 text-xs font-semibold text-stone-500">
                          {s.estado === "FINALIZADA" ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> : <Clock className="h-3.5 w-3.5" />}
                          {s.estado === "FINALIZADA" ? "Finalizada" : s.estado === "CANCELADA" ? "Cancelada" : "Programada"}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-stone-500">
                        {formatearFechaHoraVehiculo(s.fechaSalida ?? s.creadoEn)} → {formatearFechaHoraVehiculo(s.fechaRetorno)}
                        {recorrido !== null && ` · ${km(recorrido)} recorridos`}
                      </p>
                      <DetalleSalida salida={s} abierta={abierta === s.id} onAlternar={() => setAbierta(abierta === s.id ? null : s.id)} alGuardar={() => cargar(true)} />
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}

      <HojaModal
        abierto={!!form}
        titulo={form?.tipo === "regreso" ? `Regreso de ${form.patente}` : `Salida de ${form?.patente ?? ""}`}
        etiqueta={form?.tipo === "regreso" ? "Inspección de regreso" : "Inspección de salida"}
        subtitulo={form ? (form.tipo === "regreso" ? `Kilometraje de salida: ${km(form.kilometrajeMinimo)}` : `Último kilometraje registrado: ${km(form.kilometrajeMinimo)}`) : undefined}
        icono={form?.tipo === "regreso" ? ArrowDownLeft : ArrowUpRight}
        bloqueado={guardando}
        onCerrar={cerrarForm}
        onSubmit={guardar}
        pie={<>
          <button type="button" onClick={cerrarForm} disabled={guardando} className={BOTON_SECUNDARIO}>Cancelar</button>
          <button type="submit" disabled={guardando || (form?.tipo === "salida" && form.estadoVehiculo === EstadoVehiculo.NO_APTO)} className={BOTON_PRIMARIO}>
            {guardando && <Loader2 className="h-4 w-4 animate-spin" />}
            {movimientoGuardado ? "Reintentar fotografías" : form?.tipo === "regreso" ? "Confirmar regreso" : "Confirmar salida"}
          </button>
        </>}
      >
        {form && <>
          <div className="space-y-1.5">
            <label htmlFor="reparto-km" className={LABEL_REPARTO}>Kilometraje {form.tipo === "regreso" ? "de regreso" : "de salida"} (km) *</label>
            <input
              id="reparto-km"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              disabled={guardando || movimientoGuardado}
              value={form.kilometraje}
              onChange={(e) => setForm({ ...form, kilometraje: e.target.value })}
              placeholder={String(form.kilometrajeMinimo)}
              className={INPUT_REPARTO}
            />
          </div>
          <fieldset className="space-y-1.5" disabled={guardando || movimientoGuardado}>
            <legend className={LABEL_REPARTO}>Estado del vehículo *</legend>
            <div className="grid grid-cols-3 gap-2">
              {ESTADOS.map((e) => {
                const activo = form.estadoVehiculo === e.valor;
                return (
                  <button
                    key={e.valor}
                    type="button"
                    aria-pressed={activo}
                    onClick={() => setForm({ ...form, estadoVehiculo: e.valor })}
                    className={`min-h-14 rounded-xl border-2 px-2 py-2 text-center text-xs font-bold transition ${activo ? e.clase : "border-stone-200/80 text-stone-500 dark:border-white/10 dark:text-stone-400"}`}
                  >
                    {e.etiqueta}
                    <span className="block text-[10px] font-medium opacity-80">{e.ayuda}</span>
                  </button>
                );
              })}
            </div>
            {form.tipo === "salida" && form.estadoVehiculo === EstadoVehiculo.NO_APTO && (
              <p role="alert" className="text-xs font-semibold text-red-600 dark:text-red-400">
                Un vehículo no apto no puede salir. Avisa a administración y elige otro vehículo.
              </p>
            )}
          </fieldset>
          <div className="space-y-1.5">
            <label htmlFor="reparto-obs-inspeccion" className={LABEL_REPARTO}>
              Descripción del estado {form.estadoVehiculo !== EstadoVehiculo.APTO && "*"}
            </label>
            <textarea
              id="reparto-obs-inspeccion"
              rows={3}
              maxLength={500}
              disabled={guardando || movimientoGuardado}
              value={form.observacionesInspeccion}
              onChange={(e) => setForm({ ...form, observacionesInspeccion: e.target.value })}
              placeholder="Ej. Combustible 3/4, rayón en puerta trasera, neumáticos OK"
              className={`${INPUT_REPARTO} resize-none`}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="reparto-obs-ruta" className={LABEL_REPARTO}>{form.tipo === "salida" ? "Destino o ruta" : "Comentarios del recorrido"}</label>
            <input
              id="reparto-obs-ruta"
              type="text"
              maxLength={300}
              disabled={guardando || movimientoGuardado}
              value={form.observacionesRuta}
              onChange={(e) => setForm({ ...form, observacionesRuta: e.target.value })}
              placeholder={form.tipo === "salida" ? "Ej. Hoteles centro y retiro faena" : "Ej. Entregas completas, tráfico en Av. Granaderos"}
              className={INPUT_REPARTO}
            />
          </div>
          <FotosInspeccion fotos={form.fotos} onChange={(fotos) => setForm({ ...form, fotos })} disabled={guardando} contexto={form.tipo} />
          {formError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm font-semibold text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">{formError}</p>}
        </>}
      </HojaModal>
    </div>
  );
}

function DetalleSalida({ salida, abierta, onAlternar, alGuardar }: { salida: SalidaReparto; abierta: boolean; onAlternar: () => void; alGuardar: () => Promise<void> }) {
  return (
    <div className="mt-2">
      <button type="button" onClick={onAlternar} aria-expanded={abierta} className="flex min-h-10 items-center gap-1 text-xs font-bold text-brand-600 dark:text-brand-400">
        <ChevronDown className={`h-4 w-4 transition-transform ${abierta ? "rotate-180" : ""}`} /> {abierta ? "Ocultar inspecciones" : "Ver inspecciones y fotos"}
      </button>
      {abierta && (
        <div className="mt-2 space-y-3">
          {salida.inspecciones.length === 0 && <p className="text-xs text-stone-500">Sin inspecciones registradas.</p>}
          {salida.inspecciones.map((i) => (
            <div key={i.id} className="rounded-xl border border-stone-200/70 bg-white/80 p-3 text-sm dark:border-white/10 dark:bg-stone-900/60">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold">{i.momento === "ANTES" ? "Salida" : "Regreso"} · {km(i.kilometraje)}</p>
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${chipEstado[i.estadoVehiculo]}`}>{etiquetaEstado[i.estadoVehiculo]}</span>
              </div>
              <p className="text-xs text-stone-500">{formatearFechaHoraVehiculo(i.registradoEn)}</p>
              {i.observaciones && <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">{i.observaciones}</p>}
              {i.fotos.length > 0 && (
                <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {i.fotos.map((f) => (
                    <li key={f.id} className="overflow-hidden rounded-lg border border-stone-200 dark:border-white/10">
                      <FotoEvidencia ruta={f.rutaStorage} descripcion={f.descripcion ?? "Evidencia"} />
                      {f.descripcion && <p className="truncate px-2 py-1 text-[11px] text-stone-500">{f.descripcion}</p>}
                    </li>
                  ))}
                </ul>
              )}
              <AdjuntarEvidencia inspeccionId={i.id} siguienteOrden={i.fotos.length + 1} alGuardar={alGuardar} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
