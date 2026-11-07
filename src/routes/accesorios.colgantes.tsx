import { createFileRoute } from "@tanstack/react-router";
import { AccessoryCategoryPage } from "@/components/AccessoryCategoryPage";
import { getAccessoriesProductsPublic } from "@/lib/catalog.functions";
import type { ShopifyProduct } from "@/lib/shopify";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/accesorios/colgantes")({
  head: () =>
    seo({
      title: "Cuerdas y colgantes para el móvil | Kasea Store",
      description: "Cuerdas y colgantes para llevar el móvil cómodo y con estilo. Combínalos con tu funda Kasea y el envío es gratis.",
      path: "/accesorios/colgantes",
    }),
  // Los productos se cargan ya en el servidor: así Google los ve en el HTML.
  loader: async () => {
    try {
      return { products: (await getAccessoriesProductsPublic()) as ShopifyProduct[] };
    } catch {
      return { products: null };
    }
  },
  component: function AccesoriosPage() {
    const { products } = Route.useLoaderData();
    return <AccessoryCategoryPage category="colgantes" initialProducts={products} />;
  },
});
