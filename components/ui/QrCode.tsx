"use client";

import { QRCodeSVG } from "qrcode.react";

/**
 * Renderiza un código QR vectorial de alto contraste sobre fondo blanco.
 * Fija corrección de errores nivel M sin escalado automático (`boostLevel={false}`) y zona silenciosa
 * de 4 módulos (`marginSize={4}`) para mantener lectura confiable en pantalla e impresión.
 */
export default function QrCode({ value, size = 160, className = "", title = "Escanea para seguir tu pedido" }: {
  value: string;
  size?: number;
  className?: string;
  title?: string;
}) {
  return (
    <div className={`inline-block bg-white ${className}`}>
      <QRCodeSVG value={value} size={size} level="M" boostLevel={false} marginSize={4}
        fgColor="#000000" bgColor="#ffffff" title={title} />
    </div>
  );
}
