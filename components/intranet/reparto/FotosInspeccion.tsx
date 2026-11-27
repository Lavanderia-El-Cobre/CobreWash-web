"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { Camera, ImagePlus, Trash2 } from "lucide-react";
import type { EvidenciaFotoInput } from "@/lib/vehiculos/modelo";

/** Tope operativo de fotografías permitidas por inspección vehicular. */
export const MAX_FOTOS_INSPECCION = 20;

/**
 * Fotografías de una inspección antes de guardarla. "Tomar foto" abre la cámara
 * trasera del celular; "Galería" permite elegir varias. Cada foto lleva una
 * descripción breve (ej. "Frontal", "Odómetro"). Los archivos se suben recién al
 * confirmar el movimiento, con un ID estable para que reintentar no duplique.
 */
export default function FotosInspeccion({
  fotos,
  onChange,
  disabled = false,
  contexto,
}: {
  fotos: EvidenciaFotoInput[];
  onChange: (fotos: EvidenciaFotoInput[]) => void;
  disabled?: boolean;
  contexto: "salida" | "regreso";
}) {
  const camara = useRef<HTMLInputElement>(null);
  const galeria = useRef<HTMLInputElement>(null);
  const urls = useRef(new Set<string>());

  useEffect(() => {
    // Revoca al desmontar todos los ObjectURL de previsualización aún activos para evitar fugas de memoria.
    const creadas = urls.current;
    return () => { creadas.forEach((u) => URL.revokeObjectURL(u)); creadas.clear(); };
  }, []);

  const agregar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivos = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith("image/"));
    // Limpia el input para permitir volver a seleccionar el mismo archivo tras eliminarlo.
    e.target.value = "";
    const cupo = MAX_FOTOS_INSPECCION - fotos.length;
    const nuevas = archivos.slice(0, Math.max(0, cupo)).map((archivo, i): EvidenciaFotoInput => {
      const previewUrl = URL.createObjectURL(archivo);
      urls.current.add(previewUrl);
      return {
        id: crypto.randomUUID(),
        rutaStorage: "",
        descripcion: `Foto de ${contexto} ${fotos.length + i + 1}`,
        nombreArchivo: archivo.name,
        previewUrl,
        archivo,
      };
    });
    if (nuevas.length) onChange([...fotos, ...nuevas]);
  };

  const quitar = (id: string) => {
    const foto = fotos.find((f) => f.id === id);
    if (foto?.previewUrl) { URL.revokeObjectURL(foto.previewUrl); urls.current.delete(foto.previewUrl); }
    onChange(fotos.filter((f) => f.id !== id));
  };

  const lleno = fotos.length >= MAX_FOTOS_INSPECCION;
  const boton = "inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50";
  return (
    <fieldset className="rounded-2xl border border-stone-200/80 bg-stone-50/70 p-4 dark:border-white/10 dark:bg-white/5" disabled={disabled}>
      <legend className="sr-only">Fotografías de la inspección</legend>
      <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
        Fotografías del vehículo ({fotos.length}/{MAX_FOTOS_INSPECCION})
      </p>
      <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
        Fotografía solo el estado del vehículo: carrocería, neumáticos, odómetro. Evita rostros, documentos y objetos personales.
      </p>
      <input ref={camara} type="file" accept="image/*" capture="environment" className="hidden" onChange={agregar} aria-label="Tomar fotografía con la cámara" />
      <input ref={galeria} type="file" accept="image/*" multiple className="hidden" onChange={agregar} aria-label="Elegir fotografías de la galería" />
      <div className="mt-3 flex gap-2">
        <button type="button" disabled={disabled || lleno} onClick={() => camara.current?.click()} className={`${boton} bg-brand-500/15 text-brand-700 hover:bg-brand-500/25 dark:text-brand-300`}>
          <Camera className="h-4 w-4" /> Tomar foto
        </button>
        <button type="button" disabled={disabled || lleno} onClick={() => galeria.current?.click()} className={`${boton} border border-stone-200/80 bg-white text-stone-700 hover:bg-stone-100 dark:border-white/10 dark:bg-stone-900 dark:text-stone-200`}>
          <ImagePlus className="h-4 w-4" /> Galería
        </button>
      </div>
      {fotos.length > 0 && (
        <ul className="mt-3 space-y-2">
          {fotos.map((f, i) => (
            <li key={f.id} className="flex items-center gap-2.5 rounded-xl border border-stone-200/70 bg-white p-2 dark:border-white/10 dark:bg-stone-900">
              {f.previewUrl ? (
                <Image src={f.previewUrl} alt={f.descripcion || `Fotografía ${i + 1}`} width={56} height={56} unoptimized className="h-14 w-14 shrink-0 rounded-lg border border-stone-200 object-cover dark:border-white/10" />
              ) : (
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-brand-500/10 text-brand-600"><Camera className="h-4 w-4" /></span>
              )}
              <label className="min-w-0 flex-1">
                <span className="sr-only">Descripción de la fotografía {i + 1}</span>
                <input
                  type="text"
                  maxLength={200}
                  value={f.descripcion}
                  onChange={(e) => onChange(fotos.map((x) => (x.id === f.id ? { ...x, descripcion: e.target.value } : x)))}
                  placeholder="Ej. Frontal, odómetro, rayón puerta"
                  className="w-full rounded-lg border border-stone-200/80 bg-stone-50 px-3 py-2 text-base text-stone-800 outline-none focus:border-brand-500 sm:text-xs dark:border-white/10 dark:bg-stone-800 dark:text-stone-100"
                />
              </label>
              <button type="button" onClick={() => quitar(f.id)} aria-label={`Quitar fotografía ${i + 1}`} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-stone-400 transition-colors hover:bg-red-500/10 hover:text-red-500">
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  );
}
