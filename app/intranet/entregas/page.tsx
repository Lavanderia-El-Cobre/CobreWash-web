"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  CheckCircle2,
  History,
  Loader2,
  MapPin,
  PackageCheck,
  Phone,
  RotateCcw,
  Search,
  Shirt,
} from "lucide-react";
import { registrarError } from "@/lib/registro-seguro";
import { useRoleGuard } from "@/components/intranet/useRoleGuard";
import EncabezadoSeccion from "@/components/intranet/EncabezadoSeccion";
import GlassSelect from "@/components/ui/GlassSelect";
import HojaModal, { BOTON_PRIMARIO, BOTON_SECUNDARIO, INPUT_REPARTO, LABEL_REPARTO } from "@/components/intranet/reparto/HojaModal";
import { dataConnect } from "@/lib/firebase/client";
import { entregarComanda, getComandasParaEntrega, reportarProblemaEntrega } from "@/src/dataconnect-generated";
import { formatearFechaHoraVehiculo } from "@/lib/vehiculos/flota";
import {
  DETALLE_ENTREGA_MAXIMO,
  DETALLE_PROBLEMA_MAXIMO,
  filtrarComandasEntrega,
  mapearErrorEntrega,
  motivoVisible,
  MOTIVOS_PROBLEMA_ENTREGA,
  normalizarDetalle,
  problemasAbiertos,
  resumirPrendas,
  validarEntrega,
  validarProblemaEntrega,
  type ComandaParaEntrega,
  type EntregaRegistrada,
} from "@/lib/entregas/modelo";

const POR_PAGINA = 50;

type Accion =
  | { tipo: "entregar"; comanda: ComandaParaEntrega; detalle: string }
  | { tipo: "problema"; comanda: ComandaParaEntrega; motivo: string; detalle: string };

