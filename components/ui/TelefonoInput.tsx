"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  PAISES_TELEFONO,
  PAIS_TELEFONO_PREDETERMINADO,
  describirTelefono,
  detectarTelefono,
  extraerNacional,
  formatearNacional,
  formatearTelefono,
  interpretarEntrada,
  obtenerPaisTelefono,
  prefijoVisible,
  validarNacional,
} from "@/lib/telefonos";

/**
 * Estilos de cada familia de formularios:
 *  - "claro": sitio público (modal de ingreso, cotización).
 *  - "intranet": formularios de la intranet, con modo oscuro.
 */
export type VarianteTelefono = "claro" | "intranet";

const ESTILOS = {
  claro: {
    caja: "bg-stone-50/50 focus-within:bg-white",
    borde: { neutro: "border-stone-200 focus-within:border-brand-500", valido: "border-green-300 focus-within:border-green-500", invalido: "border-red-300 focus-within:border-red-500" },
    prefijo: "border-stone-200 text-stone-700",
    chevron: "text-stone-400",
    input: "text-stone-850 placeholder-stone-400",
    mensaje: { base: "text-[11px] font-semibold", neutro: "text-stone-400", valido: "text-green-600", invalido: "text-red-500" },
  },
  intranet: {
    caja: "bg-stone-50 dark:bg-stone-800",
    borde: { neutro: "border-stone-200 dark:border-white/10 focus-within:border-brand-500", valido: "border-emerald-400 dark:border-emerald-500", invalido: "border-red-400 dark:border-red-500" },
    prefijo: "border-stone-200 text-stone-700 dark:border-white/10 dark:text-stone-200",
    chevron: "text-stone-400 dark:text-stone-500",
    input: "text-stone-800 placeholder-stone-400 dark:text-stone-200 dark:placeholder-stone-600",
    mensaje: { base: "text-[10px]", neutro: "text-stone-400", valido: "text-emerald-600 dark:text-emerald-400", invalido: "text-red-500" },
  },
} as const;

export interface TelefonoInputProps {
  /** Valor normalizado (`+56 9 1234 5678`) o vacío. */
  value: string;
  onChange: (valor: string) => void;
  /** Id del campo del número, para el `htmlFor` de la etiqueta del formulario. */
  id?: string;
  variante?: VarianteTelefono;
  disabled?: boolean;
  required?: boolean;
  /** Texto de ayuda mientras el campo está vacío. */
  ayuda?: string;
  /** Etiqueta accesible cuando el formulario no tiene `<label htmlFor>`. */
  ariaLabel?: string;
}

/**
 * Teléfono con selector de país: por defecto Chile celular (`+56 9`), y la
 * persona solo escribe el resto del número. Al editar un valor guardado se
 * detecta el país desde su prefijo.
 */
