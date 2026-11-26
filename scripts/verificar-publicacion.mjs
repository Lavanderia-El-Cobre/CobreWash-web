/**
 * Comprobación de humo anónima y de solo lectura sobre un despliegue web publicado.
 *
 * Verifica que las rutas públicas y `/api/privacidad/configuracion` respondan HTTP 200,
 * que el endpoint protegido de fotos de inspección rechace tráfico sin sesión con 401
 * y advierte si el aviso legal aún figura pendiente de publicación.
 *
 * Invocación:
 *   node scripts/verificar-publicacion.mjs [url-origen]
 *   (por defecto `https://www.lavanderiaelcobrespa.com`; exige HTTPS salvo localhost/127.0.0.1)
 *
 * Variables de entorno requeridas: ninguna.
 */
const origen = new URL(process.argv[2] || 'https://www.lavanderiaelcobrespa.com');
if (origen.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(origen.hostname))
  throw new Error('La publicación debe usar HTTPS.');
const rutas = [
  ['/', 200], ['/seguimiento', 200], ['/privacidad', 200], ['/privacidad/derechos', 200], ['/terminos', 200],
  ['/api/privacidad/configuracion', 200],
  // IDs ficticios: sin sesión debe cortar antes de consultar Storage/Data Connect con 401.
  ['/api/inspecciones/00000000-0000-4000-8000-000000000099/fotos/00000000-0000-4000-8000-000000000098', 401],
];
let fallos = 0;
for (const [ruta, esperado] of rutas) {
  try {
    // `redirect: 'manual'` evita enmascarar redirecciones inesperadas como un 200 válido.
    const respuesta = await fetch(new URL(ruta, origen), { signal: AbortSignal.timeout(20000), redirect: 'manual' });
    const correcto = respuesta.status === esperado;
    console.log(`${correcto ? 'OK' : 'FALTA'} ${ruta}: ${respuesta.status} (esperado ${esperado})`);
    if (!correcto) fallos++;
    if (ruta === '/api/privacidad/configuracion' && correcto) {
      const config = await respuesta.json();
      if (!config.publicada) console.log('PENDIENTE: completar y aprobar el aviso legal antes de habilitar registros y cotizaciones.');
    }
  } catch { fallos++; console.log(`FALTA ${ruta}: no se pudo comprobar la respuesta.`); }
}
console.log('La comprobación anónima no valida las credenciales del servidor ni una carga real de fotografías.');
process.exitCode = fallos ? 1 : 0;
