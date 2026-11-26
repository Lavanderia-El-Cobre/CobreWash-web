import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDataConnect } from "firebase/data-connect";
import { getStorage } from "firebase/storage";
import { connectorConfig } from "@/src/dataconnect-generated";

/** Configuración pública del proyecto Firebase inyectada en build mediante variables `NEXT_PUBLIC_*`. */
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

/** Instancia principal de Firebase en cliente (reutiliza la existente para evitar errores en HMR/SSR). */
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
/** Servicio de autenticación del SDK web asociado a la app principal. */
export const auth = getAuth(app);
/** Cliente de Data Connect configurado con el conector generado del proyecto. */
export const dataConnect = getDataConnect(app, connectorConfig);
/** Cliente de Firebase Storage para subir y descargar archivos autorizados en cliente. */
export const storage = getStorage(app);
