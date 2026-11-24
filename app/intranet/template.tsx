"use client";

import { MotionConfig, motion } from "framer-motion";

/**
 * Next vuelve a montar la plantilla en cada cambio de sección, así todas las
 * páginas de la intranet entran con la misma animación. `reducedMotion="user"`
 * desactiva los desplazamientos (aquí, en los modales y en los bloques de cada
 * página) cuando el sistema pide reducir el movimiento.
 */
export default function IntranetTemplate({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      >
        {children}
      </motion.div>
    </MotionConfig>
  );
}
