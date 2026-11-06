import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { formatPrice, type ShopifyProduct } from "@/lib/shopify";
import { getBestSellingPublic } from "@/lib/catalog.functions";
import { FavoriteButton } from "@/components/FavoriteButton";
import { seo } from "@/lib/seo";

// Máximo de productos a mostrar en "Lo más vendido" (cámbialo a 15 si prefieres).
const MAX_BEST_SELLING = 20;

export const Route = createFileRoute("/mas-vendido")({
  head: () =>
    seo({
      title: "Fundas para iPhone más vendidas | Kasea Store",
      description:
        "Descubre las fundas más vendidas de Kasea Store: los diseños favoritos de nuestros clientes para iPhone.",
      path: "/mas-vendido",
    }),
  component: BestSellingPage,
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

function BestSellingPage() {
  const bestSellingFn = useServerFn(getBestSellingPublic);
  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products", "best-selling"],
    queryFn: async () => (await bestSellingFn()) as ShopifyProduct[],
  });

  return (
    <div className="container-luxe py-16 md:py-24">
      <header className="text-center max-w-2xl mx-auto mb-16">
        <p className="eyebrow mb-3">Los favoritos</p>
        <h1 className="font-display text-5xl md:text-6xl">Lo más vendido</h1>
        <p className="mt-4 text-muted-foreground">
          Los diseños que más enamoran a nuestros clientes. Descubre por qué son un éxito.
        </p>
      </header>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 md:gap-8">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-[4/5] bg-sand/40 animate-pulse rounded-xl" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <p className="text-center text-muted-foreground">No hay productos disponibles.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 md:gap-8">
          {products.slice(0, MAX_BEST_SELLING).map((p) => (
            <Card key={p.node.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
