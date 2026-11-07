import { createFileRoute } from "@tanstack/react-router";
import { AccessoryCategoryPage } from "@/components/AccessoryCategoryPage";
import { getAccessoriesProductsPublic } from "@/lib/catalog.functions";
import type { ShopifyProduct } from "@/lib/shopify";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/accesorios/otros")({
  head: () =>
    seo({
      title: "Otros accesorios para iPhone y móvil | Kasea Store",
      description: "Otros accesorios útiles para tu iPhone y tu móvil. Compra online en Kasea Store con envío a toda España y envío gratis si lo combinas con una funda.",
      path: "/accesorios/otros",
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
    return <AccessoryCategoryPage category="otros" initialProducts={products} />;
  },
});
