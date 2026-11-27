"use client";

import { createContext, useContext, useEffect, useState } from "react";

/** Preferencia de tema admitida en la intranet (`system` sigue el esquema del sistema operativo). */
export type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "intranet-theme";

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveIsDark(theme: Theme): boolean {
  if (theme === "system") return window.matchMedia("(prefers-color-scheme: dark)").matches;
  return theme === "dark";
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", resolveIsDark(theme));
}

/**
 * Proveedor de tema claro/oscuro exclusivo para las vistas de intranet.
 * Persiste la preferencia en `localStorage` y sincroniza la clase `.dark` en `<html>`.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(
    () => (typeof window === "undefined" ? "system" : (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? "system")
  );
  const [systemDark, setSystemDark] = useState<boolean>(
    () => (typeof window !== "undefined" ? window.matchMedia("(prefers-color-scheme: dark)").matches : false)
  );

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // El ThemeProvider solo envuelve la intranet. Al desmontarse (salir al
  // landing) quitamos la clase `dark` del <html> para que el tema oscuro no
  // se filtre a las páginas públicas, que sí usan variantes `dark:`.
  useEffect(() => {
    return () => {
      document.documentElement.classList.remove("dark");
    };
  }, []);

  // Reacciona en vivo a cambios de tema del SO únicamente cuando el usuario mantiene `"system"`.
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemChange = () => {
      setSystemDark(media.matches);
      const current = (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? "system";
      if (current === "system") applyTheme("system");
    };
    media.addEventListener("change", handleSystemChange);
    return () => media.removeEventListener("change", handleSystemChange);
  }, []);

  const setTheme = (next: Theme) => {
    localStorage.setItem(STORAGE_KEY, next);
    setThemeState(next);
    applyTheme(next);
  };

  const resolvedTheme: "light" | "dark" = theme === "system" ? (systemDark ? "dark" : "light") : theme;

  return <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>{children}</ThemeContext.Provider>;
}

/**
 * Devuelve el tema activo de la intranet y su función actualizadora.
 * Debe utilizarse dentro de `ThemeProvider`.
 */
export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme debe usarse dentro de ThemeProvider");
  return ctx;
}
