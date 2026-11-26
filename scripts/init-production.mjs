/**
 * Inicializa el catálogo base de las 5 etapas de producción en Firebase Data Connect
 * (Recepción, Lavado, Secado, Planchado y Entrega) sin sobrescribir configuraciones existentes.
 *
 * Invocación:
 *   node scripts/init-production.mjs           # Solo diagnóstico (no escribe)
 *   node scripts/init-production.mjs --apply   # Inserta las cinco etapas si el catálogo está vacío
 *
 * Variables de entorno requeridas:
 *   - `GCLOUD_PROJECT`: ID del proyecto Firebase/Google Cloud.
 *   - Credenciales administrativas (ADC / `GOOGLE_APPLICATION_CREDENTIALS`).
 */
import { initializeApp } from "firebase-admin/app";
import { getDataConnect } from "firebase-admin/data-connect";
import { pathToFileURL } from "node:url";

/**
 * Verifica el catálogo `EtapaProduccion` y crea las cinco etapas base si está vacío.
 * Falla sin modificar datos si detecta un catálogo parcial o con orden inconsistente.
 *
 * @param dc - Instancia administrativa de Firebase Data Connect.
 * @param aplicar - Si es `true`, ejecuta la inserción; en caso contrario solo informa.
 */
export async function inicializarEtapas(dc, aplicar = false) {
  const { data } = await dc.executeGraphqlRead("query { etapaProduccions(orderBy:[{orden:ASC}]) { id nombre orden } }");
  const existentes = data.etapaProduccions;
  if (existentes.length) {
    if (existentes.length !== 5 || existentes.some((e, i) => e.orden !== i + 1)) {
      throw new Error("El catálogo existente requiere revisión; no se modificó.");
    }
    console.log("Las cinco etapas ya existen; no se sobrescribió su configuración.");
    return;
  }
  const etapas = ["Recepción", "Lavado", "Secado", "Planchado", "Entrega"].map((nombre, i) => ({
    id: "00000000-0000-4000-8000-00000000002" + i, nombre, orden: i + 1,
    tiempoEstimadoMin: [15, 90, 60, 60, 1440][i],
  }));
  console.log("Catálogo inicial: " + etapas.map((e) => e.nombre).join(" → "));
  if (!aplicar) { console.log("Solo diagnóstico. Usar --apply para crear las cinco etapas."); return; }
  // insertMany es atómico; no usar upsert para no sobrescribir ajustes del admin.
  await dc.insertMany("EtapaProduccion", etapas);
  console.log("Cinco etapas creadas. No se modificaron comandas.");
}

// Solo se ejecuta como CLI cuando se invoca directamente, permitiendo importar `inicializarEtapas` en pruebas.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const projectId = process.env.GCLOUD_PROJECT;
  if (!projectId) throw new Error("Define GCLOUD_PROJECT y credenciales administrativas.");
  const app = initializeApp({ projectId });
  const dc = getDataConnect({ serviceId: "lavanderia-el-cobre", location: "southamerica-west1" }, app);
  await inicializarEtapas(dc, process.argv.includes("--apply"));
}
