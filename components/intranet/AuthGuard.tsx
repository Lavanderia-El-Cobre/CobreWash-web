"use client";

import { createContext, useContext, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useUsuarioActual, type UsuarioActual } from "@/lib/firebase/useUsuarioActual";
import { esRolInterno } from "@/lib/roles";

const UsuarioActualContext = createContext<UsuarioActual | null>(null);

/** Obtiene el perfil autenticado provisto por `AuthGuard` dentro de la intranet. */
export function useUsuarioActualContext() {
  return useContext(UsuarioActualContext);
}

/**
 * Guarda de sesión para todo el shell de la intranet.
 * Verifica autenticación y pertenencia a un rol interno antes de renderizar `children`
 * para evitar destellos de vistas protegidas, y expone al usuario vía contexto.
 */
export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { usuario, loading } = useUsuarioActual();

  useEffect(() => {
    if (loading) return;
    if (!usuario) {
      router.push("/?login=1");
      return;
    }
    // Solo los roles internos (admin, recepcionista, operario, reparto) usan el shell
    // de la intranet. El cliente tiene su propio dashboard en /cuenta.
    if (!esRolInterno(usuario.rol.nombre)) {
      router.push("/cuenta");
    }
  }, [loading, usuario, router]);

  if (loading || !usuario || !esRolInterno(usuario.rol.nombre)) {
    return (
      <div className="flex h-screen items-center justify-center bg-white dark:bg-stone-950">
        <Loader2 className="w-6 h-6 text-brand-500 animate-spin" />
      </div>
    );
  }

  return <UsuarioActualContext.Provider value={usuario}>{children}</UsuarioActualContext.Provider>;
}
