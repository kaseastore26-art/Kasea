/* eslint-disable @typescript-eslint/no-explicit-any */
// ============================================================================
// Webhook de Stripe — POST /api/stripe-webhook
//
// Al confirmarse un pago (checkout.session.completed), este endpoint:
//   1. Verifica la firma del evento con Web Crypto (HMAC-SHA256) → nadie puede
//      falsificar pedidos.
//   2. Obtiene las líneas de la sesión (variant_id va en la metadata).
//   3. Llama al RPC process_paid_order con la SERVICE ROLE: crea el pedido y
//      descuenta el stock de forma ATÓMICA e IDEMPOTENTE (sin sobreventa,
//      sin duplicar si Stripe reintenta el webhook).
//   4. Envía el correo de confirmación (Resend).
//
// Devuelve 200 si todo va bien (o si el evento no aplica); 400 si la firma es
// inválida; 500 si algo falla (Stripe reintentará el envío).
// ============================================================================
import { createFileRoute } from "@tanstack/react-router";
import { sendOrderConfirmationEmail, sendAdminOrderNotification } from "@/lib/email";

const encoder = new TextEncoder();

function bufToHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Comparación en tiempo constante (evita ataques por temporización).
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Verifica la firma del webhook de Stripe sobre el body CRUDO.
async function verifyStripeSignature(
  payload: string,
  header: string,
  secret: string,
  toleranceSec = 300,
): Promise<boolean> {
  const parts = header.split(",").map((kv) => kv.split("="));
  const t = parts.find((p) => p[0] === "t")?.[1];
  const v1s = parts.filter((p) => p[0] === "v1").map((p) => p[1]);
  if (!t || v1s.length === 0) return false;

  // Tolerancia temporal (rechaza eventos demasiado antiguos: anti-replay).
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(t)) > toleranceSec) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(`${t}.${payload}`));
  const expected = bufToHex(sig);
  return v1s.some((v1) => timingSafeEqual(expected, v1));
}

