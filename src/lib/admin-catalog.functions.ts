/* eslint-disable @typescript-eslint/no-explicit-any */
// ============================================================================
// Server functions del panel de administración: catálogo, pedidos y ajustes.
//
// Todas exigen sesión (requireSupabaseAuth) y rol admin (assertAdmin). Las
// escrituras usan el cliente autenticado (context.supabase), que lleva el JWT
// del admin, de modo que respetan las políticas RLS de administrador.
// ============================================================================
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type AuthedContext = { supabase: any; userId: string };

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: se requiere rol de administrador.");
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita diacríticos
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "producto";
}

export interface AdminProduct {
  id: string;
  handle: string;
  title: string;
  description: string;
  status: string;
  isCustom: boolean;
  priceCents: number;
  stock: number;
  imageUrl: string;
  tags: string[];
}

// -------- Listado de productos (incluye borradores) --------
export const listProductsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminProduct[]> => {
    const ctx = context as unknown as AuthedContext;
    await assertAdmin(ctx);
    const { data, error } = await (ctx.supabase as any)
      .from("products")
      .select("id, handle, title, description, tags, status, is_custom, position, product_variants(id, price_cents, stock, position), product_images(url, position)")
      .order("position", { ascending: true });
    if (error) throw new Error(error.message);
    return ((data ?? []) as any[]).map((p): AdminProduct => {
      const variant = [...(p.product_variants ?? [])].sort((a, b) => a.position - b.position)[0];
      const image = [...(p.product_images ?? [])].sort((a, b) => a.position - b.position)[0];
      return {
        id: p.id,
        handle: p.handle,
        title: p.title,
        description: p.description ?? "",
        tags: p.tags ?? [],
        status: p.status,
        isCustom: p.is_custom,
        priceCents: variant?.price_cents ?? 0,
        stock: variant?.stock ?? 0,
        imageUrl: image?.url ?? "",
      };
    });
  });

const UpsertSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1, "El nombre es obligatorio"),
  description: z.string().default(""),
  priceEuros: z.number().nonnegative(),
  stock: z.number().int().nonnegative(),
  status: z.enum(["active", "draft", "archived"]).default("active"),
  imageUrl: z.string().default(""),
  tags: z.array(z.string()).default([]),
});

// -------- Crear / editar producto (con su variante e imagen) --------
export const upsertProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpsertSchema.parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as AuthedContext;
    await assertAdmin(ctx);
    const supabase = ctx.supabase as any;
    const priceCents = Math.round(data.priceEuros * 100);

    let productId = data.id;

    if (productId) {
      const { error } = await supabase
        .from("products")
        .update({ title: data.title, description: data.description, status: data.status, tags: data.tags ?? [] })
        .eq("id", productId);
      if (error) throw new Error(error.message);
    } else {
      // Handle único a partir del nombre.
      let handle = slugify(data.title);
      const { data: exists } = await supabase.from("products").select("id").eq("handle", handle).maybeSingle();
      if (exists) handle = `${handle}-${crypto.randomUUID().slice(0, 4)}`;
      const { data: created, error } = await supabase
        .from("products")
        .insert({ handle, title: data.title, description: data.description, status: data.status, tags: data.tags ?? [] })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      productId = created.id;
    }

    // Variante única (precio + stock).
    const { data: variants } = await supabase
      .from("product_variants")
      .select("id")
      .eq("product_id", productId)
      .order("position", { ascending: true });
    if (variants && variants.length > 0) {
      const { error } = await supabase
        .from("product_variants")
        .update({ price_cents: priceCents, stock: data.stock })
        .eq("id", variants[0].id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from("product_variants")
        .insert({ product_id: productId, title: "Default Title", price_cents: priceCents, stock: data.stock, position: 0 });
      if (error) throw new Error(error.message);
    }

    // Imagen (una): reemplazar.
    await supabase.from("product_images").delete().eq("product_id", productId);
    if (data.imageUrl.trim()) {
      const { error } = await supabase
        .from("product_images")
        .insert({ product_id: productId, url: data.imageUrl.trim(), alt: data.title, position: 0 });
      if (error) throw new Error(error.message);
    }

    return { ok: true, id: productId };
  });