export default function EntregasPage() {
  const permitido = useRoleGuard(["admin", "repartidor", "conductor"]);
  const [comandas, setComandas] = useState<ComandaParaEntrega[]>([]);
  const [misEntregas, setMisEntregas] = useState<EntregaRegistrada[]>([]);
  const [hayMas, setHayMas] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState("");
  const [vista, setVista] = useState<"pendientes" | "mias">("pendientes");
  const [busqueda, setBusqueda] = useState("");
  const [accion, setAccion] = useState<Accion | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [formError, setFormError] = useState("");
  const [aviso, setAviso] = useState("");
  const [ahora, setAhora] = useState(() => Date.now());
  const solicitud = useRef(0);
  const paginas = useRef(1);

  const cargar = useCallback(async (silencioso = false, totalPaginas = paginas.current) => {
    const actual = ++solicitud.current;
    if (!silencioso) setCargando(true);
    try {
      const { data } = await getComandasParaEntrega(dataConnect, { limit: POR_PAGINA * totalPaginas, offset: 0 }, { fetchPolicy: "SERVER_ONLY" });
      if (actual !== solicitud.current) return;
      paginas.current = totalPaginas;
      setComandas(data.comandas);
      setMisEntregas(data.misEntregas);
      setHayMas(data.comandas.length === POR_PAGINA * totalPaginas);
      setErrorCarga("");
      setAhora(Date.now());
    } catch (error) {
      registrarError("No se pudieron cargar las entregas:", error);
      if (actual === solicitud.current && !silencioso) setErrorCarga("No se pudieron cargar las comandas. Revisa tu conexión e intenta nuevamente.");
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
    const t = window.setTimeout(() => setAviso(""), 6000);
    return () => window.clearTimeout(t);
  }, [aviso]);

  const filtradas = useMemo(() => filtrarComandasEntrega(comandas, busqueda), [comandas, busqueda]);
  const cerrar = useCallback(() => { if (!guardando) { setAccion(null); setFormError(""); } }, [guardando]);

  const confirmar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accion || guardando) return;
    const error = accion.tipo === "entregar" ? validarEntrega(accion.detalle) : validarProblemaEntrega(accion.motivo, accion.detalle);
    if (error) { setFormError(error); return; }
    setGuardando(true);
    setFormError("");
    try {
      const detalle = normalizarDetalle(accion.detalle);
      if (accion.tipo === "entregar") {
        await entregarComanda(dataConnect, { id: accion.comanda.id, detalle });
        setAviso(`Comanda ${accion.comanda.numeroComanda} marcada como entregada.`);
        setComandas((lista) => lista.filter((c) => c.id !== accion.comanda.id));
      } else {
        await reportarProblemaEntrega(dataConnect, { comandaId: accion.comanda.id, motivo: accion.motivo, detalle });
        setAviso(`Problema registrado en ${accion.comanda.numeroComanda}. La comanda sigue pendiente de entrega.`);
      }
      setAccion(null);
      await cargar(true);
    } catch (error) {
      setFormError(mapearErrorEntrega(error));
      void cargar(true);
    } finally {
      setGuardando(false);
    }
  };

  if (!permitido) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6 lg:p-8">
      <EncabezadoSeccion
        antetitulo="Reparto · Despacho a clientes"
        titulo="Entregas"
        descripcion="Comandas terminadas listas para entregar. Marca la entrega o informa un problema."
        acciones={
          <button
            type="button"
            onClick={() => void cargar()}
            disabled={cargando}
            aria-label="Actualizar"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-stone-200/80 bg-white/80 text-stone-600 transition hover:bg-stone-100 disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-stone-300"
          >
            {cargando ? <Loader2 className="h-4 w-4 animate-spin text-brand-500" /> : <RotateCcw className="h-4 w-4" />}
          </button>
        }
      />

      {aviso && <p role="status" className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700 dark:border-green-500/20 dark:bg-stone-900 dark:text-green-300">{aviso}</p>}
      {errorCarga && <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-500/20 dark:bg-stone-900 dark:text-red-300">{errorCarga}</p>}

      <nav aria-label="Vistas de entregas" className="glass-card flex gap-1 rounded-2xl bg-white/65 p-1.5 shadow-premium dark:bg-white/5">
        {([["pendientes", `Por entregar (${comandas.length}${hayMas ? "+" : ""})`], ["mias", "Mis entregas"]] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={vista === id}
            onClick={() => setVista(id)}
            className={`min-h-11 flex-1 rounded-xl px-3 py-2 text-sm font-bold transition-all ${vista === id ? "bg-gradient-brand text-white shadow-premium" : "text-stone-500 hover:bg-brand-50 hover:text-brand-700 dark:text-stone-400 dark:hover:bg-white/5"}`}
          >
            {label}
          </button>
        ))}
      </nav>

      {cargando && comandas.length === 0 && misEntregas.length === 0 ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-brand-500" /></div>
      ) : vista === "pendientes" ? (
        <section aria-label="Comandas por entregar" className="space-y-3">
          <label className="relative block">
            <span className="sr-only">Buscar comanda</span>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por número, cliente o dirección"
              className={`${INPUT_REPARTO} pl-10`}
            />
          </label>
          {filtradas.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-stone-300 p-6 text-center text-sm text-stone-500 dark:border-white/10">
              {comandas.length === 0 ? "No hay comandas listas para entregar." : "Ninguna comanda coincide con la búsqueda."}
            </p>
          ) : (
            <ul className="space-y-3">
              {filtradas.map((c) => (
                <TarjetaComanda
                  key={c.id}
                  comanda={c}
                  ahora={ahora}
                  onEntregar={() => { setFormError(""); setAccion({ tipo: "entregar", comanda: c, detalle: "" }); }}
                  onProblema={() => { setFormError(""); setAccion({ tipo: "problema", comanda: c, motivo: MOTIVOS_PROBLEMA_ENTREGA[0], detalle: "" }); }}
                />
              ))}
            </ul>
          )}
          {hayMas && (
            <button type="button" disabled={cargando} onClick={() => void cargar(false, paginas.current + 1)} className={`${BOTON_SECUNDARIO} w-full border border-stone-200/80 dark:border-white/10`}>
              {cargando && <Loader2 className="h-4 w-4 animate-spin" />} Cargar más comandas
            </button>
          )}
        </section>
      ) : (
        <section aria-label="Mis entregas recientes" className="space-y-2">
          {misEntregas.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-stone-300 p-6 text-center text-sm text-stone-500 dark:border-white/10">Aún no registras entregas.</p>
          ) : (
            <ul className="space-y-2">
              {misEntregas.map((h) => (
                <li key={h.id} className="glass-card rounded-2xl border border-stone-200/80 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-bold text-stone-800 dark:text-stone-100">{h.comanda.numeroComanda} · {h.comanda.cliente.nombre}</p>
                    <span className="flex items-center gap-1 text-xs font-semibold text-green-700 dark:text-green-400"><CheckCircle2 className="h-3.5 w-3.5" /> Entregada</span>
                  </div>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-stone-500"><History className="h-3.5 w-3.5" /> {formatearFechaHoraVehiculo(h.fecha)}</p>
                  {h.motivo && h.motivo !== "Entrega a cliente" && <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">{h.motivo.replace(/^Entrega a cliente: /, "")}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <HojaModal
        abierto={!!accion}
        etiqueta={accion?.tipo === "problema" ? "Problema de entrega" : "Confirmar entrega"}
        titulo={accion ? `${accion.comanda.numeroComanda} · ${accion.comanda.cliente.nombre}` : ""}
        subtitulo={accion?.tipo === "problema" ? "La comanda seguirá pendiente y administración verá el problema en Incidencias." : "La comanda quedará entregada con tu nombre y la hora actual."}
        icono={accion?.tipo === "problema" ? AlertTriangle : PackageCheck}
        bloqueado={guardando}
        onCerrar={cerrar}
        onSubmit={confirmar}
        pie={<>
          <button type="button" onClick={cerrar} disabled={guardando} className={BOTON_SECUNDARIO}>Cancelar</button>
          <button type="submit" disabled={guardando} className={BOTON_PRIMARIO}>
            {guardando && <Loader2 className="h-4 w-4 animate-spin" />}
            {accion?.tipo === "problema" ? "Registrar problema" : "Marcar entregada"}
          </button>
        </>}
      >
        {accion?.tipo === "entregar" && (
          <div className="space-y-1.5">
            <label htmlFor="entrega-detalle" className={LABEL_REPARTO}>Detalle de la entrega (opcional)</label>
            <textarea
              id="entrega-detalle"
              rows={3}
              maxLength={DETALLE_ENTREGA_MAXIMO}
              disabled={guardando}
              value={accion.detalle}
              onChange={(e) => setAccion({ ...accion, detalle: e.target.value })}
              placeholder="Ej. Recibió María en recepción del hotel"
              className={`${INPUT_REPARTO} resize-none`}
            />
            <p className="text-right text-[11px] text-stone-400">{accion.detalle.length}/{DETALLE_ENTREGA_MAXIMO}</p>
          </div>
        )}
        {accion?.tipo === "problema" && <>
          <div className="space-y-1.5">
            <span className={LABEL_REPARTO}>Motivo *</span>
            <GlassSelect
              ariaLabel="Motivo del problema"
              disabled={guardando}
              value={accion.motivo}
              onChange={(motivo) => setAccion({ ...accion, motivo })}
              options={MOTIVOS_PROBLEMA_ENTREGA.map((m) => ({ value: m, label: m }))}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="problema-detalle" className={LABEL_REPARTO}>Detalle {accion.motivo === "Otro" ? "*" : "(opcional)"}</label>
            <textarea
              id="problema-detalle"
              rows={3}
              maxLength={DETALLE_PROBLEMA_MAXIMO}
              disabled={guardando}
              value={accion.detalle}
              onChange={(e) => setAccion({ ...accion, detalle: e.target.value })}
              placeholder="Ej. Nadie responde en el domicilio, se intentó llamar 2 veces"
              className={`${INPUT_REPARTO} resize-none`}
            />
            <p className="text-right text-[11px] text-stone-400">{accion.detalle.length}/{DETALLE_PROBLEMA_MAXIMO}</p>
          </div>
        </>}
        {formError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm font-semibold text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">{formError}</p>}
      </HojaModal>
    </div>
  );
}

function TarjetaComanda({ comanda: c, ahora, onEntregar, onProblema }: { comanda: ComandaParaEntrega; ahora: number; onEntregar: () => void; onProblema: () => void }) {
  const abiertos = problemasAbiertos(c);
  const estimada = c.fechaEntregaEstimada ? Date.parse(c.fechaEntregaEstimada) : NaN;
  const atrasada = Number.isFinite(estimada) && estimada < ahora;
  return (
    <li className="glass-card rounded-2xl border border-stone-200/80 bg-white/70 p-4 shadow-premium dark:border-white/10 dark:bg-white/5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-xs font-bold text-brand-600 dark:text-brand-400">{c.numeroComanda}</p>
          <p className="font-display text-lg font-extrabold text-stone-900 dark:text-white">{c.cliente.nombre}</p>
        </div>
        <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-bold text-stone-600 dark:bg-white/10 dark:text-stone-300">
          {c.cliente.tipoCliente === "HOTEL" ? "Hotel" : "Particular"}
        </span>
      </div>
      <dl className="mt-2 space-y-1.5 text-sm text-stone-600 dark:text-stone-300">
        {(c.empresa || c.proyecto) && <div className="flex gap-2"><dt className="sr-only">Empresa</dt><Building2 className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" /><dd>{[c.empresa, c.proyecto].filter(Boolean).join(" · ")}</dd></div>}
        <div className="flex gap-2"><dt className="sr-only">Dirección</dt><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" /><dd>{c.cliente.direccion || "Sin dirección registrada"}</dd></div>
        {c.cliente.telefono && (
          <div className="flex gap-2"><dt className="sr-only">Teléfono</dt><Phone className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" /><dd><a href={`tel:${c.cliente.telefono.replace(/[^\d+]/g, "")}`} className="font-semibold text-brand-600 underline-offset-2 hover:underline dark:text-brand-400">{c.cliente.telefono}</a></dd></div>
        )}
        <div className="flex gap-2"><dt className="sr-only">Prendas</dt><Shirt className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" /><dd>{resumirPrendas(c.prendas)}</dd></div>
        {c.fechaEntregaEstimada && (
          <div className="flex gap-2"><dt className="sr-only">Entrega estimada</dt><CalendarClock className={`mt-0.5 h-4 w-4 shrink-0 ${atrasada ? "text-red-500" : "text-stone-400"}`} /><dd className={atrasada ? "font-semibold text-red-600 dark:text-red-400" : ""}>{atrasada ? "Atrasada · " : "Estimada · "}{formatearFechaHoraVehiculo(c.fechaEntregaEstimada)}</dd></div>
        )}
      </dl>
      {c.observaciones && <p className="mt-2 rounded-xl bg-stone-50 px-3 py-2 text-xs text-stone-600 dark:bg-white/5 dark:text-stone-300">{c.observaciones}</p>}
      {abiertos.length > 0 && (
        <ul className="mt-2 space-y-1" aria-label="Problemas de entrega abiertos">
          {abiertos.map((p) => (
            <li key={p.id} className="flex gap-2 rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span><strong>{motivoVisible(p.motivo)}</strong>{p.descripcion ? ` — ${p.descripcion}` : ""} · {p.reportadaPor.nombre} {p.reportadaPor.apellido ?? ""} · {formatearFechaHoraVehiculo(p.fecha)}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <button type="button" onClick={onEntregar} className={BOTON_PRIMARIO}><PackageCheck className="h-4 w-4" /> Marcar entregada</button>
        <button type="button" onClick={onProblema} className={`${BOTON_SECUNDARIO} border border-amber-300/70 text-amber-700 hover:bg-amber-50 dark:border-amber-500/30 dark:text-amber-300 dark:hover:bg-amber-500/10`}><AlertTriangle className="h-4 w-4" /> Reportar problema</button>
      </div>
    </li>
  );
}
