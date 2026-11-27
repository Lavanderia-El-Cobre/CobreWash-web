import type { Metadata } from "next";
import Footer from "@/components/layout/Footer";

/** Metadatos del seguimiento público; bloquea indexación para evitar indexar URLs con códigos de comanda o QR. */
export const metadata: Metadata = {
  title: "Seguimiento de pedido · Lavandería El Cobre",
  robots: { index: false, follow: false },
};

/** Layout de la vista pública de seguimiento (`/seguimiento`) con pie de página común. */
export default function SeguimientoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}<Footer /></>;
}