// -------- Reordenar productos (posición del catálogo) --------
export const setProductOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ orderedIds: z.array(z.string().uuid()) }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as AuthedContext;
    await assertAdmin(ctx);
    for (let i = 0; i < data.orderedIds.length; i++) {
      const { error } = await ctx.supabase
        .from("products")
        .update({ position: i })
        .eq("id", data.orderedIds[i]);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as AuthedContext;
    await assertAdmin(ctx);
    const { error } = await (ctx.supabase as any).from("products").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// -------- Pedidos --------
export const listOrdersAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as unknown as AuthedContext;
    await assertAdmin(ctx);
    const { data, error } = await (ctx.supabase as any)
      .from("orders")
      .select("*, order_items(*, custom_designs(*))")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const orders = (data ?? []) as any[];

    // Foto y enlace de cada funda pedida, para reconocerla sin buscarla.
    try {
      const variantIds = [
        ...new Set(
          orders.flatMap((o) => (o.order_items ?? []).map((it: any) => it.variant_id).filter(Boolean)),
        ),
      ] as string[];
      if (variantIds.length) {
        const { data: vs } = await (ctx.supabase as any)
          .from("product_variants")
          .select("id, products(handle, product_images(url, position))")
          .in("id", variantIds);
        const info = new Map<string, { image: string | null; handle: string | null }>();
        for (const v of (vs ?? []) as any[]) {
          const imgs = [...(v.products?.product_images ?? [])].sort((a: any, b: any) => a.position - b.position);
          info.set(v.id, { image: imgs[0]?.url ?? null, handle: v.products?.handle ?? null });
        }
        for (const o of orders) {
          for (const it of o.order_items ?? []) {
            const i = it.variant_id ? info.get(it.variant_id) : undefined;
            it.product_image = i?.image ?? null;
            it.product_handle = it.product_handle || i?.handle || null;
          }
        }
      }
    } catch {
      /* sin fotos: el pedido se enseña igual */
    }
    return orders;
  });

const ORDER_STATUSES = ["paid", "fulfilled", "delivered", "cancelled", "refunded"] as const;

export const updateOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(ORDER_STATUSES) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as AuthedContext;
    await assertAdmin(ctx);

    // Leemos el estado anterior + datos del pedido (para el correo al cliente).
    const { data: order, error: readErr } = await (ctx.supabase as any)
      .from("orders")
      .select("*, order_items(title, quantity, unit_price_cents, attributes)")
      .eq("id", data.id)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);

    const prevStatus = order?.status;
    const { trackingUrl, orderPostalCode } = await import("@/lib/tracking");
    const tUrl = trackingUrl(order?.tracking_number, orderPostalCode(order?.shipping_address));
    const { error } = await (ctx.supabase as any)
      .from("orders")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    // Aviso al cliente al pasar a "enviado" o "entregado" (solo en el cambio).
    if (
      order?.email &&
      data.status !== prevStatus &&
      (data.status === "fulfilled" || data.status === "delivered")
    ) {
      try {
        const { sendOrderStatusEmail } = await import("@/lib/email");
        await sendOrderStatusEmail({
          to: order.email as string,
          customerName: (order.customer_name as string | null) ?? null,
          status: data.status,
          currency: (order.currency as string) || "EUR",
          totalCents: (order.total_cents as number) ?? 0,
          items: ((order.order_items ?? []) as any[]).map((it) => ({
            title: it.title,
            quantity: it.quantity,
            unit_price_cents: it.unit_price_cents ?? 0,
            attributes: Array.isArray(it.attributes) ? it.attributes : [],
          })),
          trackingNumber: order.tracking_number ?? null,
          trackingUrl: data.status === "fulfilled" ? tUrl : null,
        });
      } catch {
        /* el correo no debe bloquear el cambio de estado */
      }
    }

    return { ok: true };
  });