export default function TelefonoInput({ value, onChange, id, variante = "intranet", disabled, required, ayuda, ariaLabel }: TelefonoInputProps) {
  const idGenerado = useId();
  const idCampo = id ?? `telefono-${idGenerado}`;
  const idMensaje = `${idCampo}-estado`;
  const estilos = ESTILOS[variante];

  const [paisId, setPaisId] = useState(() => (value.trim() ? detectarTelefono(value).pais.id : PAIS_TELEFONO_PREDETERMINADO));
  const [ultimoValor, setUltimoValor] = useState(value);
  const [tocado, setTocado] = useState(false);

  // Si el formulario cambia el valor desde fuera (otra ficha, reinicio), se
  // vuelve a detectar el país. Los cambios propios ya quedaron registrados.
  if (value !== ultimoValor) {
    setUltimoValor(value);
    setPaisId(value.trim() ? detectarTelefono(value).pais.id : PAIS_TELEFONO_PREDETERMINADO);
    setTocado(false);
  }

  const pais = obtenerPaisTelefono(paisId);
  const nacional = extraerNacional(pais, value);
  const error = validarNacional(pais, nacional);
  const completo = !error && nacional.length > 0;
  const mostrarError = Boolean(error) && (tocado || nacional.length >= Math.max(...pais.largos));
  const faltan = Math.min(...pais.largos) - nacional.length;

  const emitir = (nuevoPaisId: string, nuevoNacional: string) => {
    const nuevo = formatearTelefono(nuevoPaisId, nuevoNacional);
    setUltimoValor(nuevo);
    if (nuevo !== value) onChange(nuevo);
  };

  const cambiarPais = (nuevoId: string) => {
    setPaisId(nuevoId);
    if (nacional) emitir(nuevoId, nacional);
  };

  const mostrado = formatearNacional(pais, nacional);

  const cambiarNumero = (e: React.ChangeEvent<HTMLInputElement>) => {
    let texto = e.target.value;
    // Borrar solo un espacio del formato no cambiaría el número: se borra el
    // dígito de al lado, como espera quien presiona la tecla.
    if (texto.length < mostrado.length && texto.replace(/\D/g, "") === nacional) {
      const cursor = e.target.selectionStart ?? texto.length;
      const haciaAdelante = (e.nativeEvent as InputEvent).inputType === "deleteContentForward";
      texto = haciaAdelante
        ? texto.slice(0, cursor) + texto.slice(cursor).replace(/\d/, "")
        : texto.slice(0, cursor).replace(/\d(?=\D*$)/, "") + texto.slice(cursor);
    }
    const entrada = interpretarEntrada(pais, texto);
    if (entrada.pais.id !== paisId) setPaisId(entrada.pais.id);
    emitir(entrada.pais.id, entrada.nacional);
  };

  const estado = mostrarError ? "invalido" : completo ? "valido" : "neutro";
  let mensaje = "";
  if (mostrarError) mensaje = error!;
  else if (completo) mensaje = describirTelefono(pais);
  else if (nacional) mensaje = faltan > 0 ? `Faltan ${faltan} ${faltan === 1 ? "dígito" : "dígitos"}` : error ?? "";
  else mensaje = ayuda ?? "";

  return (
    <div className="space-y-1.5">
      <div className={`flex w-full items-stretch overflow-hidden rounded-xl border transition-all ${estilos.caja} ${estilos.borde[estado]} ${disabled ? "opacity-60" : ""}`}>
        <div className={`relative flex shrink-0 items-center gap-1.5 border-r pl-3 pr-2 text-sm font-semibold ${estilos.prefijo}`}>
          <span aria-hidden="true">{pais.bandera}</span>
          <span aria-hidden="true" className="tabular-nums">{prefijoVisible(pais)}</span>
          <ChevronDown aria-hidden="true" className={`h-3.5 w-3.5 ${estilos.chevron}`} />
          {/* Selector nativo transparente: teclado y lector de pantalla, y el selector del sistema en móviles. */}
          <select
            value={paisId}
            onChange={(e) => cambiarPais(e.target.value)}
            disabled={disabled}
            aria-label={`País del teléfono: ${pais.etiqueta} (${prefijoVisible(pais)})`}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed dark:[color-scheme:dark]"
          >
            {PAISES_TELEFONO.map((p) => (
              <option key={p.id} value={p.id}>{`${p.bandera} ${p.etiqueta} (${prefijoVisible(p)})`}</option>
            ))}
          </select>
        </div>
        <input
          id={idCampo}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          value={mostrado}
          onChange={cambiarNumero}
          onBlur={() => setTocado(true)}
          placeholder={pais.ejemplo}
          disabled={disabled}
          required={required}
          aria-label={ariaLabel}
          aria-invalid={mostrarError || undefined}
          aria-describedby={mensaje ? idMensaje : undefined}
          className={`min-w-0 flex-1 bg-transparent py-3 pl-3 pr-4 text-sm font-medium tabular-nums focus:outline-none disabled:cursor-not-allowed ${estilos.input}`}
        />
      </div>
      {mensaje && (
        <p id={idMensaje} className={`${estilos.mensaje.base} ${estilos.mensaje[estado]}`}>
          {mensaje}
        </p>
      )}
    </div>
  );
}
