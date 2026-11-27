"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, BrainCircuit, CheckCircle2, ChevronDown, Gauge, Loader2, RefreshCw, Scale, ShoppingBag } from "lucide-react";
import { auth } from "@/lib/firebase/client";
import { registrarError } from "@/lib/registro-seguro";
import { compraSugerida, confianzaModelo, diasDeStock, formatoTasaLegible } from "@/lib/ia/prediccion";
import { leerDetalleAjuste, type DetalleAjuste } from "@/lib/ia/recalculo";
import type { GetPanelIaData } from "@/src/dataconnect-generated";
import { claseBotonPrincipal, claseBotonSecundario, formatoNumero, Tarjeta, type Avisar, type PestanaIa } from "./ui";

// Normaliza UUIDs sin guiones para cruzar los IDs de Data Connect con los serializados en `tasasJson`.
const uuid = (id: string) => id.replaceAll("-", "").toLowerCase();
const fecha = (iso: string) => new Date(iso).toLocaleString("es-CL", { timeZone: "America/Santiago", dateStyle: "medium", timeStyle: "short" });
const porcentaje = (v: number | null | undefined, decimales = 1) => (v === null || v === undefined ? "—" : `${formatoNumero(v, decimales)}%`);

const METODO: Record<DetalleAjuste["insumos"][number]["metodoError"], string> = {
  "validacion-cruzada": "medido prediciendo cada período sin verlo",
  ajuste: "pocos conteos: medido sobre el mismo ajuste",
  "sin-datos": "aún sin conteos",
};

const CLASE_CONFIANZA = {
  alta: "text-green-600 dark:text-green-400",
  media: "text-amber-600 dark:text-amber-400",
  aprendiendo: "text-brand-600 dark:text-brand-400",
} as const;

function Kpi({ etiqueta, valor, nota, clase = "" }: { etiqueta: string; valor: string; nota?: string; clase?: string }) {
  return (
    <div className="glass-panel rounded-2xl p-4">
      <p className="text-xs font-semibold text-stone-400">{etiqueta}</p>
      <p className={`mt-1 text-2xl font-extrabold ${clase}`}>{valor}</p>
      {nota && <p className="mt-0.5 text-[11px] text-stone-400">{nota}</p>}
    </div>
  );
}

// Semaforización de cobertura de stock: crítico (< 7 días), advertencia (< 14 días) y holgado.
function claseDias(dias: number | null) {
  if (dias === null) return "text-stone-400";
  if (dias < 7) return "text-red-600 dark:text-red-400";
  if (dias < 14) return "text-amber-600 dark:text-amber-400";
  return "text-green-600 dark:text-green-400";
}

function GuiaRapida({
  tieneTasas,
  conteosReales,
  tieneModelo,
  recalculando,
  onRecalcular,
  irAPestana,
}: {
  tieneTasas: boolean;
  conteosReales: number;
  tieneModelo: boolean;
  recalculando: boolean;
  onRecalcular: () => void;
  irAPestana?: (p: PestanaIa) => void;
}) {
  const pasos = [
    {
      numero: 1,
      titulo: "Define las dosis iniciales",
      detalle: "Indica cuánto insumo usa cada servicio por kg de ropa.",
      listo: tieneTasas,
      accion: irAPestana ? { texto: "Ir a dosis", onClick: () => irAPestana("tasas") } : undefined,
    },
    {
      numero: 2,
      titulo: "Registra al menos 2 conteos físicos",
      detalle: `Llevas ${conteosReales} ${conteosReales === 1 ? "conteo aprobado" : "conteos aprobados"} en bodega.`,
      listo: conteosReales >= 2,
      accion: irAPestana ? { texto: "Cargar conteo", onClick: () => irAPestana("datos") } : undefined,
    },
    {
      numero: 3,
      titulo: "Calcula tu primera predicción",
      detalle: "El sistema estima días de stock y ajusta las dosis automáticamente.",
      listo: tieneModelo,
      accion: tieneTasas ? { texto: recalculando ? "Calculando…" : "Calcular ahora", onClick: onRecalcular } : undefined,
    },
  ];
  return (
    <Tarjeta icono={CheckCircle2} titulo="Cómo empezar en 3 pasos" descripcion="Sigue este orden para activar la predicción de consumo de tu lavandería.">
      <ol className="grid gap-3 md:grid-cols-3">
        {pasos.map((p) => (
          <li key={p.numero} className={`flex flex-col justify-between gap-3 rounded-xl border p-4 ${p.listo ? "border-green-200 bg-green-50/60 dark:border-green-500/20 dark:bg-green-500/5" : "border-stone-200/80 bg-stone-50/70 dark:border-white/10 dark:bg-white/5"}`}>
            <div>
              <div className="flex items-center gap-2 text-xs font-bold">
                <span className={`grid h-6 w-6 place-items-center rounded-full text-[11px] ${p.listo ? "bg-green-600 text-white" : "bg-brand-500/15 text-brand-700 dark:text-brand-300"}`}>
                  {p.listo ? "✓" : p.numero}
                </span>
                <span className={p.listo ? "text-green-800 dark:text-green-300" : "text-stone-800 dark:text-stone-100"}>{p.titulo}</span>
              </div>
              <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">{p.detalle}</p>
            </div>
            {!p.listo && p.accion && (
              <button type="button" onClick={p.accion.onClick} disabled={recalculando} className={`${claseBotonSecundario} w-full border border-stone-200/80 bg-white dark:border-white/10 dark:bg-stone-900`}>
                {p.accion.texto}
              </button>
            )}
          </li>
        ))}
      </ol>
    </Tarjeta>
  );
}

