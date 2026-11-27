"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Search,
  Pencil,
  Mail,
  Phone,
  IdCard,
  UserCog,
  MapPin,
  CheckCircle2,
  AlertCircle,
  UserCheck,
  UserX,
  Loader2,
  Building2,
} from "lucide-react";
import { QueryFetchPolicy } from "firebase/data-connect";
import { dataConnect } from "@/lib/firebase/client";
import {
  getUsuarios,
  getRoles,
  type GetUsuariosData,
  type GetRolesData,
  TipoCliente,
} from "@/src/dataconnect-generated";
import { cleanRut, formatRut, isValidRut } from "@/lib/validators";
import { mapAuthError } from "@/lib/firebase/errors";
import {
  createManagedUser,
  toggleManagedUserActive,
  updateManagedUser,
} from "@/lib/firebase/auth-flows";
import {
  validateManagedUserRegistration,
  validateManagedUserUpdate,
  type ManagedUserRegistrationInput,
} from "@/lib/auth-validation";
import { useUsuarioActualContext } from "@/components/intranet/AuthGuard";
import { useRoleGuard } from "@/components/intranet/useRoleGuard";
import GlassSelect from "@/components/ui/GlassSelect";
import EncabezadoSeccion, { BOTON_ENCABEZADO } from "@/components/intranet/EncabezadoSeccion";
import ModalIntranet, { BOTON_MODAL_PRIMARIO } from "@/components/intranet/ModalIntranet";
import TelefonoInput from "@/components/ui/TelefonoInput";
import Link from "next/link";
import { VERSION_PRIVACIDAD, VERSION_TERMINOS } from "@/lib/privacidad/modelo";

type Usuario = GetUsuariosData["usuarios"][number];
type RolOpcion = GetRolesData["rols"][number];
type TabFilter = "Todos" | "Activos" | "Inactivos";
type FormState = ManagedUserRegistrationInput;

const tipoClienteOptions = [
  { value: TipoCliente.PARTICULAR, label: "Particular" },
  { value: TipoCliente.HOTEL, label: "Hotel" },
];

const roleColors: Record<string, { bg: string; text: string }> = {
  admin: { bg: "bg-brand-500/15", text: "text-brand-600 dark:text-brand-400" },
  recepcionista: { bg: "bg-sky-500/15", text: "text-sky-600 dark:text-sky-400" },
  operario: { bg: "bg-violet-500/15", text: "text-violet-600 dark:text-violet-400" },
  repartidor: { bg: "bg-amber-500/15", text: "text-amber-600 dark:text-amber-400" },
  conductor: { bg: "bg-amber-500/15", text: "text-amber-600 dark:text-amber-400" },
  cliente: { bg: "bg-emerald-500/15", text: "text-emerald-600 dark:text-emerald-400" },
};

const defaultRoleColor = { bg: "bg-stone-500/15", text: "text-stone-600 dark:text-stone-400" };

const tabs: TabFilter[] = ["Todos", "Activos", "Inactivos"];

const emptyForm: FormState = {
  rolId: "",
  nombre: "",
  apellido: "",
  rut: "",
  telefono: "",
  email: "",
  direccion: "",
  tipoCliente: "",
  informado: false,
};

type Modal = { mode: "crear" } | { mode: "editar"; usuario: Usuario } | null;

/**
 * Administración de usuarios y roles (`/intranet/usuarios`).
 * Reservado exclusivamente al rol `admin`. Permite crear cuentas enviando invitación de
 * contraseña por correo (previa confirmación de términos y privacidad), editar datos o rol
 * y activar/desactivar accesos impidiendo la auto-modificación de la propia sesión.
 */
