import Link from "next/link";
import { AlertCircle, Store, FileText, Package, LockKeyhole, Scale, Building2, ShieldCheck, HelpCircle, UserRoundCheck, Ban, RefreshCw } from "lucide-react";
import PaginaLegal, { SeccionLegal } from "@/components/privacidad/PaginaLegal";
import { configuracionLegal } from "@/lib/privacidad/configuracion";
import { VERSION_TERMINOS } from "@/lib/privacidad/modelo";

export const dynamic = "force-dynamic";
export const metadata = { title: "Términos y Condiciones | Lavandería El Cobre" };

export default function TerminosPage() {
  const c = configuracionLegal();
  const razonSocial = c.razonSocial || "Lavandería El Cobre SpA";
  const rut = c.rut || "RUT pendiente de publicación";
  const domicilio = c.domicilio || "Avenida Balmaceda 1276 - 1364, Calama, Región de Antofagasta, Chile";
  const representante = c.representante || "Representación legal pendiente de publicación";
  const email = c.email || "ventas@lavanderiaelcobrespa.com";

  return (
    <PaginaLegal
      titulo="Términos y Condiciones del Portal y del Servicio"
      descripcion="Condiciones de uso del portal web, de las cuentas de cliente y de la prestación de nuestros servicios de lavandería, junto con tus derechos como consumidor."
      actual="/terminos"
      detalle={`Versión ${VERSION_TERMINOS} · Lavandería El Cobre`}
    >
      {!c.publicada && (
        <p role="status" className="flex items-start gap-3 rounded-2xl border border-copper-200 bg-copper-50/80 p-5 text-sm leading-relaxed text-copper-900">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <span>
            <strong>Documento en revisión.</strong> La aceptación de estas condiciones y la creación de nuevas cuentas se habilitarán cuando se publiquen junto con el aviso de privacidad aprobado.
          </span>
        </p>
      )}

      <SeccionLegal titulo="1. Identificación del Proveedor y Aceptación" icon={Building2}>
        <p>
          Este portal es operado por <strong>{razonSocial}</strong>, RUT <strong>{rut}</strong>, con domicilio en <strong>{domicilio}</strong>, representada legalmente por <strong>{representante}</strong> (en adelante, &quot;Lavandería El Cobre&quot;). Correo de atención: <a href={`mailto:${email}`}>{email}</a>.
        </p>
        <p>
          Puedes navegar por el sitio, consultar el seguimiento de una comanda y enviar cotizaciones sin crear una cuenta. Para crear una cuenta de cliente debes leer y aceptar expresamente estos Términos y Condiciones marcando la casilla correspondiente. La aceptación de los términos es independiente de la autorización para el tratamiento de tus datos personales, que se rige por el <Link href="/privacidad">Aviso de Privacidad</Link> y se otorga por separado.
        </p>
        <p className="text-xs text-stone-500">
          Conservamos la versión aceptada y la fecha de aceptación asociadas a tu cuenta. Puedes consultar estos términos en cualquier momento en esta página.
        </p>
      </SeccionLegal>

      <SeccionLegal titulo="2. Funcionalidades del Portal" icon={Store}>
        <p>El portal permite:</p>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-stone-600">
          <li>Conocer nuestros servicios de lavado, secado, planchado, lavado en seco y lavado industrial para particulares, hoteles y empresas.</li>
          <li>Enviar solicitudes de cotización y consultas.</li>
          <li>Consultar el estado de una comanda mediante su número o código QR.</li>
          <li>Acceder, con una cuenta de cliente, al historial y detalle de tus pedidos.</li>
          <li>Presentar solicitudes sobre tus datos personales, tengas o no una cuenta.</li>
        </ul>
        <p className="rounded-xl border border-blue-200/60 bg-blue-50/50 p-4 text-xs leading-relaxed text-blue-900">
          <strong>El portal no procesa pagos.</strong> La contratación, el pago y la emisión de boletas o facturas se realizan en nuestra recepción o por los medios acordados directamente con el cliente.
        </p>
      </SeccionLegal>

      <SeccionLegal titulo="3. Cuentas de Cliente" icon={UserRoundCheck}>
        <ul className="list-disc space-y-2 pl-5 text-sm text-stone-600">
          <li>
            <strong>Registro en el sitio:</strong> la cuenta se termina de crear solo después de que verifiques tu correo electrónico mediante el enlace que te enviamos. Mientras no lo verifiques, la cuenta no permite ingresar ni consultar pedidos.
          </li>
          <li>
            <strong>Cuentas creadas en recepción:</strong> si entregas tu correo al registrar un pedido en nuestra recepción, crearemos una cuenta asociada a tu ficha de cliente y te enviaremos un enlace para que definas tu contraseña. Al ingresar por primera vez deberás aceptar personalmente estos términos y el aviso de privacidad. Si no deseas usar la cuenta, basta con no activarla o solicitar su eliminación.
          </li>
          <li>
            <strong>Datos verdaderos:</strong> te comprometes a entregar información veraz y actualizada. El RUT identifica tu ficha de cliente; tus pedidos solo se asocian a tu cuenta cuando el correo verificado coincide con el registrado en recepción.
          </li>
          <li>
            <strong>Una cuenta por persona:</strong> la cuenta es personal e intransferible. Las empresas y hoteles pueden designar a una persona responsable de su cuenta.
          </li>
          <li>
            <strong>Cierre de la cuenta:</strong> puedes solicitar el cierre de tu cuenta o la supresión de tus datos en cualquier momento a través del <Link href="/privacidad/derechos">canal de derechos</Link>, sin perjuicio de los registros que debamos conservar por obligación legal o tributaria.
          </li>
        </ul>
      </SeccionLegal>

      <SeccionLegal titulo="4. Seguridad de la Cuenta" icon={LockKeyhole}>
        <p>
          Eres responsable de mantener la confidencialidad de tu contraseña y de la actividad realizada desde tu cuenta. La contraseña debe tener al menos 8 caracteres e incluir letras y números. No la compartas con terceros y avísanos de inmediato a <a href={`mailto:${email}`}>{email}</a> si sospechas un acceso no autorizado.
        </p>
        <p>
          Podemos suspender temporalmente una cuenta cuando existan indicios razonables de uso no autorizado o de vulneración de su seguridad, informándote del motivo por los datos de contacto registrados.
        </p>
      </SeccionLegal>

      <SeccionLegal titulo="5. Uso Aceptable" icon={Ban}>
        <p>Al usar el portal te comprometes a no:</p>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-stone-600">
          <li>Acceder o intentar acceder a cuentas, comandas o datos de otras personas.</li>
          <li>Ingresar datos de terceros sin su autorización, ni información sensible en los campos de texto libre.</li>
          <li>Enviar solicitudes automatizadas, masivas o destinadas a afectar la disponibilidad del servicio.</li>
          <li>Usar el portal con fines ilícitos o contrarios a estos términos.</li>
        </ul>
      </SeccionLegal>

      <SeccionLegal titulo="6. Cotizaciones y Contratación del Servicio" icon={FileText}>
        <p>
          Una solicitud de cotización enviada por el sitio es gratuita y no constituye una reserva ni un contrato. La propuesta que te enviemos indicará el servicio, el precio con IVA incluido, los plazos estimados y las condiciones de pago y entrega.
        </p>
        <p>
          El servicio se entiende contratado cuando aceptas la cotización o el precio informado y entregas las prendas en nuestra recepción o a nuestro personal de retiro. En ese momento emitimos una comanda con el detalle de las prendas recibidas.
        </p>
      </SeccionLegal>

      <SeccionLegal titulo="7. Recepción y Cuidado de las Prendas" icon={Package}>
        <p>Tratamos cada prenda con la diligencia debida, según su tipo de tejido y las instrucciones de su etiqueta. Para ello te pedimos:</p>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-stone-600">
          <li>Revisar los bolsillos antes de la entrega. Los objetos encontrados se guardan en recepción y se informan al cliente; no respondemos por objetos olvidados que se deterioren durante el proceso.</li>
          <li>Informar en la recepción si una prenda requiere lavado en seco, puede desteñir o presenta daños, roturas o desgaste previos. Dejamos constancia de estas observaciones en la comanda.</li>
          <li>Las prendas sin etiqueta de cuidado se procesan con el tratamiento estándar adecuado a su tipo de tejido.</li>
        </ul>
      </SeccionLegal>

      <SeccionLegal titulo="8. Comandas, Seguimiento y Retiro" icon={ShieldCheck}>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-stone-600">
          <li><strong>Comanda:</strong> contiene el número de pedido, el detalle de prendas y un código QR de seguimiento. Consérvala: es el comprobante para retirar tus prendas.</li>
          <li><strong>Seguimiento:</strong> las etapas que muestra el portal (recepción, lavado, secado, planchado y entrega) son informativas y las fechas de entrega son estimadas.</li>
          <li><strong>Plazo de retiro:</strong> te avisaremos cuando tus prendas estén listas. Si no las retiras dentro de 30 días corridos desde ese aviso, podremos cobrar el bodegaje según la tarifa informada al momento de la recepción.</li>
        </ul>
      </SeccionLegal>

      <SeccionLegal titulo="9. Derechos del Consumidor (Ley N° 19.496)" icon={Scale}>
        <p>
          Estos términos no limitan los derechos irrenunciables que te reconoce la <strong>Ley N° 19.496 sobre Protección de los Derechos de los Consumidores</strong>. En particular, tienes derecho a:
        </p>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-stone-600">
          <li>Recibir información veraz y oportuna sobre el servicio, su precio y sus condiciones.</li>
          <li>Que el servicio se preste conforme a lo convenido; si no es así, puedes exigir que se realice nuevamente sin costo o la devolución de lo pagado.</li>
          <li>Ser indemnizado de los daños o pérdidas de prendas bajo nuestra custodia que sean imputables a Lavandería El Cobre.</li>
        </ul>
        <p className="text-xs text-stone-500">
          Puedes presentar reclamos en nuestra recepción o en <strong>{email}</strong>, sin perjuicio de tu derecho a acudir al Servicio Nacional del Consumidor (SERNAC) o al Juzgado de Policía Local competente.
        </p>
      </SeccionLegal>

      <SeccionLegal titulo="10. Comunicaciones Electrónicas" icon={HelpCircle}>
        <p>
          Al crear una cuenta recibirás correos necesarios para su funcionamiento: verificación del correo, activación, recuperación de contraseña y avisos sobre tus pedidos. No enviamos publicidad sin tu autorización previa y expresa.
        </p>
      </SeccionLegal>

      <SeccionLegal titulo="11. Datos Personales" icon={ShieldCheck}>
        <p>
          El tratamiento de tus datos personales se rige por la Ley N° 19.628, en su texto modificado por la Ley N° 21.719, y por nuestro <Link href="/privacidad">Aviso de Privacidad</Link>. Puedes ejercer gratuitamente tus derechos de acceso, rectificación, supresión, oposición, bloqueo, portabilidad y revocación en el <Link href="/privacidad/derechos">canal de derechos</Link>.
        </p>
      </SeccionLegal>

      <SeccionLegal titulo="12. Modificaciones de estos Términos" icon={RefreshCw}>
        <p>
          Podemos actualizar estos términos para reflejar cambios en el servicio o en la normativa. Cada versión indica su fecha de vigencia. Si la modificación afecta tus condiciones como titular de una cuenta, te pediremos aceptar la nueva versión al ingresar; mientras no la aceptes, podrás seguir consultando el seguimiento público de tus comandas y solicitar el cierre de tu cuenta.
        </p>
      </SeccionLegal>

      <SeccionLegal titulo="13. Legislación Aplicable y Controversias" icon={Building2}>
        <p>
          Estos términos se rigen por las leyes de la República de Chile. Las controversias se someterán a los tribunales o al Juzgado de Policía Local competente de Calama, sin perjuicio del derecho del consumidor a demandar ante el tribunal de su domicilio conforme al artículo 50 A de la Ley N° 19.496.
        </p>
      </SeccionLegal>

      <div className="flex flex-wrap items-center gap-4 pt-4">
        <Link
          className="inline-flex min-h-11 items-center rounded-xl bg-gradient-brand px-6 py-3 text-sm font-bold text-white shadow-premium transition-shadow hover:shadow-lg"
          href="/privacidad"
        >
          Consultar Aviso de Privacidad
        </Link>
        <Link
          className="inline-flex min-h-11 items-center rounded-xl border border-stone-300 bg-white px-6 py-3 text-sm font-semibold text-stone-700 transition-colors hover:bg-stone-50"
          href="/privacidad/derechos"
        >
          Canal de derechos sobre tus datos
        </Link>
      </div>
    </PaginaLegal>
  );
}
