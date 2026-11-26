import type { Metadata } from "next";
import Footer from "@/components/layout/Footer";
/** Metadatos del portal privado de clientes; bloquea indexación por contener datos personales. */
export const metadata: Metadata = { title: "Mis pedidos | Lavandería El Cobre", robots: { index: false, follow: false } };
/** Layout del área autenticada de clientes (`/cuenta`) con pie de página común. */
export default function CuentaLayout({ children }: { children: React.ReactNode }) {
  return <>{children}<Footer /></>;
}
