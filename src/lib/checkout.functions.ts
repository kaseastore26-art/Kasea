// ============================================================================
// Checkout con Stripe (Checkout hosted) — creación de la sesión de pago.
//
// Seguridad (crítico, es producción con dinero):
//   - El precio y el stock NUNCA se confían al cliente: se releen de Supabase.
//   - Un producto inactivo o sin stock suficiente bloquea la compra.
//   - La secret key de Stripe vive solo en el servidor (process.env).
//   - Sin SDK: se usa la API REST de Stripe vía fetch (cero dependencias).
//
// Cada línea lleva `variant_id` en product_data.metadata para que el webhook
// (Fase 4) pueda descontar stock y crear el pedido de forma fiable.
// ============================================================================
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { sendOrderConfirmationEmail } from "@/lib/email";

function publicClient() {
  return createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

// Coste de envío (autoritativo). La tarifa/umbral vienen de shop_settings
// (editables en el admin). En recogida en tienda no hay coste de envío.
function computeShipping(
  subtotalCents: number,
  deliveryMethod: "delivery" | "pickup" | "nacex_point",
  flatCents: number,
  nacexCents: number,
  thresholdCents: number,
): number {
  if (deliveryMethod === "pickup") return 0;
  if (subtotalCents <= 0) return 0;
  if (subtotalCents >= thresholdCents) return 0;
  return deliveryMethod === "nacex_point" ? nacexCents : flatCents;
}

// Aplana un objeto/array a los pares clave-valor con notación de corchetes
// que espera la API de Stripe (application/x-www-form-urlencoded).
function toStripePairs(obj: unknown, prefix = "", pairs: Array<[string, string]> = []) {
  if (obj === null || obj === undefined) return pairs;
  if (Array.isArray(obj)) {
    obj.forEach((item, i) => toStripePairs(item, `${prefix}[${i}]`, pairs));
  } else if (typeof obj === "object") {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (v === undefined || v === null) continue;
      toStripePairs(v, prefix ? `${prefix}[${k}]` : k, pairs);
    }
  } else {
    pairs.push([prefix, String(obj)]);
  }
  return pairs;
}

const ItemSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.number().int().positive().max(99),
  attributes: z.array(z.object({ key: z.string(), value: z.string() })).optional(),
  customDesignId: z.string().uuid().optional(),
});
const InputSchema = z.object({
  items: z.array(ItemSchema).min(1),
  deliveryMethod: z.enum(["delivery", "pickup", "nacex_point"]).default("delivery"),
  nacexPostalCode: z.string().trim().max(10).optional(),
  nacexAddress: z.string().trim().max(200).optional(),
  // Origen del sitio para las URLs de retorno (se valida contra SITE_URL si existe).
  origin: z.string().url().optional(),
});

type VariantRow = {
  id: string;
  price_cents: number;
  currency: string;
  stock: number;
  title: string;
  products: {
    handle: string;
    title: string;
    status: string;
    product_images: Array<{ url: string; position: number }>;
  } | null;
};

export type CheckoutResult = { url: string } | { error: string };

