/**
 * Evalúa localmente un archivo JSON con indicadores de un incidente de seguridad
 * y entrega orientación sobre la obligación de notificación conforme a la Ley 21.719.
 *
 * Invocación:
 *   node scripts/evaluar-incidente.mjs <indicadores.json>
 *
 * Variables de entorno requeridas: ninguna.
 * Valida la presencia y tipo de los indicadores booleanos y ternarios (`true | false | null`)
 * antes de delegar en `evaluarNotificacionIncidente`. No envía ni acredita notificaciones.
 */
import { readFile } from 'node:fs/promises';
import { evaluarNotificacionIncidente } from '../lib/privacidad/incidentes.ts';
const archivo = process.argv[2];
if (!archivo) throw new Error('Uso: node scripts/evaluar-incidente.mjs <indicadores.json>');
const entrada = JSON.parse(await readFile(archivo, 'utf8'));
// Indicadores estrictamente booleanos exigidos por las reglas de clasificación.
for (const clave of ['datosSensibles', 'menoresDe14', 'obligacionesEconomicasFinancierasBancariasComerciales']) if (typeof entrada[clave] !== 'boolean') throw new Error(`Indicador inválido: ${clave}`);
// Indicadores ternarios: `null` representa incertidumbre aún pendiente de verificación.
for (const clave of ['vulneracionDatosPersonales', 'riesgoRazonable']) if (![true, false, null].includes(entrada[clave])) throw new Error(`Indicador inválido: ${clave}`);
console.log(JSON.stringify({ orientacion: evaluarNotificacionIncidente(entrada), advertencia: 'Requiere actuación humana documentada. No envía ni acredita notificaciones. No existe una espera autorizada de 72 horas.' }, null, 2));
