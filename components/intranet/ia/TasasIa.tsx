"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Info, Plus, SlidersHorizontal, Table2, Trash2 } from "lucide-react";
import GlassSelect from "@/components/ui/GlassSelect";
import { dataConnect } from "@/lib/firebase/client";
import { registrarError } from "@/lib/registro-seguro";
import { formatoTasaLegible } from "@/lib/ia/prediccion";
import { convertirTasa } from "@/lib/ia/tasas";
import { esInsumoModelable, unidadesTasaPara, unidadTasaSugerida } from "@/lib/ia/unidades";
import { eliminarTasaConsumo, guardarConfiguracionIa, guardarTasaConsumo, type GetPanelIaData } from "@/src/dataconnect-generated";
import {
  BotonGuardar, claseBotonSecundario, claseCampo, claseEtiqueta, formatoNumero, leerNumero, mensajeErrorIa, Modal, Tarjeta, type Avisar,
} from "./ui";

type Tasa = GetPanelIaData["tasaConsumos"][number];
type Insumo = GetPanelIaData["insumos"][number];
type Servicio = GetPanelIaData["tipoServicios"][number];
type Edicion = { insumo: Insumo; servicio: Servicio; tasa?: Tasa; valor: string; unidad: string; fuente: string; reiniciar: boolean; confirmarBorrado: boolean };

// Normaliza UUIDs sin guiones para indexar la matriz servicio×insumo sin depender del formato.
const uuid = (id: string) => id.replaceAll("-", "").toLowerCase();

/** Construye la clave única normalizada para una celda servicio–insumo en el mapa de tasas. */
export const claveTasa = (servicioId: string, insumoId: string) => `${uuid(servicioId)}|${uuid(insumoId)}`;

/** Margen de seguridad por defecto (15 %) aplicado cuando aún no existe configuración guardada. */
export const MARGEN_INICIAL = 0.15;
/** Factor de regularización λ por defecto (equivalente a un período de evidencia). */
export const LAMBDA_INICIAL = 1;

const PERFILES_LAMBDA = [
  { etiqueta: "Conservador", valor: "3", descripcion: "Respeta más tu dosis inicial" },
  { etiqueta: "Equilibrado", valor: "1", descripcion: "Recomendado" },
  { etiqueta: "Rápido", valor: "0,3", descripcion: "Se adapta rápido a los conteos" },
] as const;