async function stripeGet(path: string, secret: string): Promise<any> {
  const res = await fetch(`https://api.stripe.com${path}`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  return res.json();
}

export const Route = createFileRoute("/api/stripe-webhook")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
        const stripeKey = process.env.STRIPE_SECRET_KEY;

        if (!webhookSecret || !stripeKey) {
          console.error("[webhook] Falta configuración de Stripe (STRIPE_WEBHOOK_SECRET / STRIPE_SECRET_KEY).");
          return new Response("Webhook no configurado", { status: 500 });
        }

        // Body CRUDO (necesario para verificar la firma).
        const payload = await request.text();
        const sigHeader = request.headers.get("stripe-signature");
        if (!sigHeader || !(await verifyStripeSignature(payload, sigHeader, webhookSecret))) {
          return new Response("Firma inválida", { status: 400 });
        }

        let event: any;
        try {
          event = JSON.parse(payload);
        } catch {
          return new Response("JSON inválido", { status: 400 });
        }

        const type: string = event?.type ?? "";
        const isRelevant =
          type === "checkout.session.completed" || type === "checkout.session.async_payment_succeeded";
        if (!isRelevant) {
          return new Response("ok (evento ignorado)", { status: 200 });
        }

        const session: any = event.data?.object ?? {};
        if (session.payment_status && session.payment_status !== "paid") {
          return new Response("ok (pago aún no completado)", { status: 200 });
        }

        // Líneas de la sesión, con el producto expandido para leer su metadata.
        const li = await stripeGet(
          `/v1/checkout/sessions/${session.id}/line_items?expand[]=data.price.product&limit=100`,
          stripeKey,
        );
        const items = (li?.data ?? []).map((row: any) => {
          const product = row?.price?.product ?? {};
          let attributes: Array<{ key: string; value: string }> = [];
          try {
            if (product?.metadata?.attrs) attributes = JSON.parse(product.metadata.attrs);
          } catch {
            /* metadata mal formada: se ignora */
          }
          return {
            variant_id: product?.metadata?.variant_id ?? null,
            custom_design_id: product?.metadata?.custom_design_id ?? null,
            product_handle: null as string | null,
            title: product?.name ?? "Producto",
            unit_price_cents: row?.price?.unit_amount ?? 0,
            quantity: row?.quantity ?? 1,
            attributes,
          };
        });

        // Cliente con service role (bypassa RLS; maneja el formato de clave nuevo).
        const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");

        // Completar product_handle (para el historial del pedido).
        const variantIds = items.map((i: any) => i.variant_id).filter(Boolean) as string[];
        if (variantIds.length) {
          const { data: vrows } = await admin
            .from("product_variants")
            .select("id, products(handle)")
            .in("id", variantIds);
          const handleById = new Map(
            ((vrows ?? []) as any[]).map((r) => [r.id, r.products?.handle ?? null]),
          );
          items.forEach((i: any) => {
            i.product_handle = handleById.get(i.variant_id) ?? null;
          });
        }

        const cd = session.customer_details ?? {};
        const shipping = session.shipping_details ?? session.shipping ?? null;
        const address = shipping?.address ?? cd.address ?? null;
       const deliveryMethod =
          session.metadata?.delivery_method === "pickup"
           ? "pickup"
           : session.metadata?.delivery_method === "nacex_point"
             ? "nacex_point"
             : "delivery";
        const currency = String(session.currency ?? "eur").toUpperCase();
        const subtotalCents = session.amount_subtotal ?? 0;
        const shippingCents = session.total_details?.amount_shipping ?? 0;
        const totalCents = session.amount_total ?? 0;

        // Crear pedido + descontar stock (atómico e idempotente).
        const { data: result, error } = await admin.rpc("process_paid_order", {
          _session_id: session.id,
          _payment_intent:
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : (session.payment_intent?.id ?? null),
          _email: cd.email ?? null,
          _name: cd.name ?? shipping?.name ?? null,
          _phone: cd.phone ?? null,
          _address: shipping ?? (address ? { address } : null),
          _delivery_method: deliveryMethod,
          _currency: currency,
          _subtotal_cents: subtotalCents,
          _shipping_cents: shippingCents,
          _total_cents: totalCents,
          _items: items,
        });

        // Registro del evento (auditoría; no bloquea el flujo).
        await admin
          .from("stripe_events")
          .upsert({ id: event.id, type }, { onConflict: "id", ignoreDuplicates: true });

        if (error) {
          console.error("[webhook] process_paid_order falló:", error.message);
          return new Response("Error procesando el pedido", { status: 500 }); // Stripe reintentará
        }

        const alreadyProcessed = (result as any)?.already_processed === true;

        // Correos (solo la primera vez, no en reintentos de Stripe).
        if (!alreadyProcessed) {
          // 1) Confirmación al cliente.
          if (cd.email) {
            await sendOrderConfirmationEmail({
              to: cd.email,
              customerName: cd.name ?? null,
              items: items.map((i: any) => ({
                title: i.title,
                quantity: i.quantity,
                unit_price_cents: i.unit_price_cents,
                attributes: i.attributes,
              })),
              currency,
              subtotalCents,
              shippingCents,
              totalCents,
              address,
            });
          }

          // 2) Aviso al administrador (con el diseño si es funda personalizada).
          const { data: settingsRow } = await admin
            .from("shop_settings")
            .select("notify_email")
            .eq("id", "default")
            .maybeSingle();
          const notifyEmail = (settingsRow?.notify_email as string | null) || process.env.ADMIN_NOTIFY_EMAIL || "";
          if (notifyEmail) {
            const designIds = items.map((i: any) => i.custom_design_id).filter(Boolean) as string[];
            let designsById: Record<string, any> = {};
            if (designIds.length) {
              const { data: designs } = await admin
                .from("custom_designs")
                .select("id, model, text_content, font, color, preview_url")
                .in("id", designIds);
              designsById = Object.fromEntries(((designs ?? []) as any[]).map((d) => [d.id, d]));
            }
            await sendAdminOrderNotification({
              to: notifyEmail,
              customerName: cd.name ?? null,
              customerEmail: cd.email ?? null,
              phone: cd.phone ?? null,
              deliveryMethod,
              address,
              items: items.map((i: any) => {
                const d = i.custom_design_id ? designsById[i.custom_design_id] : null;
                return {
                  title: i.title,
                  quantity: i.quantity,
                  unit_price_cents: i.unit_price_cents,
                  attributes: i.attributes,
                  design: d
                    ? { model: d.model, text: d.text_content, font: d.font, color: d.color, previewUrl: d.preview_url }
                    : null,
                };
              }),
              currency,
              subtotalCents,
              shippingCents,
              totalCents,
            });
          }
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