export const createCheckoutSession = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => InputSchema.parse(d))
  .handler(async ({ data }): Promise<CheckoutResult> => {
    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) {
      return { error: "El pago aún no está configurado (falta STRIPE_SECRET_KEY)." };
    }

    // Base de las URLs de retorno: preferimos SITE_URL del servidor; si no,
    // el origin del cliente (solo redirige a nuestra propia web).
    const base = (process.env.SITE_URL || data.origin || "").replace(/\/$/, "");
    if (!base) return { error: "No se pudo determinar la URL del sitio." };

    // 1) Revalidar cada línea contra Supabase (precio y stock reales).
    const supabase = publicClient();
    const ids = [...new Set(data.items.map((i) => i.variantId))];
    const { data: rows, error } = await supabase
      .from("product_variants")
      .select("id, price_cents, currency, stock, title, products!inner ( handle, title, status, product_images ( url, position ) )")
      .in("id", ids);
    if (error) return { error: `No se pudo validar el carrito: ${error.message}` };

    const byId = new Map((rows as unknown as VariantRow[]).map((r) => [r.id, r]));

    const lineItems: unknown[] = [];
    let subtotal = 0;
    for (const item of data.items) {
      const v = byId.get(item.variantId);
      if (!v || !v.products || v.products.status !== "active") {
        return { error: "Uno de los productos ya no está disponible. Actualiza tu bolsa." };
      }
      if (v.stock < item.quantity) {
        return {
          error: `Sin stock suficiente de "${v.products.title}" (quedan ${v.stock}).`,
        };
      }
      subtotal += v.price_cents * item.quantity;

      const img = [...(v.products.product_images ?? [])].sort((a, b) => a.position - b.position)[0]?.url;
      const isDefault = !v.title || v.title === "Default Title";
      const name = isDefault ? v.products.title : `${v.products.title} — ${v.title}`;

      // Atributos legibles (marca/modelo/diseño) para mostrar y para el pedido.
      const attrs = item.attributes ?? [];
      const description = attrs
        .filter((a) => !a.value.startsWith("http"))
        .map((a) => `${a.key}: ${a.value}`)
        .join(" · ");

      lineItems.push({
        quantity: item.quantity,
        price_data: {
          currency: (v.currency || "eur").toLowerCase(),
          unit_amount: v.price_cents,
          product_data: {
            name,
            ...(description ? { description } : {}),
            ...(img ? { images: [img] } : {}),
            metadata: {
              variant_id: v.id,
              ...(item.customDesignId ? { custom_design_id: item.customDesignId } : {}),
              ...(attrs.length ? { attrs: JSON.stringify(attrs).slice(0, 480) } : {}),
            },
          },
        },
      });
    }

    // 2) Envío (recalculado en servidor desde shop_settings, editable en admin).
    const { data: settings } = await supabase
      .from("shop_settings")
      .select("shipping_flat_cents, shipping_nacex_cents, shipping_free_threshold_cents")
      .eq("id", "default")
      .maybeSingle();
    const flatCents = settings?.shipping_flat_cents ?? Number(process.env.SHIPPING_FLAT_CENTS ?? 699);
    const nacexCents = settings?.shipping_nacex_cents ?? 499;
    const thresholdCents =
      settings?.shipping_free_threshold_cents ?? Number(process.env.SHIPPING_FREE_THRESHOLD_CENTS ?? 5500);
    const ship = computeShipping(subtotal, data.deliveryMethod, flatCents, nacexCents, thresholdCents);

    // 3) Parámetros de la sesión de Stripe Checkout (hosted).
    const params: Record<string, unknown> = {
      mode: "payment",
      locale: "es",
      // Solo tarjeta (Visa/MasterCard). Apple Pay/Google Pay funcionan sobre
      // tarjeta si el dispositivo los tiene. Se pueden añadir más métodos luego.
      payment_method_types: ["card"],
      billing_address_collection: "auto",
      phone_number_collection: { enabled: true },
      line_items: lineItems,
            metadata: {
        delivery_method: data.deliveryMethod,
        ...(data.deliveryMethod === "nacex_point"
          ? {
              nacex_postal_code: data.nacexPostalCode ?? "",
              nacex_address: data.nacexAddress ?? "",
            }
          : {}),
      },
      success_url: `${base}/checkout/exito?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/checkout`,
    };

    if (data.deliveryMethod === "delivery") {
  // Envío a domicilio: pide dirección (España) y cobra el envío calculado.
  params.shipping_address_collection = { allowed_countries: ["ES"] };
  params.shipping_options = [
    {
      shipping_rate_data: {
        type: "fixed_amount",
        display_name: ship === 0 ? "Envío gratis" : "Envío estándar",
        fixed_amount: { amount: ship, currency: "eur" },
      },
    },
  ];
} else if (data.deliveryMethod === "nacex_point") {
  // Recogida en punto NACEX: no pide dirección de envío en Kasea.
  params.shipping_options = [
    {
      shipping_rate_data: {
        type: "fixed_amount",
        display_name: ship === 0 ? "NACEX gratis" : "Recogida en punto NACEX",
        fixed_amount: { amount: ship, currency: "eur" },
      },
    },
  ];
} else {
  // Recoger en tienda: sin dirección de envío y sin coste.
  params.shipping_options = [
    {
      shipping_rate_data: {
        type: "fixed_amount",
        display_name: "Recoger en tienda",
        fixed_amount: { amount: 0, currency: "eur" },
      },
    },
  ];
}

    const body = new URLSearchParams(toStripePairs(params)).toString();

    // 4) Crear la sesión vía API REST de Stripe.
    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    const session = await res.json();
    if (!res.ok) {
      const msg = session?.error?.message ?? `Stripe HTTP ${res.status}`;
      return { error: `No se pudo iniciar el pago: ${msg}` };
    }
    if (!session.url) return { error: "Stripe no devolvió una URL de pago." };
    return { url: session.url as string };
  });

// ============================================================================
// Pedido en EFECTIVO para recogida en tienda (sin Stripe).
//
// Revalida el carrito contra Supabase (precio/stock/activo), crea el pedido con
// payment_method='cash' + payment_status='pending' y descuenta stock de forma
// atómica (misma RPC que el pago con tarjeta). Devuelve una referencia
// `cash_...` que hace de identificador del pedido (para éxito / mis pedidos).
// ============================================================================
const CashInputSchema = z.object({
  items: z.array(ItemSchema).min(1),
  customerName: z.string().trim().min(1, "El nombre es obligatorio").max(120),
  phone: z.string().trim().min(3, "El teléfono es obligatorio").max(40),
  email: z.union([z.string().email(), z.literal("")]).optional(),
});

export type CashOrderResult = { ref: string } | { error: string };

