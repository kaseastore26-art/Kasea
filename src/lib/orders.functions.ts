// ============================================================================
// Consulta pública de un pedido por su `stripe_session_id`.
//
// Se usa para la página de éxito y el historial del cliente (invitado). El
// session_id de Stripe es un token largo e imposible de adivinar que solo está
// en el navegador del comprador (URL de retorno) → actúa como capacidad.
//
// Seguridad: se leen los pedidos con la SERVICE ROLE (RLS los bloquea para
// anon), pero se devuelven SOLO datos no personales (estado, importes, líneas).
// Nunca email, nombre, teléfono ni dirección.
// ============================================================================
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export interface PublicOrderItem {
  variantId: string | null;
  title: string;
  quantity: number;
  unitPriceCents: number;
  attributes: Array<{ key: string; value: string }>;
}

export interface PublicOrder {
  status: string;
  createdAt: string;
  currency: string;
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  deliveryMethod: "delivery" | "pickup";
  paymentMethod: "card" | "cash";
  paymentStatus: "paid" | "pending";
  items: PublicOrderItem[];
}

export const getOrderBySession = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ sessionId: z.string().min(8).max(255) }).parse(d))
  .handler(async ({ data }): Promise<PublicOrder | null> => {
    // Service role (bypassa RLS). Import dinámico para no filtrar al bundle cliente.
    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");

    const { data: order, error } = await admin
      .from("orders")
      .select(
        "status, created_at, currency, subtotal_cents, shipping_cents, total_cents, " +
          "delivery_method, payment_method, payment_status, " +
          "order_items(variant_id, title, quantity, unit_price_cents, attributes)",
      )
      .eq("stripe_session_id", data.sessionId)
      .maybeSingle();

    if (error || !order) return null;

    const o = order as unknown as {
      status: string;
      created_at: string;
      currency: string | null;
      subtotal_cents: number | null;
      shipping_cents: number | null;
      total_cents: number | null;
      delivery_method: string | null;
      payment_method: string | null;
      payment_status: string | null;
      order_items: Array<{
        variant_id: string | null;
        title: string;
        quantity: number;
        unit_price_cents: number | null;
        attributes: unknown;
      }> | null;
    };

    return {
      status: o.status,
      createdAt: o.created_at,
      currency: o.currency ?? "EUR",
      subtotalCents: o.subtotal_cents ?? 0,
      shippingCents: o.shipping_cents ?? 0,
      totalCents: o.total_cents ?? 0,
      deliveryMethod: o.delivery_method === "pickup" ? "pickup" : "delivery",
      paymentMethod: o.payment_method === "cash" ? "cash" : "card",
      paymentStatus: o.payment_status === "pending" ? "pending" : "paid",
      items: (o.order_items ?? []).map((it) => ({
        variantId: it.variant_id,
        title: it.title,
        quantity: it.quantity,
        unitPriceCents: it.unit_price_cents ?? 0,
        attributes: Array.isArray(it.attributes)
          ? (it.attributes as Array<{ key: string; value: string }>)
          : [],
      })),
    };
  });
