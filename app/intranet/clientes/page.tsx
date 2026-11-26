"use client";

import { registrarError } from "@/lib/registro-seguro";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Building2, Mail, MapPin, Package, Pencil, Phone, Plus, Loader2, Search, User } from "lucide-react";
import { useRoleGuard } from "@/components/intranet/useRoleGuard";
import { dataConnect } from "@/lib/firebase/client";
import { formatRut, isValidRut } from "@/lib/validators";
import { normalizarTelefono, validarTelefono } from "@/lib/telefonos";
import TelefonoInput from "@/components/ui/TelefonoInput";
import { ComandaEstado, TipoCliente } from "@/src/dataconnect-generated";
import { executeMutation, executeQuery, mutationRef, queryRef } from "firebase/data-connect";
import GlassSelect from "@/components/ui/GlassSelect";
import EncabezadoSeccion, { BOTON_ENCABEZADO } from "@/components/intranet/EncabezadoSeccion";
import ModalIntranet, { BOTON_MODAL_PRIMARIO, BOTON_MODAL_SECUNDARIO } from "@/components/intranet/ModalIntranet";
import ConfirmacionCuentaCliente, { OpcionCuentaCliente } from "@/components/intranet/ConfirmacionCuentaCliente";
import { avisoClienteConCuenta, registrarClienteConCuenta, registrarFichaCliente } from "@/lib/clientes/cuenta";
import { mapAuthError } from "@/lib/firebase/errors";

const clp = (n: number) => `$${n.toLocaleString("es-CL")}`;

type ComandaCliente = {
  id: string;
  estado: ComandaEstado;
  valorTotal: number;
  fechaRecepcion: string;
  comandaDetalles_on_comanda: { cantidad: number }[];
};

type ClienteFirebase = {
  id: string;
  rut?: string | null;
  nombre: string;
  tipoCliente: TipoCliente;
  telefono?: string | null;
  email?: string | null;
  direccion?: string | null;
  creadoEn: string;
  comandas_on_cliente: ComandaCliente[];
};

type GetFichasClientesData = { clientes: ClienteFirebase[] };
type ClienteForm = {
  id?: string;
  rut: string;
  nombre: string;
  tipoCliente: TipoCliente;
  telefono: string;
  email: string;
  direccion: string;
};

type EditarFichaVariables = ClienteForm & { id: string };
type EditarFichaData = { cliente_update?: { id: string } | null };

const FORM_VACIO: ClienteForm = {
  rut: "",
  nombre: "",
  tipoCliente: TipoCliente.PARTICULAR,
  telefono: "",
  email: "",
  direccion: "",
};

/**
 * Gestión comercial de fichas de clientes (`/intranet/clientes`).
 * Accesible para `admin` y `recepcionista`. Permite listar, buscar, editar y registrar
 * clientes (con o sin creación de cuenta de acceso a la plataforma) junto con sus métricas
 * acumuladas de comandas, prendas y facturación.
 */