// -------- Guardar el nº de seguimiento, marcar "Enviado" y avisar al cliente --------
export const shipOrderWithTracking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), tracking: z.string().trim().min(4).max(60) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as AuthedContext;
    await assertAdmin(ctx);
    const { cleanTracking, trackingUrl, orderPostalCode } = await import("@/lib/tracking");
    const tracking = cleanTracking(data.tracking);

    const { data: order, error: readErr } = await (ctx.supabase as any)
      .from("orders")
      .select("*, order_items(title, quantity, unit_price_cents, attributes)")
      .eq("id", data.id)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!order) throw new Error("Pedido no encontrado");

    const { error } = await (ctx.supabase as any)
      .from("orders")
      .update({ tracking_number: tracking, status: "fulfilled" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    let emailed = false;
    if (order.email) {
      try {
        const { sendOrderStatusEmail } = await import("@/lib/email");
        await sendOrderStatusEmail({
          to: order.email as string,
          customerName: (order.customer_name as string | null) ?? null,
          status: "fulfilled",
          currency: (order.currency as string) || "EUR",
          totalCents: (order.total_cents as number) ?? 0,
          items: ((order.order_items ?? []) as any[]).map((it) => ({
            title: it.title,
            quantity: it.quantity,
            unit_price_cents: it.unit_price_cents ?? 0,
            attributes: Array.isArray(it.attributes) ? it.attributes : [],
          })),
          trackingNumber: tracking,
          trackingUrl: trackingUrl(tracking, orderPostalCode(order.shipping_address)),
        });
        emailed = true;
      } catch {
        /* sin correo: el seguimiento queda guardado igualmente */
      }
    }
    return { ok: true, emailed };
  });

// -------- Marcar un pedido en efectivo como COBRADO --------
export const markOrderPaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as AuthedContext;
    await assertAdmin(ctx);
    const { error } = await (ctx.supabase as any)
      .from("orders")
      .update({ payment_status: "paid" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// -------- Limpieza del historial: pedidos ENTREGADOS con más de 30 días --------
// Borra de forma permanente los pedidos ya entregados y antiguos (y sus líneas,
// vía ON DELETE CASCADE). Se hace con la service role porque `orders` no tiene
// política RLS de DELETE; el candado real es assertAdmin sobre el JWT del admin.
export const purgeDeliveredOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ deleted: number }> => {
    const ctx = context as unknown as AuthedContext;
    await assertAdmin(ctx);
    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await (admin as any)
      .from("orders")
      .delete()
      .eq("status", "delivered")
      .lt("created_at", cutoff)
      .select("id");
    if (error) throw new Error(error.message);
    return { deleted: ((data ?? []) as any[]).length };
  });

// -------- Borrar UN pedido (p. ej. pedidos de prueba) --------
// Borra el pedido elegido y sus líneas (ON DELETE CASCADE). Igual que la limpieza,
// usa la service role porque `orders` no tiene política RLS de DELETE.
export const deleteOrderAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as AuthedContext;
    await assertAdmin(ctx);
    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await (admin as any).from("orders").delete().eq("id", data.id).select("id");
    if (error) throw new Error(error.message);
    if (!rows || rows.length === 0) throw new Error("No se encontró el pedido");
    return { ok: true };
  });

// -------- Contenido editable de la web (textos por temporada) --------
export const getSiteContentAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Record<string, string>> => {
    const ctx = context as unknown as AuthedContext;
    await assertAdmin(ctx);
    const { data, error } = await (ctx.supabase as any).from("site_content").select("key, value");
    if (error) throw new Error(error.message);
    const map: Record<string, string> = {};
    for (const r of (data ?? []) as any[]) map[r.key] = r.value;
    return map;
  });

