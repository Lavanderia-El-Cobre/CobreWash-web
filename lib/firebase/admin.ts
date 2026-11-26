import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getDataConnect } from "firebase-admin/data-connect";
import { getStorage } from "firebase-admin/storage";

/**
 * Inicializa (o reutiliza) la app privilegiada de Firebase Admin (`"cobre-server"`)
 * y expone los clientes de Auth, Data Connect y Storage para uso exclusivo en servidor.
 *
 * Invariantes de seguridad:
 * - Solo importar desde Route Handlers o módulos de servidor (nunca exponer al cliente).
 * - Usa `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON` si está definida; en caso contrario cae a
 *   Application Default Credentials (ADC) del entorno de ejecución.
 */
export function serviciosAdmin() {
  // Se reutiliza la instancia nombrada para no chocar con inicializaciones repetidas en HMR/serverless.
  const existente = getApps().find(app => app.name === "cobre-server");
  const app = existente ?? initializeApp({
    credential: process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON
      ? cert(JSON.parse(process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON))
      : applicationDefault(),
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  }, "cobre-server");
  return {
    auth: getAuth(app),
    db: getDataConnect({ location: "southamerica-west1", serviceId: "lavanderia-el-cobre", connector: "example" }, app),
    // Conector separado para operaciones con listas de entrada que el SDK web no puede generar.
    dbProduccion: getDataConnect({ location: "southamerica-west1", serviceId: "lavanderia-el-cobre", connector: "produccion" }, app),
    bucket: getStorage(app).bucket(),
  };
}