export default function ClientesPage() {
  const permitido = useRoleGuard(["admin", "recepcionista"]);
  const [clientes, setClientes] = useState<ClienteFirebase[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ClienteForm | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [informado, setInformado] = useState(false);
  // Ficha nueva con cuenta en la plataforma: exige correo y la confirmación.
  const [conCuenta, setConCuenta] = useState(false);
  // Contador monotónico para descartar respuestas fuera de orden entre polling y acciones manuales.
  const solicitudActual = useRef(0);

  const cargarClientes = useCallback(async (silencioso = false) => {
    const solicitud = ++solicitudActual.current;
    if (!silencioso) setLoading(true);
    try {
      const result = await executeQuery(
        queryRef<GetFichasClientesData, undefined>(dataConnect, "GetFichasClientes", undefined),
        { fetchPolicy: "SERVER_ONLY" },
      );
      if (solicitud === solicitudActual.current) setClientes(result.data.clientes);
    } catch (error) {
      registrarError("No se pudieron cargar las fichas de clientes:", error);
      if (!silencioso) setNotice("No se pudieron cargar los clientes.");
    } finally {
      if (solicitud === solicitudActual.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!permitido) return;

    void Promise.resolve().then(() => cargarClientes());
    const actualizarSilenciosamente = () => void cargarClientes(true);
    const alCambiarVisibilidad = () => {
      if (document.visibilityState === "visible") actualizarSilenciosamente();
    };
    const intervalo = window.setInterval(actualizarSilenciosamente, 10_000);
    window.addEventListener("focus", actualizarSilenciosamente);
    document.addEventListener("visibilitychange", alCambiarVisibilidad);

    return () => {
      window.clearInterval(intervalo);
      window.removeEventListener("focus", actualizarSilenciosamente);
      document.removeEventListener("visibilitychange", alCambiarVisibilidad);
    };
  }, [cargarClientes, permitido]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  // Prendas y facturado excluyen comandas anuladas; el total de comandas conserva el histórico completo.
  const fichas = useMemo(() => clientes.map((cliente) => {
    const activas = cliente.comandas_on_cliente.filter((c) => c.estado !== ComandaEstado.ANULADA);
    return {
      ...cliente,
      comandas: cliente.comandas_on_cliente.length,
      prendas: activas.reduce(
        (total, comanda) => total + comanda.comandaDetalles_on_comanda.reduce((suma, d) => suma + d.cantidad, 0),
        0,
      ),
      facturado: activas.reduce((total, comanda) => total + comanda.valorTotal, 0),
      ultima: cliente.comandas_on_cliente[0]?.fechaRecepcion,
    };
  }), [clientes]);

  const filtered = useMemo(() => {
    const termino = search.trim().toLocaleLowerCase("es-CL");
    if (!termino) return fichas;
    return fichas.filter((cliente) =>
      cliente.nombre.toLocaleLowerCase("es-CL").includes(termino)
      || (cliente.rut || "").toLocaleLowerCase("es-CL").includes(termino)
      || (cliente.email || "").toLocaleLowerCase("es-CL").includes(termino)
      || (cliente.telefono || "").includes(termino),
    );
  }, [fichas, search]);

  const guardar = async () => {
    if (!form || !form.nombre.trim()) {
      setNotice("El nombre del cliente es obligatorio.");
      return;
    }
    if (!isValidRut(form.rut)) {
      setNotice("Ingresa un RUT chileno válido.");
      return;
    }
    const errorTelefono = validarTelefono(form.telefono);
    if (errorTelefono) {
      setNotice(errorTelefono);
      return;
    }
    if (!form.id && conCuenta && !form.email.trim()) {
      setNotice("Ingresa el correo del cliente: se usa para crear su cuenta.");
      return;
    }
    if (form.email.trim() && !/^\S+@\S+\.\S+$/.test(form.email.trim())) {
      setNotice("Ingresa un correo válido.");
      return;
    }
    if (!form.id && conCuenta && !informado) {
      setNotice("Confirma que informaste al cliente sobre su cuenta.");
      return;
    }

    setSaving(true);
    const datos = {
      nombre: form.nombre.trim(),
      tipoCliente: form.tipoCliente,
      rut: formatRut(form.rut),
      telefono: normalizarTelefono(form.telefono),
      email: form.email.trim(),
      direccion: form.direccion.trim(),
    };
    try {
      if (form.id) {
        await executeMutation(mutationRef<EditarFichaData, EditarFichaVariables>(
          dataConnect,
          "EditarFichaCliente",
          { id: form.id, ...datos },
        ));
      } else {
        const ficha = { ...datos, telefono: datos.telefono || undefined, direccion: datos.direccion || undefined };
        if (conCuenta) {
          const resultado = await registrarClienteConCuenta(dataConnect, ficha);
          setNotice(avisoClienteConCuenta(resultado, datos.email));
        } else {
          await registrarFichaCliente(dataConnect, { ...ficha, email: datos.email || undefined });
          setNotice("Ficha registrada correctamente (sin cuenta en la plataforma).");
        }
        await cargarClientes(true);
        setForm(null);
        setInformado(false);
        setConCuenta(false);
        return;
      }
      await cargarClientes(true);
      setNotice("Ficha actualizada correctamente.");
      setForm(null);
    } catch (error) {
      registrarError("No se pudo guardar la ficha:", error);
      const code = (error as { code?: string } | null)?.code;
      setNotice(String(error).includes("ALREADY_EXISTS")
        ? "Ya existe un cliente o una cuenta registrada con ese RUT o correo."
        : code?.startsWith("auth/") ? mapAuthError(error)
        : "No se pudo guardar la ficha del cliente.");
    } finally {
      setSaving(false);
    }
  };

  if (!permitido || loading) {
    return <div className="flex h-full items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-brand-500" /></div>;
  }

  return (
    <div className="min-h-screen space-y-6 p-4 text-stone-900 dark:text-stone-100 sm:p-6">
      {notice && <div className="fixed right-5 top-20 z-[70] rounded-xl bg-stone-900 px-4 py-3 text-sm font-semibold text-white shadow-xl dark:bg-white dark:text-stone-900">{notice}</div>}

      <EncabezadoSeccion
        antetitulo="Comercial · Fichas de clientes"
        titulo="Clientes"
        descripcion={`${clientes.length} fichas registradas en Firebase`}
        acciones={
          <button onClick={() => { setForm({ ...FORM_VACIO }); setConCuenta(false); setInformado(false); }} className={BOTON_ENCABEZADO}>
            <Plus className="h-4 w-4" /> Registrar cliente
          </button>
        }
      />

      <div className="relative max-w-md">
        <input type="text" placeholder="Buscar por nombre, RUT, correo o teléfono..." value={search} onChange={(e) => setSearch(e.target.value)} className="glass-panel w-full rounded-xl py-2.5 pl-9 pr-4 text-sm text-stone-700 shadow-sm placeholder-stone-400 focus:outline-none focus:border-brand-500/50 dark:text-stone-200" />
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((cliente, i) => (
          <motion.article key={cliente.id} initial={{ opacity: 0, scale: 0.96, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ delay: Math.min(i * 0.04, 0.3) }} className="glass-panel rounded-2xl p-5 transition-colors hover:border-brand-500/30">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-brand text-white">
                {cliente.tipoCliente === TipoCliente.HOTEL ? <Building2 className="h-5 w-5" /> : <User className="h-5 w-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-stone-900 dark:text-white">{cliente.nombre}</p>
                <span className="rounded-full bg-brand-500/10 px-2 py-0.5 text-[10px] font-bold text-brand-600 dark:text-brand-400">{cliente.tipoCliente === TipoCliente.HOTEL ? "Hotel" : "Particular / Empresa"}</span>
              </div>
              <button onClick={() => setForm({ id: cliente.id, rut: cliente.rut || "", nombre: cliente.nombre, tipoCliente: cliente.tipoCliente, telefono: cliente.telefono || "", email: cliente.email || "", direccion: cliente.direccion || "" })} className="rounded-lg p-2 text-stone-400 transition-colors hover:bg-brand-500/10 hover:text-brand-600" title="Editar ficha"><Pencil className="h-4 w-4" /></button>
            </div>
            <div className="mb-3 space-y-1.5 text-xs text-stone-500 dark:text-stone-400">
              <span className="flex items-center gap-2"><span className="w-3.5 text-center font-bold">R</span>{cliente.rut || "Sin RUT"}</span>
              <span className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" />{cliente.telefono || "Sin teléfono"}</span>
              <span className="flex items-center gap-2 truncate"><Mail className="h-3.5 w-3.5" />{cliente.email || "Sin correo"}</span>
              <span className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5" />{cliente.direccion || "Sin dirección"}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 border-t border-stone-100 pt-3 text-center dark:border-white/5">
              <Metric value={cliente.comandas} label="comandas" />
              <Metric value={cliente.prendas} label="prendas" icon />
              <Metric value={clp(cliente.facturado)} label="facturado" brand />
            </div>
            {cliente.ultima && <p className="mt-3 text-right text-[10px] text-stone-400">Última comanda: {new Date(cliente.ultima).toLocaleDateString("es-CL")}</p>}
          </motion.article>
        ))}
        {filtered.length === 0 && <div className="col-span-full py-16 text-center text-sm text-stone-400">No se encontraron clientes.</div>}
      </motion.div>

      <AnimatePresence>
      {form && <ModalIntranet
        onCerrar={() => setForm(null)}
        bloqueado={saving}
        icono={User}
        etiqueta="Ficha administrativa"
        titulo={form.id ? "Editar cliente" : "Registrar cliente"}
        subtitulo="Gestión de datos de facturación y contacto."
        pie={
          <>
            <button type="button" onClick={() => setForm(null)} disabled={saving} className={BOTON_MODAL_SECUNDARIO}>
              Cancelar
            </button>
            <button
              onClick={guardar}
              disabled={saving || !form.nombre.trim() || (!form.id && conCuenta && (!form.email.trim() || !informado))}
              className={BOTON_MODAL_PRIMARIO}
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? "Guardando..." : form.id ? "Guardar cambios" : "Registrar cliente"}
            </button>
          </>
        }
      >
          <div className="space-y-4">
            {!form.id && <OpcionCuentaCliente marcada={conCuenta} onChange={(valor) => { setConCuenta(valor); if (!valor) setInformado(false); }} disabled={saving} />}
            <Field label="Nombre o razón social" value={form.nombre} onChange={(nombre) => setForm({ ...form, nombre })} required />
            <Field
              label="RUT de persona o empresa"
              value={form.rut}
              onChange={(rut) => setForm({ ...form, rut: formatRut(rut) })}
              required
              placeholder="12.345.678-5"
              hint={form.rut ? (isValidRut(form.rut) ? "RUT válido" : "Dígito verificador incorrecto") : "Se validará automáticamente"}
              valid={form.rut ? isValidRut(form.rut) : undefined}
            />
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">Tipo de cliente</label>
              <GlassSelect
                value={form.tipoCliente}
                onChange={(val) => setForm({ ...form, tipoCliente: val as TipoCliente })}
                ariaLabel="Tipo de cliente"
                options={[
                  { value: TipoCliente.PARTICULAR, label: "Particular / Empresa" },
                  { value: TipoCliente.HOTEL, label: "Hotel" },
                ]}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="cliente-telefono" className="text-[10px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">Teléfono</label>
                <TelefonoInput
                  id="cliente-telefono"
                  value={form.telefono}
                  onChange={(telefono) => setForm((actual) => (actual ? { ...actual, telefono } : actual))}
                  ayuda="Celular por defecto; elige «Chile · teléfono fijo» u otro país"
                />
              </div>
              <Field label={form.id ? "Correo" : conCuenta ? "Correo (obligatorio)" : "Correo (opcional)"} type="email" value={form.email} onChange={(email) => setForm({ ...form, email })} placeholder="contacto@empresa.cl" />
            </div>
            <Field label="Dirección" value={form.direccion} onChange={(direccion) => setForm({ ...form, direccion })} placeholder="Av. Balmaceda 1234, Calama" />
            {!form.id && conCuenta && <ConfirmacionCuentaCliente marcada={informado} onChange={setInformado} disabled={saving} />}
          </div>
      </ModalIntranet>}
      </AnimatePresence>
    </div>
  );
}

function Metric({ value, label, icon, brand }: { value: string | number; label: string; icon?: boolean; brand?: boolean }) {
  return <div><p className={`flex items-center justify-center gap-1 text-sm font-extrabold ${brand ? "text-brand-600 dark:text-brand-400" : "text-stone-900 dark:text-white"}`}>{icon && <Package className="h-3 w-3 text-stone-400" />}{value}</p><p className="text-[10px] text-stone-400">{label}</p></div>;
}

function Field({ label, value, onChange, type = "text", required, placeholder, hint, valid }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; placeholder?: string; hint?: string; valid?: boolean }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
        {label}{required ? " *" : ""}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-xl border bg-stone-50/70 px-4 py-3 text-sm text-stone-800 placeholder-stone-400 outline-none focus:border-brand-500 dark:bg-stone-800/80 dark:text-stone-200 dark:placeholder-stone-500 transition-all ${
          valid === false ? "border-red-400 dark:border-red-500" : valid === true ? "border-emerald-400 dark:border-emerald-500" : "border-stone-200/80 dark:border-white/10"
        }`}
      />
      {hint && (
        <span className={`block text-[10px] ${valid === false ? "text-red-500" : valid === true ? "text-emerald-600 dark:text-emerald-400" : "text-stone-400"}`}>
          {hint}
        </span>
      )}
    </div>
  );
}