export const updateSiteContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ entries: z.array(z.object({ key: z.string().min(1), value: z.string() })) })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as AuthedContext;
    await assertAdmin(ctx);
    const rows = data.entries.map((e) => ({ key: e.key, value: e.value }));
    const { error } = await (ctx.supabase as any)
      .from("site_content")
      .upsert(rows, { onConflict: "key" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// -------- Ajustes de envío --------
export const getShopSettingsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as unknown as AuthedContext;
    await assertAdmin(ctx);
    const { data, error } = await (ctx.supabase as any)
      .from("shop_settings")
      .select("shipping_flat_cents, shipping_nacex_cents, shipping_free_threshold_cents, notify_email")
      .eq("id", "default")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return {
  shippingFlatCents: data?.shipping_flat_cents ?? 699,
  shippingNacexCents: data?.shipping_nacex_cents ?? 499,
  freeThresholdCents: data?.shipping_free_threshold_cents ?? 5500,
  notifyEmail: data?.notify_email ?? "",
};
  });

export const updateShopSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        shippingFlatEuros: z.number().nonnegative(),
        shippingNacexEuros: z.number().nonnegative(),
        freeThresholdEuros: z.number().nonnegative(),
        notifyEmail: z.string().email().or(z.literal("")).default(""),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as AuthedContext;
    await assertAdmin(ctx);
    const { error } = await (ctx.supabase as any)
      .from("shop_settings")
      .update({
        shipping_flat_cents: Math.round(data.shippingFlatEuros * 100),
        shipping_nacex_cents: Math.round(data.shippingNacexEuros * 100),
        shipping_free_threshold_cents: Math.round(data.freeThresholdEuros * 100),
        notify_email: data.notifyEmail || null,
      })
      .eq("id", "default");
    if (error) throw new Error(error.message);
    return { ok: true };
  });
export const updateProductImageUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: unknown) =>
      z
        .object({
          productId: z.string().uuid(),
          imageUrl: z.string().url(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as AuthedContext;
    await assertAdmin(ctx);

    const { data: existingImage, error: findError } = await ctx.supabase
      .from("product_images")
      .select("id")
      .eq("product_id", data.productId)
      .order("position", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (findError) {
      throw new Error(findError.message);
    }

    if (existingImage?.id) {
      const { error } = await ctx.supabase
        .from("product_images")
        .update({ url: data.imageUrl })
        .eq("id", existingImage.id);

      if (error) {
        throw new Error(error.message);
      }
    } else {
      const { error } = await ctx.supabase
        .from("product_images")
        .insert({
          product_id: data.productId,
          url: data.imageUrl,
          position: 0,
        });

      if (error) {
        throw new Error(error.message);
      }
    }

    return { ok: true };
  });

// -------- Pedidos a medias: se leen directamente de Stripe --------
// Pagos que caducaron sin pagarse en los últimos 30 días (con correo del cliente).
export const listAbandonedCheckoutsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as unknown as AuthedContext;
    await assertAdmin(ctx);
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) return [];
    const get = async (path: string) =>
      (await fetch(`https://api.stripe.com${path}`, { headers: { Authorization: `Bearer ${key}` } })).json();

    const sinceSec = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;
    const list = await get(`/v1/checkout/sessions?status=expired&limit=50&created[gte]=${sinceSec}`);
    const sessions = ((list?.data ?? []) as any[]).filter((s) => s?.metadata?.customer_email);

    const rows = await Promise.all(
      sessions.map(async (s) => {
        let items: Array<{ title: string; quantity: number; unit_price_cents: number; model: string | null }> = [];
        try {
          const li = await get(`/v1/checkout/sessions/${s.id}/line_items?expand[]=data.price.product&limit=100`);
          items = ((li?.data ?? []) as any[])
            .filter((row) => row?.price?.product?.metadata?.variant_id)
            .map((row) => {
              const product = row.price.product;
              let model: string | null = null;
              try {
                const attrs = product?.metadata?.attrs ? JSON.parse(product.metadata.attrs) : [];
                model = (attrs as any[]).find((a) => a?.key === "Modelo")?.value ?? null;
              } catch {
                /* sin atributos */
              }
              return {
                title: String(product?.name ?? "Funda"),
                quantity: Number(row?.quantity ?? 1),
                unit_price_cents: Number(row?.price?.unit_amount ?? 0),
                model,
              };
            });
        } catch {
          /* sin líneas */
        }
        return {
          id: s.id as string,
          stripe_session_id: s.id as string,
          email: String(s.metadata.customer_email),
          customer_name: (s.metadata.customer_name as string) || null,
          phone: (s.metadata.customer_phone as string) || null,
          items,
          total_cents: items.reduce((n, it) => n + it.unit_price_cents * it.quantity, 0),
          created_at: new Date(Number(s.created) * 1000).toISOString(),
          recovered: false,
          // Desde el 10/11/2026 22:45 el recordatorio se manda solo a las 2 h.
          autoReminded: Number(s.created) * 1000 >= Date.UTC(2026, 10, 10, 21, 45),
        };
      }),
    );

    // ¿Compró después? (pedido con el mismo correo tras empezar ese pago)
    if (rows.length) {
      const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
      const { data: orders } = await (admin as any)
        .from("orders")
        .select("email, created_at")
        .gte("created_at", new Date(sinceSec * 1000).toISOString());
      for (const r of rows) {
        r.recovered = ((orders ?? []) as any[]).some(
          (o) => String(o.email ?? "").toLowerCase() === r.email.toLowerCase() && o.created_at >= r.created_at,
        );
      }
    }
    return rows.filter((r) => r.items.length > 0);
  });

