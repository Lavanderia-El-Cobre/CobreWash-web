import {
  LayoutDashboard,
  ClipboardList,
  Package,
  Archive,
  Truck,
  Users,
  Settings,
  BarChart3,
  Megaphone,
  Contact,
  ShieldAlert,
  BrainCircuit,
  PackageCheck,
  type LucideIcon,
} from "lucide-react";

/**
 * Roles del sistema (coinciden con Rol.nombre en la base de datos / Data Connect).
 * No existe un rol "Supervisor": sus funciones las cumple el Administrador.
 * "conductor" es el nombre anterior del rol de reparto y se trata igual que
 * "repartidor".
 */
export type Rol = "admin" | "recepcionista" | "operario" | "repartidor" | "conductor" | "cliente";

/** Elemento del menú lateral de la intranet. */
export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Cuando es `true`, solo marca el enlace activo si la ruta coincide exactamente (evita que `/intranet` quede siempre activo). */
  exact?: boolean;
  badge?: number;
}

/**
 * Navegación por rol. Cada rol ve ÚNICAMENTE las secciones a las que tiene
 * acceso según la matriz de accesos del proyecto (no secciones deshabilitadas).
 * Operario reutiliza rutas del admin (/seguimiento, /comunicacion) pero con
 * contenido y etiquetas propias — el contenido se adapta según el rol.
 */
const NAV_REPARTO: NavItem[] = [
  { href: "/intranet/reparto", label: "Mi vehículo", icon: Truck },
  { href: "/intranet/entregas", label: "Entregas", icon: PackageCheck },
  { href: "/intranet/comunicacion", label: "Avisos", icon: Megaphone },
  { href: "/intranet/configuracion", label: "Configuración", icon: Settings },
];

export const NAV_POR_ROL: Record<Exclude<Rol, "cliente">, NavItem[]> = {
  admin: [
    { href: "/intranet", label: "Dashboard", icon: LayoutDashboard, exact: true },
    { href: "/intranet/comandas", label: "Comandas", icon: ClipboardList },
    { href: "/intranet/seguimiento", label: "Seguimiento", icon: Package },
    { href: "/intranet/incidencias", label: "Incidencias", icon: ShieldAlert },
    { href: "/intranet/inventario", label: "Inventario", icon: Archive },
    { href: "/intranet/vehiculos", label: "Vehículos", icon: Truck },
    { href: "/intranet/reportes", label: "Reportes", icon: BarChart3 },
    { href: "/intranet/ia", label: "Módulo IA", icon: BrainCircuit },
    { href: "/intranet/comunicacion", label: "Comunicación", icon: Megaphone },
    { href: "/intranet/usuarios", label: "Usuarios", icon: Users },
    { href: "/intranet/solicitudes", label: "Cotizaciones", icon: Contact },
    { href: "/intranet/privacidad", label: "Datos personales", icon: ShieldAlert },
    { href: "/intranet/configuracion", label: "Configuración", icon: Settings },
  ],
  recepcionista: [
    { href: "/intranet/comandas", label: "Comandas", icon: ClipboardList },
    { href: "/intranet/seguimiento", label: "Seguimiento", icon: Package },
    { href: "/intranet/incidencias", label: "Incidencias", icon: ShieldAlert },
    { href: "/intranet/clientes", label: "Clientes", icon: Contact },
    { href: "/intranet/solicitudes", label: "Cotizaciones", icon: Contact },
    { href: "/intranet/comunicacion", label: "Avisos", icon: Megaphone },
    { href: "/intranet/configuracion", label: "Configuración", icon: Settings },
  ],
  operario: [
    { href: "/intranet/seguimiento", label: "Producción", icon: Package },
    { href: "/intranet/comunicacion", label: "Avisos", icon: Megaphone },
    { href: "/intranet/configuracion", label: "Configuración", icon: Settings },
  ],
  repartidor: NAV_REPARTO,
  conductor: NAV_REPARTO,
};

/**
 * Qué roles pueden abrir cada ruta de la intranet. Se usa para el guardado por
 * página (defensa en profundidad, por si alguien escribe la URL a mano).
 */
export const ACCESO_POR_RUTA: Record<string, Rol[]> = {
  "/intranet": ["admin"],
  "/intranet/comandas": ["admin", "recepcionista"],
  "/intranet/clientes": ["admin", "recepcionista"],
  "/intranet/solicitudes": ["admin", "recepcionista"],
  "/intranet/privacidad": ["admin"],
  "/intranet/seguimiento": ["admin", "recepcionista", "operario"],
  "/intranet/incidencias": ["admin", "recepcionista"],
  "/intranet/inventario": ["admin"],
  "/intranet/vehiculos": ["admin"],
  "/intranet/reparto": ["repartidor", "conductor"],
  "/intranet/entregas": ["admin", "repartidor", "conductor"],
  "/intranet/reportes": ["admin"],
  "/intranet/ia": ["admin"],
  "/intranet/comunicacion": ["admin", "operario", "recepcionista", "repartidor", "conductor"],
  "/intranet/usuarios": ["admin"],
  "/intranet/configuracion": ["admin", "recepcionista", "operario", "repartidor", "conductor"],
};

/** Vista a la que se redirige a cada rol tras iniciar sesión. */
export const LANDING_POR_ROL: Record<Rol, string> = {
  admin: "/intranet",
  recepcionista: "/intranet/comandas",
  operario: "/intranet/seguimiento",
  repartidor: "/intranet/reparto",
  conductor: "/intranet/reparto",
  cliente: "/cuenta",
};

/** Roles que usan el shell interno (sidebar oscuro) de la intranet. */
export const ROLES_INTERNOS: Rol[] = ["admin", "recepcionista", "operario", "repartidor", "conductor"];

/** Indica si el rol pertenece al personal interno de la intranet (excluye clientes y valores indefinidos). */
export function esRolInterno(rol: string | undefined): boolean {
  return !!rol && ROLES_INTERNOS.includes(rol as Rol);
}

/**
 * Indica si un rol tiene permiso para acceder a `pathname` según `ACCESO_POR_RUTA`.
 * Usa la regla de prefijo más específica para soportar subrutas y deniega por defecto
 * si no hay rol o si la ruta no está declarada.
 */
export function rutaPermitida(rol: string | undefined, pathname: string): boolean {
  if (!rol) return false;
  // Coincidencia por prefijo para rutas anidadas.
  const entry = Object.entries(ACCESO_POR_RUTA)
    .filter(([ruta]) => pathname === ruta || pathname.startsWith(ruta + "/"))
    // La ruta más específica (más larga) tiene prioridad sobre `/intranet`.
    .sort((a, b) => b[0].length - a[0].length)[0];
  if (!entry) return false;
  return entry[1].includes(rol as Rol);
}