function ParametrosModelo({
  config,
  recargar,
  avisar,
  onCambioDatos,
}: {
  config: GetPanelIaData["configuracionIa"];
  recargar: () => Promise<void>;
  avisar: Avisar;
  onCambioDatos?: () => void;
}) {
  const [margen, setMargen] = useState(String(Math.round((config?.margenSeguridad ?? MARGEN_INICIAL) * 1000) / 10));
  const [lambda, setLambda] = useState(String(config?.lambda ?? LAMBDA_INICIAL).replace(".", ","));
  const [incluirSimulado, setIncluirSimulado] = useState(config?.incluirSimulado ?? false);
  const [guardandoConfig, setGuardandoConfig] = useState(false);

  const guardarParametros = async (e: React.FormEvent) => {
    e.preventDefault();
    if (guardandoConfig) return;
    const m = leerNumero(margen), l = leerNumero(lambda);
    if (m === null || m < 0 || m > 100) { avisar("El margen debe estar entre 0% y 100%.", "error"); return; }
    if (l === null || l < 0 || l > 10_000) { avisar("λ debe estar entre 0 y 10.000.", "error"); return; }
    setGuardandoConfig(true);
    try {
      await guardarConfiguracionIa(dataConnect, { margenSeguridad: m / 100, lambda: l, incluirSimulado });
      onCambioDatos?.();
      await recargar();
      avisar("Parámetros del modelo guardados. Se aplican en el próximo recálculo.", "success");
    } catch (error) {
      registrarError("No se pudo guardar la configuración IA", error);
      avisar(mensajeErrorIa(error), "error");
    } finally { setGuardandoConfig(false); }
  };

  const valorLambda = leerNumero(lambda);

  return (
    <Tarjeta icono={SlidersHorizontal} titulo="Ajustes de estimación" descripcion="Se aplican en el próximo recálculo y al estimar el consumo de nuevas comandas.">
      <form onSubmit={guardarParametros} className="space-y-4">
        <label className="block max-w-sm space-y-1.5">
          <span className={claseEtiqueta}>Margen de seguridad (%)</span>
          <input inputMode="decimal" value={margen} onChange={(e) => setMargen(e.target.value)} className={claseCampo} />
          <span className="block text-[11px] text-stone-400">Colchón extra al revisar si el stock alcanza para una comanda nueva.</span>
        </label>

        <details className="group rounded-xl border border-stone-200/80 bg-stone-50/50 p-4 dark:border-white/10 dark:bg-white/5">
          <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-bold text-stone-600 dark:text-stone-300">
            <span>Opciones avanzadas del modelo (sensibilidad λ y datos simulados)</span>
            <ChevronDown className="h-4 w-4 text-stone-400 transition group-open:rotate-180" />
          </summary>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <span className={claseEtiqueta}>Sensibilidad de aprendizaje</span>
              <div className="flex flex-wrap gap-1.5">
                {PERFILES_LAMBDA.map((perfil) => {
                  const activo = valorLambda !== null && Math.abs(valorLambda - (leerNumero(perfil.valor) ?? -1)) < 1e-6;
                  return (
                    <button
                      key={perfil.etiqueta}
                      type="button"
                      onClick={() => setLambda(perfil.valor)}
                      title={perfil.descripcion}
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${activo ? "bg-brand-500 text-white" : "bg-white text-stone-600 hover:bg-stone-100 dark:bg-stone-800 dark:text-stone-300"}`}
                    >
                      {perfil.etiqueta}
                    </button>
                  );
                })}
              </div>
              <label className="block space-y-1">
                <span className="text-[11px] font-semibold text-stone-500 dark:text-stone-400">Regularización λ</span>
                <input inputMode="decimal" value={lambda} onChange={(e) => setLambda(e.target.value)} className={claseCampo} />
                <span className="block text-[11px] text-stone-400">Cuánto se respetan las dosis iniciales. 1 equivale a un período de datos.</span>
              </label>
            </div>

            <div className="space-y-1.5">
              <span className={claseEtiqueta}>Datos de entrenamiento</span>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-stone-200/80 bg-white px-4 py-3 text-sm font-semibold dark:border-white/10 dark:bg-stone-800/80">
                <input type="checkbox" checked={incluirSimulado} onChange={(e) => setIncluirSimulado(e.target.checked)} className="h-4 w-4 rounded accent-brand-500" />
                Incluir datos simulados
              </label>
              <span className="block text-[11px] text-stone-400">Úsalo solo para demostraciones o pruebas.</span>
            </div>
          </div>
        </details>

        <div className="flex justify-end">
          <BotonGuardar guardando={guardandoConfig}>Guardar parámetros</BotonGuardar>
        </div>
      </form>
    </Tarjeta>
  );
}

/**
 * Matriz de dosis de consumo por servicio e insumo modelable y ajustes del modelo
 * (margen de seguridad visible + sensibilidad λ e inclusión de simulados en opciones avanzadas).
 */
export default function TasasIa({
  panel,
  recargar,
  avisar,
  onCambioDatos,
}: {
  panel: GetPanelIaData;
  recargar: () => Promise<void>;
  avisar: Avisar;
  onCambioDatos?: () => void;
}) {
  const [edicion, setEdicion] = useState<Edicion | null>(null);
  const [errorModal, setErrorModal] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const modelables = panel.insumos.filter((i) => esInsumoModelable(i.unidadMedida));
  const excluidos = panel.insumos.filter((i) => !esInsumoModelable(i.unidadMedida));
  const tasas = useMemo(() => new Map(panel.tasaConsumos.map((t) => [claveTasa(t.tipoServicioId, t.insumoId), t])), [panel.tasaConsumos]);

  const abrir = (insumo: Insumo, servicio: Servicio) => {
    const tasa = tasas.get(claveTasa(servicio.id, insumo.id));
    setErrorModal(null);
    setEdicion({
      insumo, servicio, tasa,
      valor: tasa ? String(tasa.tasaInicial).replace(".", ",") : "",
      unidad: tasa?.unidad ?? unidadTasaSugerida(insumo.unidadMedida) ?? "ml",
      fuente: tasa?.fuente ?? "",
      reiniciar: false,
      confirmarBorrado: false,
    });
  };

  const guardarTasa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!edicion || guardando) return;
    setErrorModal(null);
    const tasaInicial = leerNumero(edicion.valor);
    if (tasaInicial === null || tasaInicial < 0 || tasaInicial > 100_000) { setErrorModal("Ingresa una dosis entre 0 y 100.000."); return; }
    if (edicion.fuente.length > 300) { setErrorModal("La fuente admite hasta 300 caracteres."); return; }
    // Una tasa nueva parte igual a la inicial. Si cambia la unidad, la actual se convierte.
    const actual = edicion.tasa && !edicion.reiniciar ? convertirTasa(edicion.tasa.tasaActual, edicion.tasa.unidad, edicion.unidad) : null;
    setGuardando(true);
    try {
      await guardarTasaConsumo(dataConnect, {
        tipoServicioId: edicion.servicio.id, insumoId: edicion.insumo.id,
        tasaInicial, tasaActual: actual ?? tasaInicial, unidad: edicion.unidad, fuente: edicion.fuente.trim() || null,
      });
      onCambioDatos?.();
      await recargar();
      setEdicion(null);
      avisar(`Dosis de ${edicion.insumo.nombre} para ${edicion.servicio.nombre} guardada.`, "success");
    } catch (error) {
      registrarError("No se pudo guardar la tasa", error);
      setErrorModal(mensajeErrorIa(error));
    } finally { setGuardando(false); }
  };

  const eliminar = async () => {
    if (!edicion?.tasa || guardando) return;
    setErrorModal(null);
    // Doble clic de confirmación dentro del mismo modal para prevenir eliminaciones involuntarias.
    if (!edicion.confirmarBorrado) { setEdicion({ ...edicion, confirmarBorrado: true }); return; }
    setGuardando(true);
    try {
      await eliminarTasaConsumo(dataConnect, { tipoServicioId: edicion.servicio.id, insumoId: edicion.insumo.id });
      onCambioDatos?.();
      await recargar();
      setEdicion(null);
      avisar("Dosis eliminada. Ese servicio ya no consume este insumo en la predicción.", "success");
    } catch (error) {
      registrarError("No se pudo eliminar la tasa", error);
      setErrorModal(mensajeErrorIa(error));
    } finally { setGuardando(false); }
  };

  const config = panel.configuracionIa;
  const claveConfig = `${config?.actualizadoEn ?? ""}|${config?.margenSeguridad ?? ""}|${config?.lambda ?? ""}|${config?.incluirSimulado ?? ""}`;
  const valorEjemplo = edicion ? leerNumero(edicion.valor) : null;

  return (
    <div className="space-y-6">
      <Tarjeta icono={Table2} titulo="Dosis por servicio" descripcion="Cuánto insumo usa cada servicio por kg de ropa. Tú ingresas la dosis inicial y el sistema la ajusta con cada conteo físico.">
        {!modelables.length || !panel.tipoServicios.length ? (
          <p className="rounded-xl bg-stone-50 p-4 text-sm text-stone-500 dark:bg-white/5">
            {!panel.tipoServicios.length ? "No hay servicios activos." : "No hay insumos medidos en volumen o masa."} Créalos primero en {panel.tipoServicios.length ? "Inventario" : "Comandas"}.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-stone-100 dark:border-white/5">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-stone-50/80 text-xs uppercase text-stone-400 dark:bg-white/5">
                <tr>
                  <th scope="col" className="sticky left-0 bg-stone-50 px-4 py-3 dark:bg-stone-900">Insumo</th>
                  {panel.tipoServicios.map((s) => <th key={s.id} scope="col" className="px-4 py-3">{s.nombre}</th>)}
                </tr>
              </thead>
              <tbody>
                {modelables.map((insumo) => (
                  <tr key={insumo.id} className="border-t border-stone-100 dark:border-white/5">
                    <th scope="row" className="sticky left-0 bg-white/90 px-4 py-3 font-bold dark:bg-stone-900/90">
                      {insumo.nombre}
                      <span className="block text-[11px] font-normal text-stone-400">en {insumo.unidadMedida}</span>
                    </th>
                    {panel.tipoServicios.map((servicio) => {
                      const tasa = tasas.get(claveTasa(servicio.id, insumo.id));
                      const ajustada = tasa ? Math.abs(tasa.tasaActual - tasa.tasaInicial) > 1e-9 : false;
                      return (
                        <td key={servicio.id} className="px-2 py-2">
                          <button
                            type="button" onClick={() => abrir(insumo, servicio)}
                            aria-label={`${tasa ? "Editar" : "Definir"} tasa de ${insumo.nombre} para ${servicio.nombre}`}
                            title={tasa?.fuente ? `Fuente: ${tasa.fuente}` : undefined}
                            className={`w-full rounded-xl px-3 py-2 text-left transition ${tasa ? "bg-brand-500/5 hover:bg-brand-500/10" : "text-stone-400 hover:bg-stone-100 dark:hover:bg-white/5"}`}
                          >
                            {tasa ? (
                              <>
                                <span className="block font-extrabold text-stone-800 dark:text-stone-100">
                                  {formatoTasaLegible(tasa.tasaActual, tasa.unidad)}{" "}
                                  <span className="text-xs font-semibold text-stone-400">{tasa.unidad}/kg</span>
                                </span>
                                {ajustada && (
                                  <span className="block text-[11px] font-semibold text-brand-600 dark:text-brand-400">
                                    inicial {formatoTasaLegible(tasa.tasaInicial, tasa.unidad)}
                                  </span>
                                )}
                                {tasa.fuente && <span className="mt-0.5 block truncate text-[11px] text-stone-400">{tasa.fuente}</span>}
                              </>
                            ) : (
                              <span className="flex items-center gap-1 text-xs font-semibold"><Plus className="h-3 w-3" />Definir</span>
                            )}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 flex items-start gap-2 text-xs text-stone-500 dark:text-stone-400">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Deja vacía la celda si el servicio no usa ese insumo. Usa ml o L para líquidos y g o kg para polvos.
        </p>
        {excluidos.length > 0 && (
          <p className="mt-2 text-xs text-stone-400">No entran al modelo por su unidad: {excluidos.map((i) => `${i.nombre} (${i.unidadMedida})`).join(", ")}.</p>
        )}
      </Tarjeta>

      <ParametrosModelo key={claveConfig} config={config} recargar={recargar} avisar={avisar} onCambioDatos={onCambioDatos} />

      <Modal
        abierto={!!edicion} alCerrar={() => { setErrorModal(null); setEdicion(null); }} bloqueado={guardando} icono={Table2}
        titulo={edicion?.tasa ? "Editar dosis" : "Definir dosis"}
        subtitulo={edicion ? `${edicion.insumo.nombre} · ${edicion.servicio.nombre}` : undefined}
      >
        {edicion && (
          <form onSubmit={guardarTasa} className="space-y-4">
            {errorModal && (
              <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
                {errorModal}
              </p>
            )}
            <div className="grid grid-cols-[1fr_auto] gap-3">
              <label className="space-y-1.5">
                <span className={claseEtiqueta}>Dosis inicial por kg</span>
                <input autoFocus inputMode="decimal" required value={edicion.valor} onChange={(e) => setEdicion({ ...edicion, valor: e.target.value })} placeholder="Ej: 12" className={claseCampo} />
              </label>
              <div className="w-28 space-y-1.5">
                <span className={claseEtiqueta}>Unidad</span>
                <GlassSelect
                  ariaLabel="Unidad de la tasa" value={edicion.unidad}
                  onChange={(unidad) => setEdicion({ ...edicion, unidad })}
                  options={unidadesTasaPara(edicion.insumo.unidadMedida).map((u) => ({ value: u, label: `${u}/kg` }))}
                />
              </div>
            </div>
            {valorEjemplo !== null && valorEjemplo > 0 && (
              <p className="rounded-xl bg-brand-500/5 px-3 py-2 text-xs font-semibold text-brand-700 dark:text-brand-300">
                Referencia: una comanda de 10 kg usaría aprox. {formatoNumero(valorEjemplo * 10, 2)} {edicion.unidad}.
              </p>
            )}
            <label className="block space-y-1.5">
              <span className={claseEtiqueta}>Fuente (opcional)</span>
              <input value={edicion.fuente} maxLength={300} onChange={(e) => setEdicion({ ...edicion, fuente: e.target.value })} placeholder="Ej: ficha técnica del fabricante, dosificador de la lavadora" className={claseCampo} />
            </label>
            {edicion.tasa && (
              <div className="rounded-xl bg-stone-50 p-3 text-xs text-stone-500 dark:bg-white/5 dark:text-stone-400">
                Dosis actual calculada: <strong>{formatoTasaLegible(edicion.tasa.tasaActual, edicion.tasa.unidad)} {edicion.tasa.unidad}/kg</strong>
                <label className="mt-2 flex cursor-pointer items-center gap-2 font-semibold">
                  <input type="checkbox" checked={edicion.reiniciar} onChange={(e) => setEdicion({ ...edicion, reiniciar: e.target.checked })} className="h-4 w-4 rounded accent-brand-500" />
                  Reiniciar la tasa actual a la inicial
                </label>
              </div>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              {edicion.tasa && (
                <button type="button" onClick={eliminar} disabled={guardando} className={`${claseBotonSecundario} ${edicion.confirmarBorrado ? "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300" : "hover:text-red-600"}`}>
                  <Trash2 className="h-4 w-4" />{edicion.confirmarBorrado ? "Confirmar eliminación" : "Eliminar"}
                </button>
              )}
              <button type="button" onClick={() => setEdicion(null)} disabled={guardando} className={`${claseBotonSecundario} ml-auto`}>Cancelar</button>
              <BotonGuardar guardando={guardando}>Guardar tasa</BotonGuardar>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
