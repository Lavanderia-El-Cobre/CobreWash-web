/**
 * Script inline inyectado con `strategy="beforeInteractive"` en el layout raíz
 * para aplicar la clase `dark` antes de la hidratación y evitar el parpadeo de
 * tema (FOUC).
 *
 * Solo actúa bajo `/intranet` para no alterar las páginas públicas (que tienen
 * tema fijo) y envuelve el acceso a `localStorage` en `try/catch` para tolerar
 * navegadores con almacenamiento restringido o modo privado estricto.
 */
export const INICIALIZAR_TEMA_INTRANET = `
(function () {
  if (window.location.pathname !== "/intranet" && !window.location.pathname.startsWith("/intranet/")) return;
  try {
    var theme = localStorage.getItem("intranet-theme") || "system";
    var isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", isDark);
  } catch (e) {}
})();
`;
