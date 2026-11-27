import { auth } from "@/lib/firebase/client";

/**
 * Construye la cabecera `Authorization` con el ID token vigente del usuario
 * autenticado para consumir los endpoints protegidos de evidencias.
 */
export async function cabeceraEvidencia() {
  const user = auth.currentUser;
  if (!user) throw new Error("Inicia sesión para acceder a la evidencia.");
  return { Authorization: `Bearer ${await user.getIdToken()}` };
}

/**
 * Convierte una ruta de Storage de inspección en su endpoint autenticado de Next.js.
 * Devuelve `null` si la ruta no coincide con el patrón esperado (evita path traversal).
 *
 * @param ruta - Ruta persistida en base de datos (`vehiculos/inspecciones/{id}/{foto}.jpg`).
 */
export function endpointEvidencia(ruta: string) {
  const match = ruta.match(/^vehiculos\/inspecciones\/([\da-f-]{36})\/([\da-f-]{36})\.jpg$/i);
  return match ? `/api/inspecciones/${match[1]}/fotos/${match[2]}` : null;
}

/**
 * Normaliza una imagen seleccionada en el navegador a JPEG (máx. 2000 px por lado,
 * calidad 0.85 y tope de 3 MB). Re-dibujar en `<canvas>` también elimina metadatos
 * EXIF (como ubicación GPS) y asegura compatibilidad con el validador JPEG del servidor.
 *
 * @param file - Archivo de imagen elegido por el usuario (máx. 10 MB de entrada).
 */
export async function prepararJpeg(file: File) {
  if (file.size > 10 * 1024 * 1024) throw new Error("La fotografía supera los 10 MB. Selecciona una imagen más pequeña.");
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("No se pudo preparar la fotografía.")), "image/jpeg", 0.85));
    if (blob.size > 3 * 1024 * 1024) throw new Error("La fotografía procesada supera los 3 MB.");
    return blob;
  } finally { bitmap.close(); }
}

/**
 * Procesa y sube una fotografía de inspección vía `PUT` idempotente usando `foto.id`.
 *
 * @param inspeccionId - UUID de la inspección ya confirmada.
 * @param foto - Metadatos y archivo local de la fotografía.
 * @param orden - Posición ordinal (base 1) dentro de la inspección.
 * @returns Ruta de Storage confirmada por el servidor.
 */
export async function subirEvidencia(inspeccionId: string, foto: { id: string; archivo?: File; descripcion?: string }, orden: number) {
  if (!foto.archivo) throw new Error("Falta el archivo original. Vuelve a seleccionar la fotografía.");
  const body = await prepararJpeg(foto.archivo);
  const params = new URLSearchParams({ orden: String(orden), descripcion: foto.descripcion ?? "" });
  const response = await fetch(`/api/inspecciones/${inspeccionId}/fotos/${foto.id}?${params}`, {
    method: "PUT", headers: { ...await cabeceraEvidencia(), "Content-Type": "image/jpeg" }, body,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "No se pudo guardar la fotografía.");
  return data.rutaStorage as string;
}
