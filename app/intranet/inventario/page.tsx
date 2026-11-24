"use client";

import { registrarError } from "@/lib/registro-seguro";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle, Archive, ArrowDownToLine, ArrowUpFromLine, CheckCircle2,
  Loader2, Pencil, Plus, Power, RotateCcw,
  QrCode as QrIcon, Search, XCircle,
} from "lucide-react";
import { QueryFetchPolicy, subscribe } from "firebase/data-connect";
import { useRoleGuard } from "@/components/intranet/useRoleGuard";
import QrInsumo from "@/components/intranet/QrInsumo";
import EncabezadoSeccion, { BOTON_ENCABEZADO, BOTON_ENCABEZADO_SECUNDARIO } from "@/components/intranet/EncabezadoSeccion";
import ModalIntranet, { BOTON_MODAL_PELIGRO, BOTON_MODAL_PRIMARIO, BOTON_MODAL_SECUNDARIO } from "@/components/intranet/ModalIntranet";
import GlassSelect from "@/components/ui/GlassSelect";
import ConteosInventario from "@/components/intranet/ConteosInventario";
import HistorialInventario from "@/components/intranet/HistorialInventario";
import { dataConnect } from "@/lib/firebase/client";
import {
  obtenerEstadoStock,
  type EstadoStock,
} from "@/lib/inventario/movimientos";
import {
  actualizarInsumo, crearInsumo, getStockInventario, getStockInventarioRef,
  registrarEntradaInventario, registrarSalidaInventario, TipoMovimiento,
  type GetStockInventarioData,
} from "@/src/dataconnect-generated";

type Insumo = GetStockInventarioData["insumos"][number];
type InsumoForm = {
  id?: string;
  nombre: string;
  unidadMedida: string;
  stockInicial: string;
  stockMinimo: string;
  activo: boolean;
};
type MovimientoForm = {
  tipo: TipoMovimiento;
  insumoId: string;
  cantidad: string;
  motivo: string;
};
type Notice = { text: string; tipo: "success" | "warning" | "error" };

const FORM_VACIO: InsumoForm = {
  nombre: "", unidadMedida: "unidad", stockInicial: "0", stockMinimo: "0", activo: true,
};
const UNIDADES = ["unidad", "kg", "g", "L", "ml", "rollo", "caja", "bolsa"];
const numero = (value: string) => Number(value.replace(",", "."));

const statusCfg: Record<EstadoStock, { style: string; icon: React.ElementType }> = {
  OK: { style: "bg-green-500/10 text-green-700 dark:text-green-400", icon: CheckCircle2 },
  Bajo: { style: "bg-amber-500/10 text-amber-700 dark:text-amber-400", icon: AlertTriangle },
  Crítico: { style: "bg-red-500/10 text-red-700 dark:text-red-400", icon: XCircle },
  Inactivo: { style: "bg-stone-500/10 text-stone-500", icon: Power },
};

const noticeStyle: Record<Notice["tipo"], string> = {
  success: "border-green-200 bg-green-50 text-green-700 dark:border-green-500/20 dark:bg-stone-900 dark:text-green-300",
  warning: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/20 dark:bg-stone-900 dark:text-amber-300",
  error: "border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-stone-900 dark:text-red-300",
};

function mensajeError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/unique constraint|already_exists/i.test(message)) return "Ya existe un insumo con ese nombre.";
  if (/no autorizado|solo administradores/i.test(message)) return "No tienes permisos para realizar esta acción.";
  if (/stock insuficiente/i.test(message)) return "No hay stock suficiente para registrar esa salida.";
  if (/inactivo/i.test(message)) return "El insumo está inactivo. Actívalo antes de registrar stock.";
  if (/cantidad/i.test(message)) return "La cantidad debe ser mayor que cero.";
  return "No fue posible guardar el cambio. Intenta nuevamente.";
}

