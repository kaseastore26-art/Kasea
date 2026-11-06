import { createFileRoute } from "@tanstack/react-router";
import { AccessoryCategoryPage } from "@/components/AccessoryCategoryPage";
import { getAccessoriesProductsPublic } from "@/lib/catalog.functions";
import type { ShopifyProduct } from "@/lib/shopify";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/accesorios/cargadores")({
  head: () =>
    seo({
      title: "Cargadores para iPhone y móvil | Kasea Store",
      description: "Cargadores para iPhone y móvil para el día a día. Compra online en Kasea Store con envío a toda España y envío gratis comprando 2 productos.",
      path: "/accesorios/cargadores",
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
    return <AccessoryCategoryPage category="cargadores" initialProducts={products} />;
  },
});