export default function UsuariosPage() {
  const permitido = useRoleGuard(["admin"]);
  const yo = useUsuarioActualContext();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [roles, setRoles] = useState<RolOpcion[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<TabFilter>("Todos");

  const [modal, setModal] = useState<Modal>(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [aviso, setAviso] = useState("");
  const [pageError, setPageError] = useState("");

  const rutDigits = cleanRut(form.rut);
  const rutTouched = rutDigits.length > 0;
  const rutValid = rutTouched && isValidRut(form.rut);
  const selectedRole = roles.find((r) => r.id === form.rolId);

  const cargarUsuarios = async () => {
    const { data } = await getUsuarios(dataConnect, { fetchPolicy: QueryFetchPolicy.SERVER_ONLY });
    setUsuarios(data.usuarios);
  };

  useEffect(() => {
    let active = true;
    Promise.all([
      getUsuarios(dataConnect, { fetchPolicy: QueryFetchPolicy.SERVER_ONLY }),
      getRoles(dataConnect),
    ])
      .then(([usuariosResult, rolesResult]) => {
        if (!active) return;
        setUsuarios(usuariosResult.data.usuarios);
        setRoles(rolesResult.data.rols);
      })
      .catch(() => {
        if (active) setUsuarios([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const filtered = usuarios.filter((u) => {
    const matchTab = tab === "Todos" || (tab === "Activos" && u.activo) || (tab === "Inactivos" && !u.activo);
    const term = search.toLowerCase();
    const matchSearch =
      u.nombre.toLowerCase().includes(term) ||
      (u.apellido ?? "").toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term);
    return matchTab && matchSearch;
  });

  const activeCount = usuarios.filter((u) => u.activo).length;
  const inactiveCount = usuarios.filter((u) => !u.activo).length;

  const openCrear = () => {
    setForm(emptyForm);
    setFormError("");
    setModal({ mode: "crear" });
  };

  const openEditar = (usuario: Usuario) => {
    setForm({
      rolId: usuario.rol.id,
      nombre: usuario.nombre,
      apellido: usuario.apellido ?? "",
      rut: usuario.rut ?? "",
      telefono: usuario.telefono ?? "",
      email: usuario.email,
      direccion: "",
      tipoCliente: "",
    });
    setFormError("");
    setModal({ mode: "editar", usuario });
  };

  const closeModal = () => {
    if (saving) return;
    setModal(null);
  };

  const handleCrear = async () => {
    const validationError = validateManagedUserRegistration(form, selectedRole?.nombre);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setSaving(true);
    try {
      const { invitacionEnviada } = await createManagedUser(dataConnect, form, selectedRole?.nombre ?? "");
      await cargarUsuarios();
      setModal(null);
      setAviso(invitacionEnviada
        ? `Cuenta creada. Enviamos a ${form.email.trim()} un enlace para que cree su contraseña y active la cuenta.`
        : `Cuenta creada, pero no se pudo enviar la invitación a ${form.email.trim()}. Pídele usar "¿Olvidaste tu contraseña?" en el inicio de sesión para crear su contraseña.`);
    } catch (err) {
      setFormError(mapAuthError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleEditar = async () => {
    if (modal?.mode !== "editar") return;
    const validationError = validateManagedUserUpdate(form.rolId, form.nombre, form.telefono);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setSaving(true);
    try {
      await updateManagedUser(dataConnect, {
        id: modal.usuario.id,
        rolId: form.rolId,
        nombre: form.nombre,
        apellido: form.apellido,
        telefono: form.telefono,
        activo: modal.usuario.activo,
      });
      await cargarUsuarios();
      setModal(null);
    } catch (err) {
      setFormError(mapAuthError(err));
    } finally {
      setSaving(false);
    }
  };

  const toggleActivo = async (usuario: Usuario) => {
    if (saving) return;
    setSaving(true);
    setPageError("");
    try {
      await toggleManagedUserActive(dataConnect, {
        id: usuario.id,
        rolId: usuario.rol.id,
        nombre: usuario.nombre,
        apellido: usuario.apellido ?? null,
        telefono: usuario.telefono ?? null,
        activo: usuario.activo,
      });
      await cargarUsuarios();
    } catch (err) {
      setPageError(mapAuthError(err));
    } finally {
      setSaving(false);
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
        antetitulo="Administración · Cuentas y roles"
        titulo="Gestión de Usuarios"
        descripcion={`${usuarios.length} cuentas registradas · ${activeCount} activas`}
        acciones={
          <button onClick={openCrear} className={BOTON_ENCABEZADO}>
            <Plus className="w-4 h-4" />
            Nuevo Usuario
          </button>
        }
      >
        {aviso && (
          <p role="status" className="mt-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-xs font-semibold text-green-700 dark:border-green-500/20 dark:bg-green-500/10 dark:text-green-300">
            {aviso} <button type="button" onClick={() => setAviso("")} className="ml-2 underline">Cerrar</button>
          </p>
        )}
        {pageError && (
          <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
            {pageError} <button type="button" onClick={() => setPageError("")} className="ml-2 underline">Cerrar</button>
          </p>
        )}
      </EncabezadoSeccion>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-6 h-6 text-brand-500 animate-spin" />
        </div>
      ) : (
        <>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-2 lg:grid-cols-4 gap-3"
          >
            {roles.map((rol, i) => {
              const rc = roleColors[rol.nombre] ?? defaultRoleColor;
              const count = usuarios.filter((u) => u.rol.id === rol.id).length;
              return (
                <motion.div
                  key={rol.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1 + i * 0.06 }}
                  className="glass-panel rounded-2xl p-4"
                >
                  <p className={`text-2xl font-display font-extrabold ${rc.text}`}>{count}</p>
                  <p className="text-stone-500 dark:text-stone-500 text-xs mt-1 capitalize">{rol.nombre}</p>
                </motion.div>
              );
            })}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 }}
            className="flex flex-col sm:flex-row gap-3"
          >
            <div className="flex gap-2">
              {tabs.map((t) => {
                const count = t === "Todos" ? usuarios.length : t === "Activos" ? activeCount : inactiveCount;
                return (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      tab === t
                        ? "bg-brand-500 text-white"
                        : "bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700 hover:text-stone-700 dark:hover:text-stone-200"
                    }`}
                  >
                    {t}
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                        tab === t ? "bg-white/20" : "bg-stone-200 dark:bg-stone-700 text-stone-500"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="relative max-w-sm">
              <input
                type="text"
                placeholder="Buscar usuario..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-white/5 rounded-xl text-sm text-stone-700 dark:text-stone-200 placeholder-stone-400 dark:placeholder-stone-600 focus:outline-none focus:border-brand-500/50 transition-colors"
              />
              <Search className="w-4 h-4 text-stone-400 dark:text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.24 }}
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
          >
            <AnimatePresence mode="popLayout">
              {filtered.map((usuario, i) => {
                const rc = roleColors[usuario.rol.nombre] ?? defaultRoleColor;
                // Impide editar o desactivar la propia cuenta del administrador en sesión.
                const esUnoMismo = usuario.id === yo?.id;
                return (
                  <motion.div
                    key={usuario.id}
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: i * 0.06 }}
                    whileHover={{ y: -3, transition: { duration: 0.2 } }}
                    className="glass-panel rounded-2xl p-5 hover:border-brand-500/30 dark:hover:border-brand-500/20 transition-colors group"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-gradient-brand flex items-center justify-center text-white font-bold text-sm shrink-0">
                          {usuario.nombre.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-stone-900 dark:text-white font-bold text-sm">
                            {usuario.nombre} {usuario.apellido}
                          </p>
                          <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mt-0.5 capitalize ${rc.bg} ${rc.text}`}>
                            {usuario.rol.nombre}
                          </span>
                        </div>
                      </div>

                      <div
                        className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold ${
                          usuario.activo ? "bg-green-500/10 text-green-600 dark:text-green-400" : "bg-stone-200 dark:bg-stone-700 text-stone-500"
                        }`}
                      >
                        <div className={`w-1.5 h-1.5 rounded-full ${usuario.activo ? "bg-green-500 dark:bg-green-400 animate-pulse" : "bg-stone-400 dark:bg-stone-500"}`} />
                        {usuario.activo ? "Activo" : "Inactivo"}
                      </div>
                    </div>

                    <div className="space-y-1.5 mb-4">
                      <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-500">
                        <Mail className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{usuario.email}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-500">
                        <Phone className="w-3.5 h-3.5 shrink-0" />
                        <span>{usuario.telefono ?? "—"}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-stone-100 dark:border-white/5">
                      <p className="text-[10px] text-stone-400 dark:text-stone-600">
                        RUT: <span className="text-stone-500 dark:text-stone-500">{usuario.rut ?? "—"}</span>
                      </p>
                      {!esUnoMismo && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => openEditar(usuario)}
                            className="p-1.5 rounded-lg text-stone-400 dark:text-stone-500 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-500/10 transition-colors cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => toggleActivo(usuario)}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              usuario.activo
                                ? "text-stone-400 dark:text-stone-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10"
                                : "text-stone-400 dark:text-stone-500 hover:text-green-600 dark:hover:text-green-400 hover:bg-green-500/10"
                            }`}
                            title={usuario.activo ? "Desactivar" : "Activar"}
                          >
                            {usuario.activo ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {filtered.length === 0 && (
              <div className="col-span-full text-center py-16 text-stone-400 dark:text-stone-600 text-sm">
                No se encontraron usuarios.
              </div>
            )}
          </motion.div>
        </>
      )}

      <AnimatePresence>
        {modal && (
          <ModalIntranet
            onCerrar={closeModal}
            bloqueado={saving}
            icono={UserCog}
            etiqueta="Administración de cuentas"
            titulo={modal.mode === "crear" ? "Nuevo Usuario" : "Editar Usuario"}
            onSubmit={(e) => {
              e.preventDefault();
              if (modal.mode === "crear") {
                handleCrear();
              } else {
                handleEditar();
              }
            }}
            noValidate
            claseCuerpo="space-y-4"
            pie={
              <button
                type="submit"
                disabled={saving || (modal.mode === "crear" && form.informado !== true)}
                className={`${BOTON_MODAL_PRIMARIO} sm:min-w-44`}
              >
                {saving ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : modal.mode === "crear" ? (
                  "Crear Usuario"
                ) : (
                  "Guardar Cambios"
                )}
              </button>
            }
          >
                {formError && (
                  <div className="p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-xs font-semibold rounded-xl">
                    {formError}
                  </div>
                )}

                <Field label="Tipo de Usuario">
                  <GlassSelect
                    value={form.rolId}
                    onChange={(rolId) => {
                      const esCliente = roles.find((rol) => rol.id === rolId)?.nombre === "cliente";
                      setForm((current) => ({
                        ...current,
                        rolId,
                        tipoCliente: esCliente ? current.tipoCliente : "",
                      }));
                    }}
                    icon={UserCog}
                    ariaLabel="Tipo de usuario"
                    placeholder="Selecciona un rol"
                    options={roles.map((r) => ({
                      value: r.id,
                      label: r.nombre.charAt(0).toUpperCase() + r.nombre.slice(1),
                    }))}
                  />
                </Field>

                {selectedRole?.nombre === "cliente" && modal.mode === "crear" && (
                  <Field label="Tipo de Cliente">
                    <GlassSelect
                      value={form.tipoCliente}
                      onChange={(value) => setForm({ ...form, tipoCliente: value as TipoCliente })}
                      icon={Building2}
                      ariaLabel="Tipo de cliente"
                      placeholder="Selecciona un tipo de cliente"
                      options={tipoClienteOptions}
                    />
                  </Field>
                )}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Nombre">
                    <input
                      type="text"
                      value={form.nombre}
                      onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-stone-200 dark:border-white/10 bg-stone-50 dark:bg-stone-800 text-stone-800 dark:text-stone-200 placeholder-stone-400 dark:placeholder-stone-600 focus:outline-none focus:border-brand-500 transition-all text-sm font-medium"
                    />
                  </Field>
                  <Field label="Apellido">
                    <input
                      type="text"
                      value={form.apellido}
                      onChange={(e) => setForm({ ...form, apellido: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-stone-200 dark:border-white/10 bg-stone-50 dark:bg-stone-800 text-stone-800 dark:text-stone-200 placeholder-stone-400 dark:placeholder-stone-600 focus:outline-none focus:border-brand-500 transition-all text-sm font-medium"
                    />
                  </Field>
                </div>

                <Field label="RUT">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="12.345.678-9"
                      value={form.rut}
                      disabled={modal.mode === "editar"}
                      onChange={(e) => setForm({ ...form, rut: formatRut(e.target.value) })}
                      className={`w-full pl-10 pr-9 py-3 rounded-xl border bg-stone-50 dark:bg-stone-800 text-stone-800 dark:text-stone-200 placeholder-stone-400 dark:placeholder-stone-600 focus:outline-none transition-all text-sm font-medium disabled:opacity-50 ${
                        modal.mode === "crear" && rutTouched
                          ? rutValid
                            ? "border-green-300 dark:border-green-500/40 focus:border-green-500"
                            : "border-red-300 dark:border-red-500/40 focus:border-red-500"
                          : "border-stone-200 dark:border-white/10 focus:border-brand-500"
                      }`}
                    />
                    <IdCard className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    {modal.mode === "crear" && rutTouched && (
                      rutValid ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-red-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
                      )
                    )}
                  </div>
                  {modal.mode === "crear" && rutTouched && (
                    <p className={`text-[11px] font-semibold ${rutValid ? "text-green-600" : "text-red-500"}`}>
                      {rutValid ? "RUT válido" : "RUT inválido"}
                    </p>
                  )}
                </Field>

                <Field label="Teléfono" htmlFor="usuario-telefono">
                  <TelefonoInput id="usuario-telefono" value={form.telefono} onChange={(telefono) => setForm((actual) => ({ ...actual, telefono }))} />
                </Field>

                {selectedRole?.nombre === "cliente" && modal.mode === "crear" && (
                  <Field label="Dirección">
                    <div className="relative">
                      <input
                        type="text"
                        value={form.direccion}
                        onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-stone-200 dark:border-white/10 bg-stone-50 dark:bg-stone-800 text-stone-800 dark:text-stone-200 placeholder-stone-400 dark:placeholder-stone-600 focus:outline-none focus:border-brand-500 transition-all text-sm font-medium"
                      />
                      <MapPin className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    </div>
                  </Field>
                )}

                <Field label="Correo Electrónico">
                  <input
                    type="email"
                    value={form.email}
                    disabled={modal.mode === "editar"}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-stone-200 dark:border-white/10 bg-stone-50 dark:bg-stone-800 text-stone-800 dark:text-stone-200 placeholder-stone-400 dark:placeholder-stone-600 focus:outline-none focus:border-brand-500 transition-all text-sm font-medium disabled:opacity-50"
                  />
                </Field>

                {modal.mode === "crear" && (
                  <p className="flex items-start gap-2 rounded-xl border border-stone-200 bg-stone-50 p-3 text-xs leading-relaxed text-stone-600 dark:border-white/10 dark:bg-stone-800 dark:text-stone-300">
                    <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" />
                    No necesitas definir una contraseña: la persona recibirá en este correo un enlace para crearla y activar su cuenta.
                  </p>
                )}

                {modal.mode === "crear" && (
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-brand-100 bg-brand-50/50 p-3 text-xs leading-relaxed text-stone-600 dark:border-white/10 dark:bg-white/5 dark:text-stone-300">
                    <input
                      type="checkbox"
                      required
                      checked={form.informado === true}
                      onChange={(e) => setForm({ ...form, informado: e.target.checked })}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-brand-600"
                    />
                    <span>
                      Confirmo que informé a la persona de los{" "}
                      <Link href="/terminos" target="_blank" rel="noopener noreferrer" className="font-bold text-brand-700 underline dark:text-brand-400">Términos y Condiciones</Link>{" "}
                      (v{VERSION_TERMINOS}) y del{" "}
                      <Link href="/privacidad" target="_blank" rel="noopener noreferrer" className="font-bold text-brand-700 underline dark:text-brand-400">Aviso de Privacidad</Link>{" "}
                      (v{VERSION_PRIVACIDAD}), y que recibirá un correo para crear su contraseña antes de ingresar.
                      {selectedRole?.nombre === "cliente" && " Al ingresar por primera vez, el cliente deberá aceptarlos personalmente."}
                    </span>
                  </label>
                )}

          </ModalIntranet>
        )}
      </AnimatePresence>
    </div>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-[10px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">{label}</label>
      {children}
    </div>
  );
}