export const createCashPickupOrder = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => CashInputSchema.parse(d))
  .handler(async ({ data }): Promise<CashOrderResult> => {
    const supabase = publicClient();
    const ids = [...new Set(data.items.map((i) => i.variantId))];
    const { data: rows, error } = await supabase
      .from("product_variants")
      .select("id, price_cents, currency, stock, title, products!inner ( handle, title, status )")
      .in("id", ids);
    if (error) return { error: `No se pudo validar el carrito: ${error.message}` };

    const byId = new Map((rows as unknown as VariantRow[]).map((r) => [r.id, r]));

    let subtotal = 0;
    const rpcItems: Array<Record<string, unknown>> = [];
    for (const item of data.items) {
      const v = byId.get(item.variantId);
      if (!v || !v.products || v.products.status !== "active") {
        return { error: "Uno de los productos ya no está disponible. Actualiza tu bolsa." };
      }
      if (v.stock < item.quantity) {
        return { error: `Sin stock suficiente de "${v.products.title}" (quedan ${v.stock}).` };
      }
      subtotal += v.price_cents * item.quantity;
      const isDefault = !v.title || v.title === "Default Title";
      const name = isDefault ? v.products.title : `${v.products.title} — ${v.title}`;
      rpcItems.push({
        variant_id: v.id,
        product_handle: v.products.handle,
        title: name,
        unit_price_cents: v.price_cents,
        quantity: item.quantity,
        attributes: item.attributes ?? [],
        ...(item.customDesignId ? { custom_design_id: item.customDesignId } : {}),
      });
    }

    const currency = ((rows as unknown as VariantRow[])[0]?.currency || "eur").toUpperCase();
    const ref = `cash_${crypto.randomUUID()}`;

    // Cliente con service role: crea el pedido y descuenta stock (atómico).
    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
    const { error: rpcErr } = await (admin as any).rpc("process_paid_order", {
      _session_id: ref,
      _payment_intent: null,
      _email: data.email || null,
      _name: data.customerName,
      _phone: data.phone,
      _address: null,
      _delivery_method: "pickup",
      _currency: currency,
      _subtotal_cents: subtotal,
      _shipping_cents: 0,
      _total_cents: subtotal,
      _items: rpcItems,
    });
    if (rpcErr) {
      console.error("[cash-order] RPC falló:", rpcErr.message);
      return { error: "No se pudo registrar el pedido. Inténtalo de nuevo." };
    }
    
    // Confirmación al cliente. En pedidos de pago en tienda,
    // el pago queda pendiente hasta que el cliente recoge el pedido.
    if (data.email) {
      try {
        await sendOrderConfirmationEmail({
          to: data.email,
          customerName: data.customerName,
          items: rpcItems.map((i) => ({
            title: String(i.title),
            quantity: Number(i.quantity),
            unit_price_cents: Number(i.unit_price_cents),
            attributes:
              (i.attributes as Array<{ key: string; value: string }>) ?? [],
          })),
          currency,
          subtotalCents: subtotal,
          shippingCents: 0,
          totalCents: subtotal,
          paymentPending: true,
        });
      } catch (err) {
        console.error("[cash-order] Error enviando confirmación al cliente:", err);
      }
    }
    // Aviso al administrador (mejor esfuerzo; no bloquea la confirmación).
try {
  const { data: settingsRow } = await admin
    .from("shop_settings")
    .select("notify_email")
    .eq("id", "default")
    .maybeSingle();

  const notifyEmail =
    (settingsRow?.notify_email as string | null) ||
    process.env.ADMIN_NOTIFY_EMAIL ||
    "";

  if (notifyEmail) {
    const { sendAdminOrderNotification } = await import("@/lib/email");

    const customDesignIds = rpcItems
      .map((i) => i.custom_design_id)
      .filter((id): id is string => Boolean(id));

    let designs: Array<{
      id: string;
      model: string | null;
      image_url: string | null;
      preview_url: string | null;
      text_content: string | null;
      font: string | null;
      color: string | null;
    }> = [];

    if (customDesignIds.length > 0) {
      const { data } = await admin
        .from("custom_designs")
        .select(
          "id, model, image_url, preview_url, text_content, font, color"
        )
        .in("id", customDesignIds);

      designs = data ?? [];
    }

    await sendAdminOrderNotification({
      to: notifyEmail,
      customerName: data.customerName,
      customerEmail: data.email || null,
      phone: data.phone,
      deliveryMethod: "pickup",
      address: null,
      paymentNote: `Pago en EFECTIVO — PENDIENTE de cobro en tienda (${(
        subtotal / 100
      ).toFixed(2)} ${currency})`,
      items: rpcItems.map((i) => {
        const design = designs.find(
          (d) => d.id === i.custom_design_id
        );

        return {
          title: String(i.title),
          quantity: Number(i.quantity),
          unit_price_cents: Number(i.unit_price_cents),
          attributes:
            (i.attributes as Array<{ key: string; value: string }>) ?? [],
          design: design
            ? {
                model: design.model,
                text: design.text_content,
                font: design.font,
                color: design.color,
                previewUrl:
                  design.preview_url ||
                  design.image_url ||
                  null,
              }
            : null,
        };
      }),
      currency,
      subtotalCents: subtotal,
      shippingCents: 0,
      totalCents: subtotal,
    });
  }
} catch {
  /* el correo no debe bloquear el pedido */
}

    return { ref };
  });
