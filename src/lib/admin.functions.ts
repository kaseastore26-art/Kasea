import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

// Public read using publishable key (server-side)
function publicClient() {
  return createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

async function isAdminUser(ctx: { supabase: ReturnType<typeof publicClient>; userId: string }) {
  const { data, error } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return !!data;
}

async function assertAdmin(ctx: { supabase: ReturnType<typeof publicClient>; userId: string }) {
  if (!(await isAdminUser(ctx))) throw new Error("Forbidden: admin role required");
}

// -------- Session/role check --------
export const checkIsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      return { isAdmin: await isAdminUser(context as never) };
    } catch {
      return { isAdmin: false };
    }
  });

// -------- Carousel: public read --------
export const listCarouselImagesPublic = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = publicClient();
  const { data, error } = await supabase
    .from("carousel_images")
    .select("id, image_url, alt, title, description, position")
    .order("position", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
});

// -------- Carousel: admin save (replace all) --------
const CarouselItemSchema = z.object({
  image_url: z.string().min(1),
  alt: z.string().default(""),
  title: z.string().default(""),
  description: z.string().default(""),
});
const SaveCarouselSchema = z.object({ items: z.array(CarouselItemSchema) });

export const saveCarouselImages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SaveCarouselSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabase } = context;
    const { error: delErr } = await supabase.from("carousel_images").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (delErr) throw new Error(delErr.message);
    if (data.items.length > 0) {
      const rows = data.items.map((it, i) => ({
        image_url: it.image_url,
        alt: it.alt,
        title: it.title,
        description: it.description,
        position: i + 1,
        image_key: it.image_url.slice(0, 200),
      }));
      const { error: insErr } = await supabase.from("carousel_images").insert(rows);
      if (insErr) throw new Error(insErr.message);
    }
    return { ok: true };
  });

// -------- Product image overrides --------
export const listProductImageOverridesPublic = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ handle: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const { data: rows, error } = await supabase
      .from("product_image_overrides")
      .select("id, image_url, alt, title, position, is_uploaded")
      .eq("product_handle", data.handle)
      .order("position", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const ProdItemSchema = z.object({
  image_url: z.string().min(1),
  alt: z.string().default(""),
  title: z.string().default(""),
  is_uploaded: z.boolean().default(true),
});
const SaveProdSchema = z.object({ handle: z.string().min(1), items: z.array(ProdItemSchema) });

export const saveProductImageOverrides = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SaveProdSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabase } = context;
    const { error: delErr } = await supabase
      .from("product_image_overrides")
      .delete()
      .eq("product_handle", data.handle);
    if (delErr) throw new Error(delErr.message);
    if (data.items.length > 0) {
      const rows = data.items.map((it, i) => ({
        product_handle: data.handle,
        image_url: it.image_url,
        alt: it.alt,
        title: it.title,
        is_uploaded: it.is_uploaded,
        position: i + 1,
      }));
      const { error: insErr } = await supabase.from("product_image_overrides").insert(rows);
      if (insErr) throw new Error(insErr.message);
    }
    return { ok: true };
  });

// -------- Product order (custom ordering of Shopify products) --------
export const listProductOrderPublic = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = publicClient();
  const { data, error } = await supabase
    .from("product_order")
    .select("product_handle, position")
    .order("position", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
});

const SaveOrderSchema = z.object({ handles: z.array(z.string().min(1)) });

export const saveProductOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SaveOrderSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabase } = context;
    const { error: delErr } = await supabase
      .from("product_order")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    if (delErr) throw new Error(delErr.message);
    if (data.handles.length > 0) {
      const rows = data.handles.map((h, i) => ({ product_handle: h, position: i + 1 }));
      const { error: insErr } = await supabase.from("product_order").insert(rows);
      if (insErr) throw new Error(insErr.message);
    }
    return { ok: true };
  });

// -------- Category images (home + /fundas cards) --------
const CATEGORY_SLUGS = ["transparentes", "sublimacion", "colgantes", "protectores", "cargadores"] as const;
const CategorySlugSchema = z.enum(CATEGORY_SLUGS);

export const listCategoryImagesPublic = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = publicClient();
  const { data, error } = await supabase
    .from("category_images")
    .select("slug, image_url, alt, title, description");
  if (error) throw new Error(error.message);
  return data ?? [];
});

const SaveCategoryImageSchema = z.object({
  slug: CategorySlugSchema,
  image_url: z.string().min(1),
  alt: z.string().default(""),
  title: z.string().default(""),
  description: z.string().default(""),
});

export const saveCategoryImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SaveCategoryImageSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabase } = context;
    const { error } = await supabase.from("category_images").upsert(
      {
        slug: data.slug,
        image_url: data.image_url,
        alt: data.alt,
        title: data.title,
        description: data.description,
      },
      { onConflict: "slug" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// -------- Utility: sort Shopify products by saved order --------
export function applyProductOrder<T extends { node: { handle: string } }>(
  products: T[],
  order: Array<{ product_handle: string; position: number }>,
): T[] {
  if (order.length === 0) return products;
  const rank = new Map(order.map((o) => [o.product_handle, o.position]));
  return [...products].sort((a, b) => {
    const ra = rank.get(a.node.handle) ?? Number.MAX_SAFE_INTEGER;
    const rb = rank.get(b.node.handle) ?? Number.MAX_SAFE_INTEGER;
    return ra - rb;
  });
}
