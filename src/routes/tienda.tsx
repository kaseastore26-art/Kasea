import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Package } from "lucide-react";
import { formatPrice, type ShopifyProduct } from "@/lib/shopify";

import { useServerFn } from "@tanstack/react-start";
import { getProductsPublic } from "@/lib/catalog.functions";
import { FavoriteButton } from "@/components/FavoriteButton";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/tienda")({
  // Los productos se cargan ya en el servidor: así Google los ve en el HTML.
  loader: async () => {
    try {
      return { products: (await getProductsPublic()) as ShopifyProduct[] };
    } catch {
      return { products: null };
    }
  },
  validateSearch: (search: Record<string, unknown>): { q?: string } =>
    typeof search.q === "string" && search.q ? { q: search.q } : {},
  head: () =>
    seo({
      title: "Tienda online de fundas para iPhone y accesorios | Kasea Store",
      description:
        "Explora toda la colección Kasea: fundas premium para iPhone diseñadas con materiales seleccionados. Envío a España.",
      path: "/tienda",
    }),
  component: ShopPage,
});

function Card({ product }: { product: ShopifyProduct }) {
  const p = product.node;
  const img = p.images.edges[0]?.node;
  const second = p.images.edges[1]?.node;


  return (
    <div className="group relative">
      <FavoriteButton product={product} className="absolute right-2 top-2 z-10" />
      <Link to="/product/$handle" params={{ handle: p.handle }} className="block">
        <div className="relative overflow-hidden bg-white aspect-[4/5] mb-4 rounded-xl">
          {img ? (
            <img src={img.url} alt={img.altText ?? p.title} loading="lazy" className="absolute inset-0 w-full h-full object-contain p-3 md:p-5 transition-transform duration-700 group-hover:scale-105" />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-sand/50 to-accent/40" />
          )}
          {second && (
            <img src={second.url} alt={second.altText ?? p.title} loading="lazy" className="absolute inset-0 w-full h-full object-contain p-3 md:p-5 opacity-0 transition-opacity duration-700 group-hover:opacity-100" />
          )}
        </div>
        <div className="flex items-baseline justify-between">
          <h3 className="font-display text-lg">{p.title}</h3>
          <span className="text-sm tabular-nums">{formatPrice(p.priceRange.minVariantPrice.amount, p.priceRange.minVariantPrice.currencyCode)}</span>
        </div>
      </Link>
    </div>
  );
}

function ShopPage() {
  const productsFn = useServerFn(getProductsPublic);
  // El orden lo define `products.position` (las flechas del panel de admin).
  // getProductsPublic ya devuelve los productos ordenados por esa posición.
  const { data: ordered = [], isLoading } = useQuery({
    queryKey: ["products", "shop"],
    queryFn: async () => (await productsFn()) as ShopifyProduct[],
    initialData: Route.useLoaderData().products ?? undefined,
  });
  const { q } = Route.useSearch();
  const products = q
    ? ordered.filter((p) => p.node.title.toLowerCase().includes(q.toLowerCase()))
    : ordered;

  return (
    <div className="container-luxe py-16 md:py-24">
      <header className="text-center max-w-2xl mx-auto mb-16">
        <p className="eyebrow mb-3">La tienda</p>
        <h1 className="font-display text-5xl md:text-6xl">Toda la colección</h1>
        <p className="mt-4 text-muted-foreground">
          Fundas premium diseñadas para cada modelo. Selecciona la tuya.
        </p>
      </header>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 md:gap-8">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-[4/5] bg-sand/40 animate-pulse" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="border border-dashed border-border py-24 text-center bg-sand/20 max-w-2xl mx-auto">
          <Package className="h-12 w-12 mx-auto text-muted-foreground" strokeWidth={1} />
          <h2 className="font-display text-3xl mt-4">Aún no hay productos</h2>
          <p className="text-sm text-muted-foreground mt-3 max-w-md mx-auto">
            Aún no hay productos publicados. Añádelos desde el panel de administración —nombre, descripción, precio y stock— y aparecerán aquí.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 md:gap-8">
          {products.map((p) => <Card key={p.node.id} product={p} />)}
        </div>
      )}
    </div>
  );
}
