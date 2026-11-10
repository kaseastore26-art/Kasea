import { createFileRoute } from "@tanstack/react-router";
import { seo } from "@/lib/seo";
import { useSiteContent } from "@/hooks/useSiteContent";

export const Route = createFileRoute("/privacidad")({
  head: () =>
    seo({
      title: "Política de Privacidad — Kasea Store",
      description: "Cómo Kasea Store trata tus datos personales y usa cookies.",
      path: "/privacidad",
    }),
  component: PrivacidadPage,
});

function legalDate(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  try {
    return d.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return "";
  }
}

function PrivacidadPage() {
  const c = useSiteContent();
  const val = (k: string, fallback: string) => (c[k]?.trim() ? c[k] : fallback);

  const negocio = val("legal_business_name", "[Razón social — pendiente de completar]");
  const nif = val("legal_nif", "[NIF/DNI]");
  const direccion = val("legal_address", "[Dirección]");
  const email = val("legal_email", "[email de contacto]");
  const envios = val("legal_shipping_company", "[empresa de envíos]");

  return (
    <div className="container-luxe max-w-3xl py-16 md:py-24">
      <h1 className="font-display text-4xl md:text-5xl">Política de Privacidad</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Última actualización: {legalDate(c.__legal_updated_at)}
      </p>

      <div className="mt-10 space-y-8 text-sm leading-relaxed text-foreground/85">
        <section>
          <h2 className="mb-2 font-display text-xl text-foreground">1. Responsable del tratamiento</h2>
          <p>
            <strong>{negocio}</strong>, NIF/DNI <strong>{nif}</strong>, domicilio en{" "}
            <strong>{direccion}</strong>. Contacto para privacidad: <strong>{email}</strong>.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-display text-xl text-foreground">2. Qué datos tratamos</h2>
          <p>
            Para gestionar tus pedidos: nombre, correo electrónico, teléfono y, en envíos a domicilio,
            la dirección de entrega. Para analítica web (solo si aceptas cookies): datos de navegación
            de forma agregada.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-display text-xl text-foreground">3. Finalidad y base legal</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Gestionar la compra y su entrega — ejecución del contrato.</li>
            <li>Enviarte correos sobre el estado de tu pedido — ejecución del contrato.</li>
            <li>
              Si empiezas un pedido y no terminas el pago, enviarte un único correo recordándotelo — interés
              legítimo. Puedes darte de baja desde el enlace "No quiero más avisos" de ese correo.
            </li>
            <li>Analítica web (Google Analytics) — tu consentimiento.</li>
            <li>Obligaciones fiscales y contables — obligación legal.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 font-display text-xl text-foreground">4. Cookies y Google Analytics</h2>
          <p>
            Usamos cookies estrictamente necesarias para el funcionamiento (por ejemplo, tu carrito) y,
            solo si lo aceptas en el aviso de cookies, cookies de <strong>Google Analytics 4</strong>{" "}
            para medir el uso de la web y mejorarla. Puedes aceptar o rechazar la analítica; si rechazas,
            Google Analytics no se activa. Google puede tratar estos datos como encargado; consulta sus
            políticas para más información.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-display text-xl text-foreground">5. Destinatarios</h2>
          <p>
            Compartimos datos únicamente con proveedores necesarios para prestar el servicio:{" "}
            <strong>Stripe</strong> (procesamiento de pagos), <strong>Supabase</strong> (alojamiento de la
            base de datos), <strong>Resend</strong> (envío de correos), <strong>Google</strong>{" "}
            (analítica, con tu consentimiento) y <strong>{envios}</strong> (entrega). No vendemos tus
            datos.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-display text-xl text-foreground">6. Conservación</h2>
          <p>
            Conservamos los datos de pedidos durante los plazos legales aplicables (fiscales/contables) y,
            el resto, mientras sean necesarios para la finalidad indicada.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-display text-xl text-foreground">7. Tus derechos</h2>
          <p>
            Puedes ejercer tus derechos de acceso, rectificación, supresión, oposición, limitación y
            portabilidad escribiendo a <strong>{email}</strong>. También puedes reclamar ante la Agencia
            Española de Protección de Datos (aepd.es).
          </p>
        </section>
      </div>
    </div>
  );
}
