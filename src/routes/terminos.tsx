import { createFileRoute } from "@tanstack/react-router";
import { seo } from "@/lib/seo";
import { useSiteContent } from "@/hooks/useSiteContent";

export const Route = createFileRoute("/terminos")({
  head: () =>
    seo({
      title: "Términos y Condiciones — Kasea Store",
      description: "Términos y condiciones de compra de Kasea Store.",
      path: "/terminos",
    }),
  component: TerminosPage,
});

// Datos legales editables desde el panel (/admin/contenido). La fecha de
// "última actualización" se calcula sola con la última edición legal.
function legalDate(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  try {
    return d.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return "";
  }
}

function TerminosPage() {
  const c = useSiteContent();
  const val = (k: string, fallback: string) => (c[k]?.trim() ? c[k] : fallback);

  const negocio = val("legal_business_name", "[Razón social — pendiente de completar]");
  const nif = val("legal_nif", "[NIF/DNI]");
  const direccion = val("legal_address", "[Dirección]");
  const email = val("legal_email", "[email de contacto]");
  const envios = val("legal_shipping_company", "[empresa de envíos]");
  const plazo = val("legal_delivery_days", "[plazo]");

  return (
    <div className="container-luxe max-w-3xl py-16 md:py-24">
      <h1 className="font-display text-4xl md:text-5xl">Términos y Condiciones</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Última actualización: {legalDate(c.__legal_updated_at)}
      </p>

      <div className="mt-10 space-y-8 text-sm leading-relaxed text-foreground/85">
        <section>
          <h2 className="mb-2 font-display text-xl text-foreground">1. Identificación del titular</h2>
          <p>
            Este sitio web es titularidad de <strong>{negocio}</strong>, con NIF/DNI{" "}
            <strong>{nif}</strong>, domicilio en <strong>{direccion}</strong> y correo de contacto{" "}
            <strong>{email}</strong> (en adelante, "Kasea").
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-display text-xl text-foreground">2. Objeto</h2>
          <p>
            Estas condiciones regulan el uso de la web y la compra de productos (fundas para iPhone,
            incluidas fundas personalizadas) a través de la tienda online de Kasea.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-display text-xl text-foreground">3. Productos y precios</h2>
          <p>
            Los precios se muestran en euros (€) e incluyen el IVA aplicable. Kasea puede modificar los
            precios en cualquier momento; se aplicará el vigente en el momento de realizar el pedido.
            Las imágenes son orientativas.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-display text-xl text-foreground">4. Proceso de compra y pago</h2>
          <p>
            El pago con tarjeta se procesa de forma segura a través de <strong>Stripe</strong>; Kasea no
            almacena los datos de la tarjeta. En los pedidos con recogida en tienda también puede
            ofrecerse el pago en efectivo en el momento de la recogida. El pedido se considera aceptado
            cuando se confirma el pago (o la reserva, en el caso del pago en efectivo).
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-display text-xl text-foreground">5. Envíos y recogida</h2>
          <p>
            Los envíos se realizan a través de <strong>{envios}</strong> a la dirección indicada. Los
            gastos y el umbral de envío gratuito se muestran en el proceso de compra. El plazo estimado
            de entrega es de <strong>{plazo}</strong> días hábiles. También es posible la recogida en
            tienda cuando el cliente lo selecciona.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-display text-xl text-foreground">6. Derecho de desistimiento</h2>
          <p>
            Como consumidor, dispones de 14 días naturales desde la recepción para desistir de la compra
            sin justificación, conforme a la normativa española y europea. <strong>Excepción:</strong> las
            fundas personalizadas, al fabricarse según tus especificaciones, están excluidas del derecho
            de desistimiento. Para ejercerlo, escribe a <strong>{email}</strong>.
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            <li>El producto debe devolverse nuevo, sin usar y en su embalaje original.</li>
            <li>
              La devolución se envía por correo o mensajería. Los gastos de envío de la devolución corren a
              cargo del cliente, salvo que el producto sea defectuoso o erróneo.
            </li>
            <li>No se realizan cambios de diseño ni de modelo: si lo deseas, puedes devolver el producto y hacer un nuevo pedido.</li>
            <li>
              Te reembolsaremos el importe en un plazo máximo de 14 días desde que recibamos tu solicitud,
              aunque podremos esperar a recibir el producto devuelto.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 font-display text-xl text-foreground">7. Devoluciones y garantía</h2>
          <p>
            Los productos cuentan con la garantía legal aplicable. Si recibes un producto defectuoso o
            erróneo, contáctanos en <strong>{email}</strong> para gestionar la sustitución o el reembolso.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-display text-xl text-foreground">8. Legislación y resolución de conflictos</h2>
          <p>
            Estas condiciones se rigen por la legislación española. Puedes acudir a la plataforma de
            resolución de litigios en línea de la UE:{" "}
            <a
              href="https://ec.europa.eu/consumers/odr"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              ec.europa.eu/consumers/odr
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
