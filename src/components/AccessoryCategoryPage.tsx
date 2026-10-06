import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Eye, Package } from "lucide-react";
import { FavoriteButton } from "@/components/FavoriteButton";
import { formatPrice, type ShopifyProduct } from "@/lib/shopify";
import { getAccessoriesProductsPublic } from "@/lib/catalog.functions";

type Category = "colgantes" | "protectores" | "cargadores" | "otros";

const CATEGORY_INFO: Record<Category, { title: string; description: string }> = {
  colgantes: {
    title: "Cuerdas para el móvil",
    description: "Dale personalidad a tu móvil con nuestras cuerdas para el móvil.",
  },
  protectores: {
    title: "Protectores",
    description: "Protección práctica para tu móvil, sin renunciar al diseño.",
  },
  cargadores: {
    title: "Cargadores",
    description: "Carga tu móvil con accesorios pensados para el día a día.",
  },
  otros: {
    title: "Otros accesorios",
    description: "Encuentra otros accesorios útiles para tu móvil.",
  },
};

function ProductCard({ product }: { product: ShopifyProduct }) {
  const p = product.node;
  const img = p.images.edges[0]?.node;

  return (
    <div className="group relative flex flex-col">
      <FavoriteButton product={product} className="absolute right-2 top-2 z-10" />

      <Link
        to="/product/$handle"
        params={{ handle: p.handle }}
        search={{ collection: "accesorios" }}
        className="relative mb-4 block aspect-[4/5] overflow-hidden rounded-xl bg-white"
      >
        {img ? (
          <img
            src={img.url}
            alt={img.altText ?? p.title}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-contain p-3 transition-transform duration-700 group-hover:scale-105 md:p-5"
          />
        ) : (
          <div className="absolute inset-0 bg-sand/30" />
        )}
      </Link>

      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-lg leading-tight">{p.title}</h2>
        <span className="text-sm tabular-nums text-foreground/80">
          {formatPrice(
            p.priceRange.minVariantPrice.amount,
            p.priceRange.minVariantPrice.currencyCode,
          )}
        </span>
      </div>

      <div className="mt-4">
        <Link
          to="/product/$handle"
          params={{ handle: p.handle }}
          search={{ collection: "accesorios" }}
          className="inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-medium uppercase tracking-[0.14em] transition-colors hover:bg-secondary"
        >
          <Eye className="h-3.5 w-3.5" strokeWidth={1.5} />
          Ver producto
        </Link>
      </div>
    </div>
  );
}

export function AccessoryCategoryPage({ category }: { category: Category }) {
  const accessoriesFn = useServerFn(getAccessoriesProductsPublic);

  const { data, isLoading } = useQuery({
    queryKey: ["products", "accesorios", category],
    queryFn: async () => accessoriesFn(),
  });

  const products = (data ?? []).filter((product) =>
    product.node.tags?.includes(category),
  );

  const info = CATEGORY_INFO[category];

  return (
    <div className="container-luxe py-16 md:py-24">
      <header className="mx-auto mb-14 max-w-3xl text-center">
        <p className="eyebrow mb-3">Accesorios</p>
        <h1 className="font-display text-5xl md:text-6xl">{info.title}</h1>
        <p className="mt-4 text-muted-foreground">{info.description}</p>

        <div className="mt-8 flex justify-center gap-6 text-xs uppercase tracking-[0.14em]">
          <Link to="/accesorios/colgantes" className="hover:underline">
            Cuerdas para el móvil
          </Link>
          <Link to="/accesorios/protectores" className="hover:underline">
            Protectores
          </Link>
          <Link to="/accesorios/cargadores" className="hover:underline">
            Cargadores
          </Link>
          <Link to="/accesorios/otros" className="hover:underline">
            Otros accesorios
          </Link>
        </div>
      </header>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4 md:gap-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="aspect-[4/5] animate-pulse rounded-xl bg-sand/40"
            />
          ))}
        </div>
      ) : products.length > 0 ? (
        <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4 md:gap-8">
          {products.map((product) => (
            <ProductCard key={product.node.id} product={product} />
          ))}
        </div>
      ) : (
        <div className="mx-auto max-w-2xl rounded-xl border border-dashed border-border bg-sand/20 py-20 text-center">
          <Package
            className="mx-auto h-10 w-10 text-muted-foreground"
            strokeWidth={1}
          />
          <h2 className="mt-4 font-display text-2xl">
            Aún no hay {info.title.toLowerCase()}
          </h2>
        </div>
      )}
    </div>
  );
}
