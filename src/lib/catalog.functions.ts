// ============================================================================
// Capa de datos del CATÁLOGO — lee de Supabase (reemplaza a Shopify).
//
// Devuelve EXACTAMENTE el mismo shape `ShopifyProduct` que ya consumía la UI,
// de modo que las páginas (index, tienda, product.$handle, colecciones…) no
// cambian su forma de pintar. Solo cambia la fuente: Shopify -> Supabase.
//
// A diferencia de Shopify, aquí SÍ tenemos el stock real: `availableForSale`
// y `quantityAvailable` salen de product_variants.stock. Esto arregla de raíz
// el bug de "stock 0" que daba el token Storefront (sin permiso de inventario).
// ============================================================================
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import type { ShopifyProduct } from "@/lib/shopify";

// Cliente de solo lectura con la publishable key (respeta RLS: solo 'active').
function publicClient() {
  return createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

// Céntimos (int) -> string tipo Shopify ("14.99").
function centsToAmount(cents: number): string {
  return (cents / 100).toFixed(2);
}

// Filas tal como las devuelve el select anidado de Supabase.
type VariantRow = {
  id: string;
  title: string;
  price_cents: number;
  currency: string;
  stock: number;
  selected_options: unknown;
  position: number;
};
type ImageRow = { url: string; alt: string; position: number };
type CollectionJoinRow = {
  position: number;
  collections: { handle: string; title: string } | null;
};
type ProductRow = {
  id: string;
  handle: string;
  title: string;
  description: string;
  tags: string[];
  currency: string;
  status: string;
  position: number;
  product_variants: VariantRow[];
  product_images: ImageRow[];
  product_collections: CollectionJoinRow[];
};

const PRODUCT_SELECT = `
  id, handle, title, description, tags, currency, status, position,
  product_variants ( id, title, price_cents, currency, stock, selected_options, position ),
  product_images ( url, alt, position ),
  product_collections ( position, collections ( handle, title ) )
` as const;

// Convierte una fila de Supabase al shape `ShopifyProduct` que usa la UI.
function rowToShopifyProduct(row: ProductRow): ShopifyProduct {
  const variants = [...(row.product_variants ?? [])].sort((a, b) => a.position - b.position);
  const images = [...(row.product_images ?? [])].sort((a, b) => a.position - b.position);
  const currency = row.currency || "EUR";

  const minCents = variants.length
    ? Math.min(...variants.map((v) => v.price_cents))
    : 0;

  return {
    node: {
      id: row.id,
      title: row.title,
      description: row.description ?? "",
      handle: row.handle,
      tags: row.tags ?? [],
      collections: {
        edges: (row.product_collections ?? [])
          .filter((c) => c.collections)
          .sort((a, b) => a.position - b.position)
          .map((c) => ({ node: { title: c.collections!.title, handle: c.collections!.handle } })),
      },
      priceRange: {
        minVariantPrice: { amount: centsToAmount(minCents), currencyCode: currency },
      },
      images: {
        edges: images.map((img) => ({ node: { url: img.url, altText: img.alt || null } })),
      },
      variants: {
        edges: variants.map((v) => {
          const opts = Array.isArray(v.selected_options)
            ? (v.selected_options as Array<{ name: string; value: string }>)
            : [{ name: "Title", value: "Default Title" }];
          return {
            node: {
              id: v.id,
              title: v.title,
              price: { amount: centsToAmount(v.price_cents), currencyCode: v.currency || currency },
              // Stock REAL: la fuente de verdad ahora es Supabase, no Shopify.
              availableForSale: v.stock > 0,
              quantityAvailable: v.stock,
              selectedOptions: opts,
            },
          };
        }),
      },
      options: [
        { name: "Title", values: variants.map((v) => v.title) },
      ],
    },
  };
}

// -------- Todos los productos (catálogo público) --------
// Excluye la funda personalizada (is_custom): esa se compra desde /personalizar.
export const getProductsPublic = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = publicClient();
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("status", "active")
    .eq("is_custom", false)
    .order("position", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as ProductRow[]).map(rowToShopifyProduct);
});

// -------- "Lo más vendido": catálogo ORDENADO por ventas reales --------
// Muestra los mismos productos, ordenados de más a menos vendido (pedidos
// pagados). No expone cantidades. Orden estable: los productos sin ventas
// quedan detrás, en el orden normal del catálogo.
export const getBestSellingPublic = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = publicClient();
  const [productsRes, rankingRes] = await Promise.all([
    supabase
      .from("products")
      .select(PRODUCT_SELECT)
      .eq("status", "active")
      .eq("is_custom", false)
      .order("position", { ascending: true }),
    supabase.rpc("product_sales_ranking"),
  ]);
  if (productsRes.error) throw new Error(productsRes.error.message);
  if (rankingRes.error) throw new Error(rankingRes.error.message);

  const products = ((productsRes.data ?? []) as unknown as ProductRow[]).map(rowToShopifyProduct);
  const unitsById = new Map<string, number>(
    ((rankingRes.data ?? []) as Array<{ product_id: string; units: number }>).map((r) => [
      r.product_id,
      Number(r.units),
    ]),
  );
  return [...products].sort(
    (a, b) => (unitsById.get(b.node.id) ?? 0) - (unitsById.get(a.node.id) ?? 0),
  );
});

// -------- Ajustes públicos de la tienda (regla de envío, editable en admin) --------
export const getShopSettingsPublic = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = publicClient();
  const { data, error } = await supabase
    .from("shop_settings")
    .select("shipping_flat_cents, shipping_nacex_cents, shipping_free_threshold_cents")
    .eq("id", "default")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return {
    shippingFlatCents: data?.shipping_flat_cents ?? 699,
    shippingNacexCents: data?.shipping_nacex_cents ?? 499,
    freeThresholdCents: data?.shipping_free_threshold_cents ?? 5500,
 };
});

// -------- Un producto por handle (ficha) --------
export const getProductByHandlePublic = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ handle: z.string().min(1) }).parse(d))
  .handler(async ({ data }): Promise<ShopifyProduct | null> => {
    const supabase = publicClient();
    const { data: rows, error } = await supabase
      .from("products")
      .select(PRODUCT_SELECT)
      .eq("handle", data.handle)
      .eq("status", "active")
      .limit(1);
    if (error) throw new Error(error.message);
    const row = (rows ?? [])[0] as unknown as ProductRow | undefined;
    return row ? rowToShopifyProduct(row) : null;
  });

// -------- Productos de una colección --------
export const getCollectionProductsPublic = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ handle: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const { data: col, error: colErr } = await supabase
      .from("collections")
      .select("id, title, description")
      .eq("handle", data.handle)
      .maybeSingle();
    if (colErr) throw new Error(colErr.message);
    if (!col) return { title: "", description: "", products: [] as ShopifyProduct[] };

    const { data: links, error: linkErr } = await supabase
      .from("product_collections")
      .select(`position, products ( ${PRODUCT_SELECT} )`)
      .eq("collection_id", col.id)
      .order("position", { ascending: true });
    if (linkErr) throw new Error(linkErr.message);

    const products = ((links ?? []) as unknown as Array<{ products: ProductRow | null }>)
      .map((l) => l.products)
      .filter((p): p is ProductRow => !!p && p.status === "active")
      // Orden GLOBAL del catálogo (products.position = flechas del panel), para
      // que la colección se ordene igual que la tienda y el admin.
      .sort((a, b) => a.position - b.position)
      .map(rowToShopifyProduct);

    return { title: col.title, description: col.description ?? "", products };
  });