// -------- Mandar a mano el recordatorio de un pago a medias --------
export const sendCartReminderAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ sessionId: z.string().regex(/^cs_[A-Za-z0-9_]+$/) }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true } | { error: string }> => {
    const ctx = context as unknown as AuthedContext;
    await assertAdmin(ctx);
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) return { error: "Stripe no está configurado." };
    const get = async (path: string) =>
      (await fetch(`https://api.stripe.com${path}`, { headers: { Authorization: `Bearer ${key}` } })).json();

    const session = await get(`/v1/checkout/sessions/${data.sessionId}`);
    if (!session?.id) return { error: "No se encontró ese pago en Stripe." };
    if (session.status === "complete") return { error: "Ese pago ya está completado." };
    const metadata = session.metadata ?? {};
    const email = String(metadata.customer_email ?? session.customer_email ?? "").trim();
    if (!email) return { error: "Ese pago no tiene correo." };

    const { normalizeEmail, signEmail, siteUrl } = await import("@/lib/cart-reminder.server");
    const norm = normalizeEmail(email);
    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
    const { data: optout } = await (admin as any)
      .from("cart_reminder_optouts")
      .select("email")
      .eq("email", norm)
      .maybeSingle();
    if (optout) return { error: "Este cliente pidió no recibir avisos." };

    const li = await get(`/v1/checkout/sessions/${data.sessionId}/line_items?expand[]=data.price.product&limit=100`);
    const items = ((li?.data ?? []) as any[])
      .filter((row) => row?.price?.product?.metadata?.variant_id)
      .map((row) => {
        const product = row.price.product;
        let model: string | null = null;
        try {
          const attrs = product?.metadata?.attrs ? JSON.parse(product.metadata.attrs) : [];
          model = (attrs as any[]).find((a) => a?.key === "Modelo")?.value ?? null;
        } catch {
          /* sin atributos */
        }
        return {
          title: String(product?.name ?? "Funda").replace(/\s*·\s*2\.ª funda.*$/, ""),
          quantity: Number(row?.quantity ?? 1),
          unit_price_cents: Number(row?.price?.unit_amount ?? 0),
          imageUrl: (product?.images ?? [])[0] ?? null,
          model,
        };
      });
    if (!items.length) return { error: "Ese pago no tiene productos." };

    const { sendCartReminderEmail } = await import("@/lib/email");
    const base = siteUrl();
    try {
      await sendCartReminderEmail({
        to: email,
        customerName: metadata.customer_name ?? null,
        items,
        currency: String(session.currency ?? "eur").toUpperCase(),
        recoverUrl: `${base}/recuperar/${encodeURIComponent(session.id)}`,
        unsubscribeUrl: `${base}/recuperar/baja?e=${encodeURIComponent(norm)}&k=${await signEmail(norm)}`,
      });
    } catch (e) {
      return { error: e instanceof Error ? e.message : "No se pudo enviar el correo." };
    }
    return { ok: true };
  });
