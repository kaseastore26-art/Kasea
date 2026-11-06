import { createFileRoute } from "@tanstack/react-router";
import { CollectionPage } from "@/components/CollectionPage";
import { seo } from "@/lib/seo";
import { getProductsPublic } from "@/lib/catalog.functions";
import type { ShopifyProduct } from "@/lib/shopify";

export const Route = createFileRoute("/fundas-sublimacion")({
  // Los productos se cargan ya en el servidor: así Google los ve en el HTML.
  loader: async () => {
    try {
      return { products: (await getProductsPublic()) as ShopifyProduct[] };
    } catch {
      return { products: null };
    }
  },
  head: () =>
    seo({
      title: "Fundas para iPhone con diseños exclusivos | Kasea Store",
      description:
        "Fundas para iPhone con diseños exclusivos y colores vivos, impresas por sublimación 3D. Elige tu diseño y tu modelo de iPhone, o personalízala con tu propia foto.",
      path: "/fundas-sublimacion",
    }),
  component: FundasSublimacionPage,
});

function FundasSublimacionPage() {
  const { products } = Route.useLoaderData();
  return (
    <CollectionPage
      initialProducts={products}
      collectionHandle="fundas-sublimacion"
      source="all"
      excludeTags={["accesorios", "colgantes", "protectores", "cargadores", "otros"]}
      eyebrow="Colección"
      title="Fundas para iPhone"
      intro="Convierte tu funda en una pieza única. Ideales para personalizar con fotografías, ilustraciones o diseños propios."
    />
  );
}
