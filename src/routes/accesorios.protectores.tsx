import { createFileRoute } from "@tanstack/react-router";
import { AccessoryCategoryPage } from "@/components/AccessoryCategoryPage";
import { getAccessoriesProductsPublic } from "@/lib/catalog.functions";
import type { ShopifyProduct } from "@/lib/shopify";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/accesorios/protectores")({
  head: () =>
    seo({
      title: "Protectores para iPhone y móvil | Kasea Store",
      description: "Protectores para iPhone y móvil: protección práctica sin renunciar al diseño. Compra online en Kasea Store con envío a toda España.",
      path: "/accesorios/protectores",
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
    return <AccessoryCategoryPage category="protectores" initialProducts={products} />;
  },
});
