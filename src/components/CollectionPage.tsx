import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Package, Eye } from "lucide-react";
import { formatPrice, type ShopifyProduct } from "@/lib/shopify";
import { getCollectionProductsPublic, getProductsPublic } from "@/lib/catalog.functions";
import { FavoriteButton } from "@/components/FavoriteButton";

interface Props {
  collectionHandle: string;
  eyebrow: string;
  title: string;
  intro: string;
  // "all" = muestra TODO el catálogo activo (recomendado con una sola colección:
  // así los productos nuevos del panel aparecen siempre, sin depender de enlaces
  // de colección). "collection" = solo los productos enlazados a la colección.
  source?: "collection" | "all";
  includeTags?: string[];
  excludeTags?: string[];
}

function ProductCard({ product, collectionHandle }: { product: ShopifyProduct; collectionHandle: string }) {
  const p = product.node;
  const img = p.images.edges[0]?.node;
  const second = p.images.edges[1]?.node;

  return (
    <div className="group relative flex flex-col">
      <FavoriteButton product={product} className="absolute right-2 top-2 z-10" />
      <Link
        to="/product/$handle"
        params={{ handle: p.handle }}
        search={{ collection: collectionHandle }}
        className="relative mb-4 aspect-[4/5] overflow-hidden rounded-xl bg-white block"
      >
        {img ? (
          <img
            src={img.url}
            alt={img.altText ?? p.title}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-contain p-3 transition-transform duration-700 group-hover:scale-105 md:p-5"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-sand/50 to-accent/40" />
        )}
        {second && (
          <img
            src={second.url}
            alt={second.altText ?? p.title}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-contain p-3 opacity-0 transition-opacity duration-700 group-hover:opacity-100 md:p-5"
          />
        )}
      </Link>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-display text-lg leading-tight">{p.title}</h3>
        <span className="text-sm tabular-nums text-foreground/80">
          {formatPrice(p.priceRange.minVariantPrice.amount, p.priceRange.minVariantPrice.currencyCode)}
        </span>
      </div>
      <div className="mt-4">
        <Link
          to="/product/$handle"
          params={{ handle: p.handle }}
          search={{ collection: collectionHandle }}
          className="inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-medium tracking-[0.14em] uppercase transition-colors hover:bg-secondary"
        >
          <Eye className="h-3.5 w-3.5" strokeWidth={1.5} /> Ver producto
        </Link>
      </div>
    </div>
  );
}

export function CollectionPage({ collectionHandle, eyebrow, title, intro, source = "collection", includeTags, excludeTags }: Props) {
  const collectionFn = useServerFn(getCollectionProductsPublic);
  const allFn = useServerFn(getProductsPublic);
  const { data, isLoading } = useQuery({
    queryKey: source === "all" ? ["products", "collectionpage-all"] : ["collection", collectionHandle],
    queryFn: async () => {
      if (source === "all") {
        // Todo el catálogo activo (mismos productos que /tienda, ordenados por
        // products.position). Garantiza que lo que subes en el panel aparece aquí.
        const products = (await allFn()) as ShopifyProduct[];
        return { products, missing: products.length === 0 };
      }
      const res = await collectionFn({ data: { handle: collectionHandle } });
      return { products: res.products as ShopifyProduct[], missing: res.products.length === 0 };
    },
  });

  // El orden lo define products.position (las flechas del panel), ya aplicado en
  // el servidor tanto por getProductsPublic como por getCollectionProductsPublic.
  const products = (data?.products ?? []).filter((product) => {
    const tags = product.node.tags ?? [];
    const matchesInclude = !includeTags || includeTags.some((tag) => tags.includes(tag));
    const matchesExclude = !excludeTags || !tags.some((tag) => excludeTags.includes(tag));
    return matchesInclude && matchesExclude;
  });


  return (
    <div className="container-luxe py-16 md:py-24">
      <header className="mx-auto mb-14 max-w-2xl text-center">
        <p className="eyebrow mb-3">{eyebrow}</p>
        <h1 className="font-display text-5xl md:text-6xl">{title}</h1>
        <p className="mt-4 text-muted-foreground">{intro}</p>
      </header>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4 md:gap-8">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-[4/5] animate-pulse rounded-xl bg-sand/40" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="mx-auto max-w-2xl rounded-xl border border-dashed border-border bg-sand/20 py-20 text-center">
          <Package className="mx-auto h-10 w-10 text-muted-foreground" strokeWidth={1} />
          <h2 className="mt-4 font-display text-2xl">Aún no hay productos en esta categoría</h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
            En cuanto añadas productos a la colección <span className="font-medium text-foreground">{collectionHandle}</span> desde el panel, aparecerán aquí automáticamente.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4 md:gap-8 animate-fade-in">
          {products.map((p) => <ProductCard key={p.node.id} product={p} collectionHandle={collectionHandle} />)}
        </div>
      )}
    </div>
  );
}
