/**
 * Consulta y, opcionalmente, purga los registros técnicos vencidos (>48 h) de
 * limitación de tasa (`LimiteContacto`) en Firebase Data Connect.
 *
 * Opera en modo vista previa por defecto y nunca toca pedidos, cuentas, fotografías
 * ni solicitudes de privacidad.
 *
 * Invocación:
 *   node scripts/privacidad-retencion.mjs --project=<id>           # Solo conteo
 *   node scripts/privacidad-retencion.mjs --project=<id> --apply   # Ejecuta la purga
 *
 * Variables de entorno requeridas:
 *   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`: debe coincidir con `--project=<id>`.
 *   - Credenciales ADC (`GOOGLE_APPLICATION_CREDENTIALS` o entorno Google Cloud).
 */
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getDataConnect } from "firebase-admin/data-connect";

// Exige coincidencia explícita entre flag y variable de entorno para evitar purgas en un proyecto equivocado.
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
if (!projectId || process.argv.find(a => a.startsWith("--project=")) !== `--project=${projectId}`) throw new Error("Indica explícitamente --project=<proyecto> y configura NEXT_PUBLIC_FIREBASE_PROJECT_ID.");
const app = initializeApp({ credential: applicationDefault(), projectId });
const db = getDataConnect({ location: "southamerica-west1", serviceId: "lavanderia-el-cobre", connector: "example" }, app);
// Ventana de retención técnica de 48 horas para contadores antiabuso.
const antesDe = new Date(Date.now() - 48 * 3_600_000).toISOString();
const r = await db.executeQuery("ContarLimitesContactoVencidos", { antesDe });
console.log(JSON.stringify({ proyecto: projectId, antesDe, vistaPrevia: !process.argv.includes("--apply"), resultado: r.data }));
if (process.argv.includes("--apply")) {
  const resultado = await db.executeMutation("PurgarLimitesContacto", { antesDe });
  console.log(JSON.stringify({ resultado: resultado.data }));
}
