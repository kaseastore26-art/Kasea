import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { SITE_URL } from "@/lib/seo";

function csvEscape(value: unknown): string {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

export const Route = createFileRoute("/meta-products.csv")({
  server: {
    handlers: {
      GET: async () => {
        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_PUBLISHABLE_KEY;

        if (!url || !key) {
          return new Response("Supabase no configurado", { status: 500 });
        }

        const supabase = createClient(url, key, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        });

        const { data, error } = await supabase
          .from("products")
          .select(`
            id,
            handle,
            title,
            description,
            currency,
            product_variants (
              id,
              title,
              price_cents,
              currency,
              stock,
              sku,
              position
            ),
            product_images (
              url,
              position
            ),
            tags,
            product_collections (
              position,
              collections (
                title
              )
            )
          `)
          .eq("status", "active")
          .eq("is_custom", false)
          .order("position", { ascending: true });

        if (error) {
          return new Response(`Error: ${error.message}`, { status: 500 });
        }

        const headers = [
          "id",
          "title",
          "description",
          "availability",
          "condition",
          "price",
          "link",
          "image_link",
          "brand",
          "product_type",
          "item_group_id",
          "sku",
        ];

        const rows: string[] = [headers.join(",")];

        for (const product of data ?? []) {
          const variants = [...(product.product_variants ?? [])].sort(
            (a, b) => a.position - b.position,
          );

          const images = [...(product.product_images ?? [])].sort(
            (a, b) => a.position - b.position,
          );

          const mainImage = images[0]?.url ?? "";

          const collections = [...(product.product_collections ?? [])].sort(
            (a, b) => a.position - b.position,
          );

          const tags = (product.tags ?? []).map((tag) =>
            String(tag).trim().toLowerCase()
          );

          const accessoryTags = [
            "accesorios",
            "colgantes",
            "protectores",
            "cargadores",
            "otros",
          ];

          // Excluir accesorios del catálogo publicitario de fundas.
          if (tags.some((tag) => accessoryTags.includes(tag))) {
            continue;
          }

          const collectionsText = collections
            .map((c) => c.collections?.title ?? "")
            .join(" ")
            .toLowerCase();

          const isSublimacion = tags.some((tag) =>
            tag.includes("sublim")
          );

          const isFundas =
            tags.some((tag) =>
              ["fundas", "fundas para móviles", "fundas para moviles",
               "transparentes", "fundas-sublimacion"].includes(tag)
            ) ||
            isSublimacion ||
            (tags.length === 0 && /fundas|sublim/.test(collectionsText));

          if (!isFundas) {
            continue;
          }

          const productType = isSublimacion
            ? "fundas-sublimacion"
            : "fundas para móviles";

          const productLink = isSublimacion
            ? `${SITE_URL}/product/${product.handle}?collection=fundas-sublimacion`
            : `${SITE_URL}/product/${product.handle}`;

          for (const variant of variants) {
            const currency = variant.currency || product.currency || "EUR";
            const price = `${(variant.price_cents / 100).toFixed(2)} ${currency}`;
            const availability =
              variant.stock > 0 ? "in stock" : "out of stock";

            rows.push(
              [
                variant.id,
                product.title,
                product.description || "",
                availability,
                "new",
                price,
                productLink,
                mainImage,
                "Kasea",
                productType,
                product.id,
                variant.sku || variant.title || "",
              ]
                .map(csvEscape)
                .join(","),
            );
          }
        }

        const csv = rows.join("\n");

        return new Response(csv, {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Cache-Control": "public, max-age=300",
          },
        });
      },
    },
  },
});