/**
 * Portada del Módulo IA («Predicción y stock»): prioriza cobertura en días, urgencias de reposición,
 * guía inicial en 3 pasos y confianza legible, agrupando las métricas estadísticas avanzadas en un acordeón.
 */
export default function ResumenIa({
  panel,
  recargar,
  avisar,
  hayCambiosPendientes = false,
  onRecalculado,
  irAPestana,
}: {
  panel: GetPanelIaData;
  recargar: () => Promise<void>;
  avisar: Avisar;
  hayCambiosPendientes?: boolean;
  onRecalculado?: () => void;
  irAPestana?: (p: PestanaIa) => void;
}) {
  const [recalculando, setRecalculando] = useState(false);
  const modelo = panel.modeloVigente[0];
  const detalle = leerDetalleAjuste(modelo?.tasasJson);
  const conteosReales = panel.conteosReales[0]?._count ?? 0;
  const confianza = confianzaModelo(modelo?.observaciones ?? 0, modelo?.mape ?? null);

  const filasCobertura = useMemo(() => {
    if (!detalle) return [];
    const stock = new Map(panel.insumos.map((i) => [uuid(i.id), i]));
    return detalle.insumos
      .map((item) => {
        const insumo = stock.get(uuid(item.insumoId));
        const stockActual = insumo?.stockActual ?? null;
        const stockMinimo = insumo?.stockMinimo ?? null;
        const dias = stockActual !== null ? diasDeStock(stockActual, item.consumoDiario) : null;
        const sugerida = stockActual !== null ? compraSugerida(stockActual, item.consumoDiario, 14) : null;
        return { item, stockActual, stockMinimo, dias, sugerida };
      })
      .sort((a, b) => (a.dias ?? Number.POSITIVE_INFINITY) - (b.dias ?? Number.POSITIVE_INFINITY));
  }, [detalle, panel.insumos]);

  const porReponer = filasCobertura.filter((f) => f.dias !== null && f.dias < 14).length;
  const criticos = filasCobertura.filter((f) => f.dias !== null && f.dias < 7).length;

  const recalcular = async () => {
    const usuario = auth.currentUser;
    if (!usuario || recalculando) return;
    setRecalculando(true);
    try {
      const r = await fetch("/api/ia/recalcular", { method: "POST", cache: "no-store", headers: { Authorization: `Bearer ${await usuario.getIdToken()}` } });
      const datos = await r.json().catch(() => ({}));
      if (!r.ok) { avisar(datos.error ?? "No se pudo recalcular el modelo.", "error"); return; }
      onRecalculado?.();
      await recargar();
      const error = datos.mape === null || datos.mape === undefined ? "aún sin error medible" : `error medio ${porcentaje(datos.mape)}`;
      avisar(`Ajuste ${datos.version} listo: ${datos.observaciones} períodos entre conteos, ${error}.${datos.descartados ? ` ${datos.descartados} períodos descartados.` : ""}`, datos.descartados ? "warning" : "success");
    } catch (e) {
      registrarError("No se pudo recalcular el modelo IA", e);
      avisar("No se pudo recalcular. Revisa tu conexión e intenta nuevamente.", "error");
    } finally { setRecalculando(false); }
  };

  return (
    <div className="space-y-6">
      {(!modelo || !panel.tasaConsumos.length) && (
        <GuiaRapida
          tieneTasas={panel.tasaConsumos.length > 0}
          conteosReales={conteosReales}
          tieneModelo={!!modelo}
          recalculando={recalculando}
          onRecalcular={() => void recalcular()}
          irAPestana={irAPestana}
        />
      )}

      <Tarjeta
        icono={BrainCircuit}
        titulo="Estado de la predicción"
        descripcion={modelo ? `Ajuste ${modelo.version} del ${fecha(modelo.fechaEntrenamiento)}` : "Aún no hay ajustes. Define dosis, registra conteos y recalcula."}
        accion={
          <button type="button" onClick={recalcular} disabled={recalculando} className={claseBotonPrincipal}>
            {recalculando ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {recalculando ? "Recalculando…" : "Recalcular ahora"}
          </button>
        }
      >
        <div className="flex flex-wrap gap-2 text-xs font-bold">
          <span className={`rounded-full bg-stone-100 px-3 py-1 dark:bg-white/5 ${CLASE_CONFIANZA[confianza.nivel]}`}>
            Confianza: {confianza.etiqueta}
          </span>
          {hayCambiosPendientes && (
            <span className="rounded-full bg-amber-500/15 px-3 py-1 text-amber-800 dark:text-amber-300">
              Hay datos nuevos sin incluir en la predicción
            </span>
          )}
          {modelo?.incluyeSimulado && (
            <span className="rounded-full bg-amber-500/10 px-3 py-1 text-amber-700 dark:text-amber-400">
              Incluye datos simulados
            </span>
          )}
        </div>
      </Tarjeta>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Kpi
          etiqueta="Insumos por reponer"
          valor={String(porReponer)}
          nota={criticos > 0 ? `${criticos} con menos de 7 días de stock` : porReponer > 0 ? "Menos de 14 días de cobertura" : "Todos cubiertos para 14+ días"}
          clase={criticos > 0 ? "text-red-600 dark:text-red-400" : porReponer > 0 ? "text-amber-600 dark:text-amber-400" : "text-green-600 dark:text-green-400"}
        />
        <Kpi etiqueta="Confianza de estimación" valor={confianza.etiqueta} nota={confianza.detalle} clase={CLASE_CONFIANZA[confianza.nivel]} />
        <Kpi etiqueta="Conteos reales" valor={String(conteosReales)} nota="Conteos físicos aprobados en bodega" />
      </div>

      {filasCobertura.length > 0 && (
        <Tarjeta icono={Gauge} titulo="Cobertura de insumos" descripcion="Ordenados por urgencia según tu stock actual y ritmo reciente de consumo.">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs uppercase text-stone-400">
                <tr>
                  <th className="py-2 pr-3">Insumo</th>
                  <th className="py-2 pr-3">Stock actual</th>
                  <th className="py-2 pr-3">Consumo estimado</th>
                  <th className="py-2 pr-3">Días de stock</th>
                  <th className="py-2">Sugerencia (14 días)</th>
                </tr>
              </thead>
              <tbody>
                {filasCobertura.map(({ item, stockActual, stockMinimo, dias, sugerida }) => {
                  const bajoMinimo = stockActual !== null && stockMinimo !== null && stockActual <= stockMinimo;
                  return (
                    <tr key={item.insumoId} className="border-t border-stone-100 dark:border-white/5">
                      <td className="py-2.5 pr-3 font-bold">
                        {item.nombre}
                        {bajoMinimo && <span className="ml-2 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:text-red-300">Bajo mínimo</span>}
                      </td>
                      <td className="py-2.5 pr-3">
                        {stockActual === null ? "—" : `${formatoNumero(stockActual)} ${item.unidad}`}
                      </td>
                      <td className="py-2.5 pr-3">
                        {item.consumoDiario === null ? "—" : `${formatoNumero(item.consumoDiario)} ${item.unidad}/día`}
                        {item.consumoDiario !== null && (
                          <span className="block text-[11px] text-stone-400">
                            ~{formatoNumero(item.consumoDiario * 7, 1)} {item.unidad}/semana
                            {item.fuenteConsumo === "kg-recientes" ? " · según kg recientes" : ""}
                          </span>
                        )}
                      </td>
                      <td className={`py-2.5 pr-3 text-base font-extrabold ${claseDias(dias)}`}>
                        {dias === null ? "—" : `${formatoNumero(Math.floor(dias), 0)}`}
                      </td>
                      <td className="py-2.5 text-xs font-semibold">
                        {sugerida !== null ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-amber-800 dark:text-amber-300">
                            <ShoppingBag className="h-3.5 w-3.5" />Comprar ~{formatoNumero(sugerida, 0)} {item.unidad}
                          </span>
                        ) : dias !== null ? (
                          <span className="text-green-700 dark:text-green-400">Stock suficiente</span>
                        ) : (
                          <span className="text-stone-400">Sin consumo medido</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Tarjeta>
      )}

      {detalle && detalle.totalDescartados > 0 && (
        <Tarjeta icono={AlertTriangle} titulo={`Períodos descartados (${detalle.totalDescartados})`} descripcion="No se usaron en el último cálculo. Revisa si faltó anotar una compra o registrar los kg de las comandas.">
          <ul className="space-y-1.5 text-sm">
            {detalle.descartados.map((d) => (
              <li key={`${d.insumo}-${d.desde}-${d.hasta}`} className="rounded-xl bg-amber-50/70 px-3 py-2 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
                <strong>{d.insumo}</strong> · {fecha(d.desde)} → {fecha(d.hasta)}: {d.motivo}
              </li>
            ))}
          </ul>
          {detalle.totalDescartados > detalle.descartados.length && <p className="mt-2 text-xs text-stone-400">Se muestran {detalle.descartados.length} de {detalle.totalDescartados}.</p>}
        </Tarjeta>
      )}

      <details className="glass-panel group rounded-2xl p-5 sm:p-6">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-bold text-stone-700 dark:text-stone-200">
          <span className="flex items-center gap-2">
            <Scale className="h-4 w-4 text-brand-500" />
            Ver detalles técnicos del modelo (MAPE, tasas y validación)
          </span>
          <ChevronDown className="h-4 w-4 text-stone-400 transition group-open:rotate-180" />
        </summary>

        <div className="mt-5 space-y-6">
          {modelo && (
            <div className="flex flex-wrap gap-2 text-xs font-bold">
              <span className="rounded-full bg-stone-100 px-3 py-1 text-stone-600 dark:bg-white/5 dark:text-stone-300">λ = {formatoNumero(modelo.lambda ?? 0)}</span>
              <span className="rounded-full bg-stone-100 px-3 py-1 text-stone-600 dark:bg-white/5 dark:text-stone-300">Margen {porcentaje((modelo.margenSeguridad ?? 0) * 100, 0)}</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Kpi etiqueta="Error medio (MAPE)" valor={porcentaje(modelo?.mape)} nota="Diferencia promedio entre lo estimado y lo contado" clase="text-brand-600 dark:text-brand-400" />
            <Kpi etiqueta="Períodos usados" valor={String(modelo?.observaciones ?? 0)} nota="Pares de conteos consecutivos" />
            <Kpi etiqueta="Rango de estimación" valor={modelo?.desviacionRelativa ? `±${porcentaje(modelo.desviacionRelativa * 100, 0)}` : "—"} nota="Se estrecha con más conteos" />
          </div>

          {detalle && detalle.insumos.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-stone-400">Error por insumo</h3>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead className="text-xs uppercase text-stone-400">
                    <tr><th className="py-2 pr-3">Insumo</th><th className="py-2 pr-3">Períodos</th><th className="py-2">Error (MAPE / MAE)</th></tr>
                  </thead>
                  <tbody>
                    {detalle.insumos.map((i) => (
                      <tr key={i.insumoId} className="border-t border-stone-100 dark:border-white/5">
                        <td className="py-2 pr-3 font-bold">{i.nombre}</td>
                        <td className="py-2 pr-3">{i.observaciones}</td>
                        <td className="py-2">
                          {porcentaje(i.mape)}{i.mae !== null && <span className="text-xs text-stone-400"> · ±{formatoNumero(i.mae)} {i.unidad}</span>}
                          <span className="block text-[11px] text-stone-400">{METODO[i.metodoError]}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-stone-400">Tasas actuales frente a iniciales</h3>
            {panel.tasaConsumos.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="text-xs uppercase text-stone-400">
                    <tr><th className="py-2 pr-3">Insumo</th><th className="py-2 pr-3">Servicio</th><th className="py-2 pr-3">Inicial</th><th className="py-2 pr-3">Actual</th><th className="py-2">Variación</th></tr>
                  </thead>
                  <tbody>
                    {panel.tasaConsumos.map((t) => {
                      const variacion = t.tasaInicial > 0 ? ((t.tasaActual - t.tasaInicial) / t.tasaInicial) * 100 : null;
                      return (
                        <tr key={`${t.tipoServicioId}-${t.insumoId}`} className="border-t border-stone-100 dark:border-white/5">
                          <td className="py-2 pr-3 font-bold">{t.insumo.nombre}</td>
                          <td className="py-2 pr-3">{t.tipoServicio.nombre}</td>
                          <td className="py-2 pr-3">{formatoTasaLegible(t.tasaInicial, t.unidad)} {t.unidad}/kg</td>
                          <td className="py-2 pr-3 font-bold">{formatoTasaLegible(t.tasaActual, t.unidad)} {t.unidad}/kg</td>
                          <td className={`py-2 font-bold ${variacion === null || Math.abs(variacion) < 0.05 ? "text-stone-400" : variacion > 0 ? "text-amber-600 dark:text-amber-400" : "text-green-600 dark:text-green-400"}`}>
                            {variacion === null ? "—" : `${variacion > 0 ? "+" : ""}${formatoNumero(variacion, 1)}%`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="rounded-xl bg-stone-50 p-4 text-sm text-stone-500 dark:bg-white/5">Aún no hay dosis definidas. Configúralas en la pestaña Dosis por servicio.</p>
            )}
          </div>
        </div>
      </details>
    </div>
  );
}
