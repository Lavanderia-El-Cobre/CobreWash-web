"use client";

import { useState } from "react";
import { ChevronDown, Eye, EyeOff, FlaskConical, Info, LineChart, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { auth, dataConnect } from "@/lib/firebase/client";
import { registrarError } from "@/lib/registro-seguro";
import { leerLote } from "@/lib/ia/lote-simulado";
import { PARAMETROS_SIMULACION_INICIALES } from "@/lib/ia/simulacion";
import { guardarConfiguracionIa, type GetPanelIaData } from "@/src/dataconnect-generated";
import GraficoLineas, { COLORES_SERIE } from "./GraficoLineas";
import { LAMBDA_INICIAL, MARGEN_INICIAL } from "./TasasIa";
import { BotonGuardar, claseBotonPrincipal, claseBotonSecundario, claseCampo, claseEtiqueta, formatoNumero, leerNumero, Tarjeta, type Avisar } from "./ui";

const fecha = (iso: string) => new Date(iso).toLocaleString("es-CL", { timeZone: "America/Santiago", dateStyle: "medium", timeStyle: "short" });
const pct = (v: number) => `${formatoNumero(v, 1)}%`;

async function llamar(metodo: "POST" | "DELETE", cuerpo: unknown, ruta = "/api/ia/simulacion") {
  const usuario = auth.currentUser;
  if (!usuario) throw new Error("Sin sesión");
  const r = await fetch(ruta, {
    method: metodo, cache: "no-store",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${await usuario.getIdToken()}` },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  return { ok: r.ok, datos: await r.json().catch(() => ({})) };
}

/**
 * Simulador de pruebas del Módulo IA. Permite generar lotes sintéticos con un clic,
 * personalizar parámetros en un desplegable y aplicar simulados + recalcular directamente.
 */
export default function SimulacionIa({
  panel,
  recargar,
  avisar,
  onRecalculado,
}: {
  panel: GetPanelIaData;
  recargar: () => Promise<void>;
  avisar: Avisar;
  onRecalculado?: () => void;
}) {
  const p = PARAMETROS_SIMULACION_INICIALES;
  const [form, setForm] = useState({
    semanas: String(p.semanas), kgMin: String(p.kgSemanalMin), kgMax: String(p.kgSemanalMax),
    ruido: String(p.ruido * 100), desvio: String(p.desvioTasas * 100), semilla: "",
  });
  const [generando, setGenerando] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [elegido, setElegido] = useState<string | null>(null);
  const [revelar, setRevelar] = useState(false);
  const [confirmar, setConfirmar] = useState<string | null>(null);
  const [borrando, setBorrando] = useState(false);

  const lotes = panel.simulaciones;
  const actual = lotes.find((l) => l.id === elegido) ?? lotes[0];
  const lote = actual ? leerLote(actual.parametrosJson, actual.tasasVerdaderasJson) : null;
  const incluido = panel.configuracionIa?.incluirSimulado ?? false;

  const generar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (generando) return;
    const n = (v: string) => leerNumero(v);
    const semilla = form.semilla.trim() ? n(form.semilla) : undefined;
    const cuerpo = {
      semanas: n(form.semanas), kgSemanalMin: n(form.kgMin), kgSemanalMax: n(form.kgMax),
      ruido: (n(form.ruido) ?? NaN) / 100, desvioTasas: (n(form.desvio) ?? NaN) / 100, semilla,
    };
    setGenerando(true);
    try {
      const { ok, datos } = await llamar("POST", cuerpo);
      if (!ok) { avisar(datos.error ?? "No se pudo generar la simulación.", "error"); return; }
      setElegido(null); setRevelar(false);
      await recargar();
      avisar(`Simulación lista: ${datos.conteos} conteos. El error de las tasas bajó de ${pct(datos.errorTasasInicial)} a ${pct(datos.errorTasasFinal)}.`, "success");
    } catch (error) {
      registrarError("No se pudo generar la simulación", error);
      avisar("No se pudo generar la simulación. Revisa tu conexión.", "error");
    } finally { setGenerando(false); }
  };

  const aplicarYRecalcular = async () => {
    if (aplicando) return;
    setAplicando(true);
    try {
      if (!incluido) {
        const config = panel.configuracionIa;
        await guardarConfiguracionIa(dataConnect, {
          margenSeguridad: config?.margenSeguridad ?? MARGEN_INICIAL,
          lambda: config?.lambda ?? LAMBDA_INICIAL,
          incluirSimulado: true,
        });
      }
      const { ok, datos } = await llamar("POST", undefined, "/api/ia/recalcular");
      if (!ok) { avisar(datos.error ?? "No se pudo recalcular con datos simulados.", "error"); return; }
      onRecalculado?.();
      await recargar();
      const error = datos.mape === null || datos.mape === undefined ? "aún sin error medible" : `error medio ${pct(datos.mape)}`;
      avisar(`Ajuste ${datos.version} listo con simulados: ${datos.observaciones} períodos, ${error}.`, "success");
    } catch (error) {
      registrarError("No se pudo aplicar la simulación", error);
      avisar("No se pudo recalcular con los datos simulados. Revisa tu conexión.", "error");
    } finally { setAplicando(false); }
  };

  const borrar = async (id: string | "todos") => {
    if (borrando) return;
    // Confirmación en dos clics sobre el mismo botón para evitar borrados accidentales sin abrir otro modal.
    if (confirmar !== id) { setConfirmar(id); return; }
    setBorrando(true);
    try {
      const { ok, datos } = await llamar("DELETE", id === "todos" ? {} : { id });
      if (!ok) { avisar(datos.error ?? "No se pudo borrar.", "error"); return; }
      setConfirmar(null); setElegido(null);
      await recargar();
      avisar(id === "todos" ? "Se borraron todos los datos simulados." : "Simulación borrada.", "success");
    } catch (error) {
      registrarError("No se pudo borrar la simulación", error);
      avisar("No se pudo borrar. Revisa tu conexión.", "error");
    } finally { setBorrando(false); }
  };

  const campo = (clave: keyof typeof form, etiqueta: string, ayuda?: string) => (
    <label className="space-y-1.5">
      <span className={claseEtiqueta}>{etiqueta}</span>
      <input inputMode="decimal" value={form[clave]} onChange={(e) => setForm({ ...form, [clave]: e.target.value })} className={claseCampo} />
      {ayuda && <span className="block text-[11px] text-stone-400">{ayuda}</span>}
    </label>
  );

  return (
    <div className="space-y-6">
      <Tarjeta icono={FlaskConical} titulo="Simulador de pruebas" descripcion="Genera semanas ficticias alrededor de dosis ocultas para comprobar cómo aprende el modelo sin tocar el inventario real.">
        <form onSubmit={generar} className="space-y-4">
          <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl p-3 text-xs ${incluido ? "bg-green-500/10 text-green-800 dark:text-green-300" : "bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300"}`}>
            <span className="flex items-start gap-2">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {incluido
                ? "El modelo está usando los datos simulados. Puedes recalcular directamente después de generar."
                : "Los datos simulados no afectan la predicción real hasta que los actives. Nunca cambian el stock ni aparecen en Inventario."}
            </span>
            {lotes.length > 0 && (
              <button type="button" onClick={() => void aplicarYRecalcular()} disabled={aplicando || generando} className={claseBotonPrincipal}>
                {aplicando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                {incluido ? "Recalcular con simulados" : "Activar simulados y recalcular"}
              </button>
            )}
          </div>

          <details className="group rounded-xl border border-stone-200/80 bg-stone-50/50 p-4 dark:border-white/10 dark:bg-white/5">
            <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-bold text-stone-600 dark:text-stone-300">
              <span>Personalizar parámetros ({form.semanas} semanas · {form.kgMin}–{form.kgMax} kg/sem · ruido {form.ruido}%)</span>
              <ChevronDown className="h-4 w-4 text-stone-400 transition group-open:rotate-180" />
            </summary>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              {campo("semanas", "Semanas", "Entre 1 y 52. Un conteo al cierre de cada semana.")}
              {campo("kgMin", "Kg semanales mínimos", "Entre 6.000 y 9.000.")}
              {campo("kgMax", "Kg semanales máximos", "Entre 6.000 y 9.000.")}
              {campo("ruido", "Ruido del consumo (%)", "Variación diaria del consumo real.")}
              {campo("desvio", "Desvío de las tasas ocultas (%)", "Cuánto difieren de tus dosis iniciales.")}
              {campo("semilla", "Semilla (opcional)", "Repite exactamente la misma simulación.")}
            </div>
          </details>

          <div className="flex justify-end">
            <BotonGuardar guardando={generando}>{generando ? "Generando…" : "Generar simulación"}</BotonGuardar>
          </div>
        </form>
      </Tarjeta>

      {lotes.length > 0 && actual && (
        <Tarjeta
          icono={LineChart} titulo="Curva de aprendizaje"
          descripcion="Con cada cantidad de conteos vistos: cómo baja el error al predecir semanas nuevas y la distancia a las dosis ocultas."
          accion={
            <button type="button" onClick={() => borrar("todos")} disabled={borrando} className={`${claseBotonSecundario} ${confirmar === "todos" ? "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300" : "hover:text-red-600"}`}>
              <Trash2 className="h-4 w-4" />{confirmar === "todos" ? "Confirmar: borrar todo lo simulado" : "Borrar todos"}
            </button>
          }
        >
          <div className="mb-4 flex flex-wrap gap-2">
            {lotes.map((l) => (
              <button key={l.id} type="button" onClick={() => { setElegido(l.id); setRevelar(false); setConfirmar(null); }}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${l.id === actual.id ? "bg-brand-500 text-white" : "bg-stone-100 text-stone-500 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-400"}`}>
                {l.semanas} semanas · {fecha(l.creadoEn)}
              </button>
            ))}
          </div>
          {lote ? (
            <div className="space-y-5">
              <p className="text-xs text-stone-500">
                Semilla {lote.parametros.semilla} · {formatoNumero(lote.parametros.kgSemanalMin, 0)}–{formatoNumero(lote.parametros.kgSemanalMax, 0)} kg/semana · ruido {pct(lote.parametros.ruido * 100)} · tasas ocultas a ±{pct(lote.parametros.desvioTasas * 100)}
              </p>
              <GraficoLineas
                titulo="Error del modelo según la cantidad de conteos"
                etiquetaX="Períodos entre conteos"
                puntos={lote.curva.map((c) => ({ x: String(c.periodos), valores: [c.mape, c.errorTasas] }))}
                series={[{ nombre: "Error al predecir las semanas siguientes", color: COLORES_SERIE.naranja }, { nombre: "Distancia a las tasas ocultas", color: COLORES_SERIE.azul }]}
                formato={(v) => pct(v)}
              />
              <div>
                <button type="button" onClick={() => setRevelar(!revelar)} className={claseBotonSecundario}>
                  {revelar ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}{revelar ? "Ocultar tasas verdaderas" : "Revelar tasas verdaderas"}
                </button>
                {revelar && (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full min-w-[480px] text-left text-sm">
                      <thead className="text-xs uppercase text-stone-400"><tr><th className="py-2 pr-3">Insumo</th><th className="py-2 pr-3">Servicio</th><th className="py-2 pr-3">Tu tasa inicial</th><th className="py-2">Tasa verdadera</th></tr></thead>
                      <tbody>
                        {lote.verdaderas.map((v) => (
                          <tr key={`${v.insumo}-${v.servicio}`} className="border-t border-stone-100 dark:border-white/5">
                            <td className="py-2 pr-3 font-bold">{v.insumo}</td><td className="py-2 pr-3">{v.servicio}</td>
                            <td className="py-2 pr-3">{formatoNumero(v.inicial, 4)} {v.unidad}/kg</td>
                            <td className="py-2 font-bold">{formatoNumero(v.verdadera, 4)} {v.unidad}/kg</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="mt-2 text-[11px] text-stone-400">Compáralas con las tasas actuales en el detalle técnico de Predicción y stock después de recalcular.</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-stone-500">Este lote no tiene detalle guardado.</p>
          )}
          <div className="mt-5 flex justify-end">
            <button type="button" onClick={() => borrar(actual.id)} disabled={borrando} className={`${claseBotonSecundario} ${confirmar === actual.id ? "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300" : "hover:text-red-600"}`}>
              <Trash2 className="h-4 w-4" />{confirmar === actual.id ? "Confirmar borrado de este lote" : "Borrar este lote"}
            </button>
          </div>
        </Tarjeta>
      )}
    </div>
  );
}