export default function InventarioPage() {
  const permitido = useRoleGuard(["admin"]);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filtro, setFiltro] = useState<"Todos" | EstadoStock>("Todos");
  const [etiqueta, setEtiqueta] = useState<Insumo | null>(null);
  const [form, setForm] = useState<InsumoForm | null>(null);
  const [movimiento, setMovimiento] = useState<MovimientoForm | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const alertasPrevias = useRef<Set<string> | null>(null);
  const solicitudActual = useRef(0);

  const aplicarDatos = useCallback((data: GetStockInventarioData) => {
    const alertasActuales = new Set(
      data.insumos
        .filter((item) => {
          const estado = obtenerEstadoStock(item);
          return estado === "Bajo" || estado === "Crítico";
        })
        .map((item) => item.id),
    );
    const anteriores = alertasPrevias.current;
    if (anteriores) {
      const nuevas = data.insumos.filter((item) => alertasActuales.has(item.id) && !anteriores.has(item.id));
      if (nuevas.length) {
        setNotice({
          text: `${nuevas.map((item) => item.nombre).join(", ")} alcanzó el nivel mínimo de stock.`,
          tipo: "warning",
        });
      }
    }
    alertasPrevias.current = alertasActuales;
    setInsumos(data.insumos);
    setLoading(false);
  }, []);

  const cargarInventario = useCallback(async (silencioso = false) => {
    const solicitud = ++solicitudActual.current;
    if (!silencioso) setLoading(true);
    try {
      const result = await getStockInventario(dataConnect, { fetchPolicy: QueryFetchPolicy.SERVER_ONLY });
      if (solicitud === solicitudActual.current) aplicarDatos(result.data);
    } catch (error) {
      registrarError("No se pudo cargar el inventario:", error);
      if (!silencioso) setNotice({ text: "No se pudo cargar el inventario.", tipo: "error" });
    } finally {
      if (solicitud === solicitudActual.current) setLoading(false);
    }
  }, [aplicarDatos]);

  useEffect(() => {
    if (!permitido) return;
    const query = getStockInventarioRef(dataConnect);
    const cancelar = subscribe(
      query,
      (result) => aplicarDatos(result.data),
      (error) => {
        registrarError("Se interrumpió la actualización del inventario:", error);
        setNotice({ text: "Se perdió la actualización en tiempo real. Reintentando…", tipo: "warning" });
        void cargarInventario(true);
      },
    );
    const refrescar = () => void cargarInventario(true);
    const alVolver = () => document.visibilityState === "visible" && refrescar();
    window.addEventListener("focus", refrescar);
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      cancelar();
      window.removeEventListener("focus", refrescar);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [aplicarDatos, cargarInventario, permitido]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const enriquecidos = useMemo(
    () => insumos.map((item) => ({ ...item, status: obtenerEstadoStock(item) })),
    [insumos],
  );
  const visibles = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("es-CL");
    return enriquecidos.filter((item) =>
      (filtro === "Todos" || item.status === filtro)
      && (!term || item.nombre.toLocaleLowerCase("es-CL").includes(term)
        || item.unidadMedida.toLocaleLowerCase("es-CL").includes(term)),
    );
  }, [enriquecidos, filtro, search]);

  const activos = enriquecidos.filter((item) => item.activo);
  const conStock = activos.filter((item) => item.stockActual > 0);
  const ok = activos.filter((item) => item.status === "OK").length;
  const bajo = activos.filter((item) => item.status === "Bajo").length;
  const critico = activos.filter((item) => item.status === "Crítico").length;
  const alertas = enriquecidos.filter((item) => item.status === "Bajo" || item.status === "Crítico");

  const guardarInsumo = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form) return;
    const stockInicial = numero(form.stockInicial);
    const stockMinimo = numero(form.stockMinimo);
    if (!form.nombre.trim() || !form.unidadMedida.trim()) {
      setNotice({ text: "Nombre y unidad de medida son obligatorios.", tipo: "error" });
      return;
    }
    if (!Number.isFinite(stockMinimo) || stockMinimo < 0
      || (!form.id && (!Number.isFinite(stockInicial) || stockInicial < 0))) {
      setNotice({ text: "Los valores de stock deben ser números iguales o mayores que cero.", tipo: "error" });
      return;
    }
    setSaving(true);
    try {
      if (form.id) {
        await actualizarInsumo(dataConnect, {
          id: form.id, nombre: form.nombre.trim(), unidadMedida: form.unidadMedida.trim(),
          stockMinimo, activo: form.activo,
        });
      } else {
        await crearInsumo(dataConnect, {
          nombre: form.nombre.trim(), unidadMedida: form.unidadMedida.trim(), stockInicial, stockMinimo,
        });
      }
      await cargarInventario(true);
      setNotice({ text: form.id ? "Insumo actualizado correctamente." : "Insumo registrado correctamente.", tipo: "success" });
      setForm(null);
    } catch (error) {
      registrarError("No se pudo guardar el insumo:", error);
      setNotice({ text: mensajeError(error), tipo: "error" });
    } finally { setSaving(false); }
  };

  const cambiarEstado = async (item: Insumo) => {
    setSaving(true);
    try {
      await actualizarInsumo(dataConnect, {
        id: item.id, nombre: item.nombre, unidadMedida: item.unidadMedida,
        stockMinimo: item.stockMinimo, activo: !item.activo,
      });
      await cargarInventario(true);
      setNotice({ text: item.activo ? "Insumo desactivado." : "Insumo reactivado.", tipo: "success" });
    } catch (error) {
      setNotice({ text: mensajeError(error), tipo: "error" });
    } finally { setSaving(false); }
  };

  const registrarMovimiento = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!movimiento) return;
    const cantidad = numero(movimiento.cantidad);
    const seleccionado = activos.find((item) => item.id === movimiento.insumoId);
    if (!seleccionado || !Number.isFinite(cantidad) || cantidad <= 0) {
      setNotice({ text: "Selecciona un insumo e ingresa una cantidad mayor que cero.", tipo: "error" });
      return;
    }
    if (movimiento.tipo === TipoMovimiento.SALIDA && cantidad > seleccionado.stockActual) {
      setNotice({ text: `El stock disponible es ${seleccionado.stockActual} ${seleccionado.unidadMedida}.`, tipo: "error" });
      return;
    }
    setSaving(true);
    try {
      const variables = {
        insumoId: movimiento.insumoId,
        cantidad,
        motivo: movimiento.motivo.trim()
          || (movimiento.tipo === TipoMovimiento.ENTRADA ? "Compra o reposición" : "Consumo interno"),
      };
      if (movimiento.tipo === TipoMovimiento.ENTRADA) {
        await registrarEntradaInventario(dataConnect, variables);
      } else {
        await registrarSalidaInventario(dataConnect, variables);
      }
      await cargarInventario(true);
      setNotice({ text: `${movimiento.tipo === TipoMovimiento.ENTRADA ? "Entrada" : "Salida"} registrada y stock actualizado.`, tipo: "success" });
      setMovimiento(null);
    } catch (error) {
      registrarError("No se pudo registrar el movimiento:", error);
      setNotice({ text: mensajeError(error), tipo: "error" });
      await cargarInventario(true);
    } finally { setSaving(false); }
  };

  const abrirMovimiento = (tipo: TipoMovimiento) => {
    const opciones = tipo === TipoMovimiento.SALIDA ? conStock : activos;
    setMovimiento({ tipo, insumoId: opciones[0]?.id ?? "", cantidad: "", motivo: "" });
  };

  if (!permitido || loading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-brand-500" /></div>;
  }

  return (
    <div className="min-h-screen space-y-6 p-4 text-stone-900 sm:p-6 dark:text-stone-100">
      <AnimatePresence>{notice && <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} role={notice.tipo === "error" ? "alert" : "status"} aria-live="polite" className={`fixed right-5 top-5 z-[70] max-w-sm rounded-2xl border px-4 py-3 text-sm font-semibold shadow-xl ${noticeStyle[notice.tipo]}`}>{notice.text}</motion.div>}</AnimatePresence>

      <EncabezadoSeccion
        antetitulo="Bodega · Inventario conectado"
        titulo="Gestión de Inventario"
        descripcion="Stock y movimientos sincronizados automáticamente."
        acciones={<>
          <button onClick={() => abrirMovimiento(TipoMovimiento.SALIDA)} disabled={!conStock.length} className="flex cursor-pointer items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-40 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300"><ArrowUpFromLine className="h-4 w-4" />Registrar salida</button>
          <button onClick={() => abrirMovimiento(TipoMovimiento.ENTRADA)} disabled={!activos.length} className={BOTON_ENCABEZADO_SECUNDARIO}><ArrowDownToLine className="h-4 w-4" />Registrar entrada</button>
          <button onClick={() => setForm(FORM_VACIO)} className={BOTON_ENCABEZADO}><Plus className="h-4 w-4" />Nuevo insumo</button>
        </>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[
        { label: "Insumos activos", value: activos.length, cls: "text-stone-800 dark:text-white" },
        { label: "Stock saludable", value: ok, cls: "text-green-600 dark:text-green-400" },
        { label: "Stock bajo", value: bajo, cls: "text-amber-600 dark:text-amber-400" },
        { label: "Stock crítico", value: critico, cls: "text-red-600 dark:text-red-400" },
      ].map((kpi) => <div key={kpi.label} className="glass-panel rounded-2xl p-4"><p className="text-xs font-semibold text-stone-400">{kpi.label}</p><p className={`mt-1 text-2xl font-extrabold ${kpi.cls}`}>{kpi.value}</p></div>)}</div>

      {alertas.length > 0 && <section role="alert" className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-500/20 dark:bg-amber-500/10"><div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" /><div><h2 className="font-bold text-amber-900 dark:text-amber-200">Atención de inventario requerida</h2><p className="mt-1 text-sm text-amber-800 dark:text-amber-300">{alertas.map((item) => `${item.nombre}: ${item.stockActual.toLocaleString("es-CL")} ${item.unidadMedida} (mínimo ${item.stockMinimo.toLocaleString("es-CL")})`).join(" · ")}</p></div></div></section>}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><label className="relative max-w-md flex-1"><span className="sr-only">Buscar insumo</span><Search className="absolute left-3 top-3 h-4 w-4 text-stone-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre o unidad..." className="glass-panel w-full rounded-xl py-2.5 pl-9 pr-3 text-sm outline-none focus:border-brand-500/50" /></label><div className="flex flex-wrap gap-2">{(["Todos", "OK", "Bajo", "Crítico", "Inactivo"] as const).map((opcion) => <button key={opcion} onClick={() => setFiltro(opcion)} className={`rounded-xl px-3 py-2 text-xs font-bold transition ${filtro === opcion ? "bg-brand-500 text-white" : "bg-stone-100 text-stone-500 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-400"}`}>{opcion}</button>)}</div></div>

      <section className="glass-panel overflow-hidden rounded-2xl"><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-stone-50/80 text-xs uppercase text-stone-400 dark:bg-white/5"><tr><th className="px-4 py-3">Insumo</th><th className="px-4 py-3">Unidad</th><th className="px-4 py-3">Stock</th><th className="px-4 py-3">Mínimo</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3">Código</th><th className="px-4 py-3 text-right">Acciones</th></tr></thead><tbody>
        {visibles.map((item) => { const cfg = statusCfg[item.status]; const Icon = cfg.icon; return <tr key={item.id} className="border-b border-stone-100 last:border-0 hover:bg-stone-50/60 dark:border-white/5 dark:hover:bg-white/3"><td className="px-4 py-3"><div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400"><Archive className="h-4 w-4" /></span><span className="font-bold">{item.nombre}</span></div></td><td className="px-4 py-3 text-stone-500">{item.unidadMedida}</td><td className="px-4 py-3 text-base font-extrabold">{item.stockActual.toLocaleString("es-CL")} <span className="text-xs font-normal text-stone-400">{item.unidadMedida}</span></td><td className="px-4 py-3 text-stone-500">{item.stockMinimo.toLocaleString("es-CL")} {item.unidadMedida}</td><td className="px-4 py-3"><span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${cfg.style}`}><Icon className="h-3 w-3" />{item.status}</span></td><td className="px-4 py-3"><button onClick={() => setEtiqueta(item)} aria-label={`Ver QR de ${item.nombre}`} className="inline-flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-500/5 px-3 py-2 text-xs font-bold text-brand-700 hover:bg-brand-500/10 dark:border-brand-500/20 dark:text-brand-300"><QrIcon className="h-4 w-4" />Ver QR</button></td><td className="px-4 py-3"><div className="flex justify-end gap-1"><button title="Editar insumo" onClick={() => setForm({ id: item.id, nombre: item.nombre, unidadMedida: item.unidadMedida, stockInicial: String(item.stockActual), stockMinimo: String(item.stockMinimo), activo: item.activo })} className="rounded-lg p-2 text-stone-400 hover:bg-brand-500/10 hover:text-brand-600"><Pencil className="h-4 w-4" /></button><button disabled={saving} title={item.activo ? "Desactivar" : "Reactivar"} onClick={() => void cambiarEstado(item)} className={`rounded-lg p-2 ${item.activo ? "text-stone-400 hover:bg-red-500/10 hover:text-red-600" : "text-green-600 hover:bg-green-500/10"}`}>{item.activo ? <Power className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}</button></div></td></tr>; })}
        {!visibles.length && <tr><td colSpan={7} className="px-4 py-12 text-center text-stone-400">No hay insumos que coincidan con los filtros.</td></tr>}
      </tbody></table></div></section>

      {etiqueta && <QrInsumo insumo={etiqueta} cerrar={() => setEtiqueta(null)} />}

      <ConteosInventario revision={insumos.map(i => `${i.id}:${i.revisionStock}`).join("|")} alGuardar={() => { void cargarInventario(true); }} />
      <HistorialInventario insumos={insumos} revision={insumos.map(i => `${i.id}:${i.revisionStock}`).join("|")} />

      <AnimatePresence>
        {form && (
          <ModalIntranet
            onCerrar={() => setForm(null)}
            bloqueado={saving}
            onSubmit={guardarInsumo}
            icono={Archive}
            etiqueta="Catálogo de inventario"
            titulo={form.id ? "Editar insumo" : "Registrar insumo"}
            subtitulo="Control de existencias y parámetros de alerta."
            idTitulo="titulo-insumo"
            claseCuerpo="space-y-5"
            pie={<>
              <button type="button" onClick={() => setForm(null)} disabled={saving} className={BOTON_MODAL_SECUNDARIO}>Cancelar</button>
              <button disabled={saving} className={BOTON_MODAL_PRIMARIO}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {form.id ? "Guardar cambios" : "Registrar insumo"}
              </button>
            </>}
          >
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">Nombre del insumo</label>
                <input
                  autoFocus
                  required
                  maxLength={80}
                  value={form.nombre}
                  onChange={(event) => setForm({ ...form, nombre: event.target.value })}
                  placeholder="Ej: Detergente Industrial Concentrado"
                  className="w-full rounded-xl border border-stone-200/80 bg-stone-50/70 px-4 py-3 text-sm text-stone-800 placeholder-stone-400 outline-none focus:border-brand-500 dark:border-white/10 dark:bg-stone-800/80 dark:text-stone-200 dark:placeholder-stone-500 transition-all"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">Unidad de medida</label>
                  <input
                    required
                    list="unidades-inventario"
                    maxLength={20}
                    value={form.unidadMedida}
                    onChange={(event) => setForm({ ...form, unidadMedida: event.target.value })}
                    placeholder="Ej: Litros, Kg, Cajas"
                    className="w-full rounded-xl border border-stone-200/80 bg-stone-50/70 px-4 py-3 text-sm text-stone-800 placeholder-stone-400 outline-none focus:border-brand-500 dark:border-white/10 dark:bg-stone-800/80 dark:text-stone-200 dark:placeholder-stone-500 transition-all"
                  />
                  <datalist id="unidades-inventario">
                    {UNIDADES.map((unidad) => <option key={unidad} value={unidad} />)}
                  </datalist>
                </div>

                {!form.id && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">Stock inicial</label>
                    <input
                      required
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      value={form.stockInicial}
                      onChange={(event) => setForm({ ...form, stockInicial: event.target.value })}
                      className="w-full rounded-xl border border-stone-200/80 bg-stone-50/70 px-4 py-3 text-sm text-stone-800 placeholder-stone-400 outline-none focus:border-brand-500 dark:border-white/10 dark:bg-stone-800/80 dark:text-stone-200 dark:placeholder-stone-500 transition-all"
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">Stock mínimo</label>
                  <input
                    required
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={form.stockMinimo}
                    onChange={(event) => setForm({ ...form, stockMinimo: event.target.value })}
                    className="w-full rounded-xl border border-stone-200/80 bg-stone-50/70 px-4 py-3 text-sm text-stone-800 placeholder-stone-400 outline-none focus:border-brand-500 dark:border-white/10 dark:bg-stone-800/80 dark:text-stone-200 dark:placeholder-stone-500 transition-all"
                  />
                </div>
              </div>

              {form.id && (
                <label className="flex items-center gap-3 rounded-2xl bg-stone-50/70 p-3.5 text-sm font-semibold dark:bg-white/5 border border-stone-100 dark:border-white/5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.activo}
                    onChange={(event) => setForm({ ...form, activo: event.target.checked })}
                    className="h-4 w-4 rounded accent-brand-500"
                  />
                  <span>Insumo activo en inventario</span>
                </label>
              )}

          </ModalIntranet>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {movimiento && (
          <ModalIntranet
            onCerrar={() => setMovimiento(null)}
            bloqueado={saving}
            onSubmit={registrarMovimiento}
            icono={movimiento.tipo === TipoMovimiento.ENTRADA ? ArrowDownToLine : ArrowUpFromLine}
            tono={movimiento.tipo === TipoMovimiento.ENTRADA ? "exito" : "peligro"}
            etiqueta="Movimiento de inventario"
            titulo={`Registrar ${movimiento.tipo === TipoMovimiento.ENTRADA ? "entrada" : "salida"} de stock`}
            subtitulo="El stock y el historial se actualizarán automáticamente."
            idTitulo="titulo-movimiento"
            claseCuerpo="space-y-5"
            pie={<>
              <button type="button" onClick={() => setMovimiento(null)} disabled={saving} className={BOTON_MODAL_SECUNDARIO}>Cancelar</button>
              <button disabled={saving || !movimiento.insumoId} className={movimiento.tipo === TipoMovimiento.ENTRADA ? BOTON_MODAL_PRIMARIO : BOTON_MODAL_PELIGRO}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Registrar {movimiento.tipo === TipoMovimiento.ENTRADA ? "entrada" : "salida"}
              </button>
            </>}
          >
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">Insumo</span>
                <GlassSelect
                  ariaLabel="Insumo"
                  searchable
                  searchPlaceholder="Buscar insumo…"
                  value={movimiento.insumoId}
                  onChange={(insumoId) => setMovimiento({ ...movimiento, insumoId })}
                  options={(movimiento.tipo === TipoMovimiento.SALIDA ? conStock : activos).map((item) => ({
                    value: item.id,
                    label: `${item.nombre} · ${item.stockActual.toLocaleString("es-CL")} ${item.unidadMedida}`,
                  }))}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">Cantidad</label>
                <input
                  autoFocus
                  required
                  min="0.01"
                  max={movimiento.tipo === TipoMovimiento.SALIDA ? activos.find((item) => item.id === movimiento.insumoId)?.stockActual : undefined}
                  step="0.01"
                  inputMode="decimal"
                  value={movimiento.cantidad}
                  onChange={(event) => setMovimiento({ ...movimiento, cantidad: event.target.value })}
                  placeholder="0.00"
                  className="w-full rounded-xl border border-stone-200/80 bg-stone-50/70 px-4 py-3 text-sm text-stone-800 placeholder-stone-400 outline-none focus:border-brand-500 dark:border-white/10 dark:bg-stone-800/80 dark:text-stone-200 dark:placeholder-stone-500 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">Motivo / referencia</label>
                <textarea
                  maxLength={200}
                  rows={3}
                  value={movimiento.motivo}
                  onChange={(event) => setMovimiento({ ...movimiento, motivo: event.target.value })}
                  placeholder={movimiento.tipo === TipoMovimiento.ENTRADA ? "Ej: Compra proveedor, factura 123…" : "Ej: Consumo semanal en producción…"}
                  className="w-full resize-none rounded-xl border border-stone-200/80 bg-stone-50/70 px-4 py-3 text-sm text-stone-800 placeholder-stone-400 outline-none focus:border-brand-500 dark:border-white/10 dark:bg-stone-800/80 dark:text-stone-200 dark:placeholder-stone-500 transition-all"
                />
              </div>

          </ModalIntranet>
        )}
      </AnimatePresence>
    </div>
  );
}
