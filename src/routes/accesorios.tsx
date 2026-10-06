import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Eye, Package } from "lucide-react";
import { FavoriteButton } from "@/components/FavoriteButton";
import { formatPrice, type ShopifyProduct } from "@/lib/shopify";
import { getAccessoriesProductsPublic } from "@/lib/catalog.functions";
import { seo } from "@/lib/seo";
import { listCategoryImagesPublic } from "@/lib/admin.functions";

function ProductCard({ product }: { product: ShopifyProduct }) {
  const p = product.node;
  const img = p.images.edges[0]?.node;
  const second = p.images.edges[1]?.node;

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

export const Route = createFileRoute("/accesorios")({
  head: () =>
    seo({
      title: "Accesorios para móvil — Kasea Store",
      description:
        "Descubre colgantes, protectores y cargadores para tu móvil. Accesorios Kasea que combinan diseño, utilidad y estilo.",
      path: "/accesorios",
    }),

  component: AccessoriesPage,
});

function AccessoriesPage() {
  const accessoriesFn = useServerFn(getAccessoriesProductsPublic);
  const categoryImagesFn = useServerFn(listCategoryImagesPublic);

  const { data, isLoading } = useQuery({
    queryKey: ["products", "accesorios"],
    queryFn: async () => accessoriesFn(),
  });

  const { data: categoryImages } = useQuery({
    queryKey: ["public", "category-images"],
    queryFn: async () => categoryImagesFn(),
  });

  const products = data ?? [];

  const imageMap = new Map(
    (categoryImages ?? []).map((item) => [item.slug, item]),
  );

  const categories = [
    {
      slug: "colgantes",
      title: "Colgantes",
      description: "Dale personalidad a tu móvil con nuestros colgantes.",
    },
    {
      slug: "protectores",
      title: "Protectores",
      description: "Protección práctica para tu móvil, sin renunciar al diseño.",
    },
    {
      slug: "cargadores",
      title: "Cargadores",
      description: "Carga tu móvil con accesorios pensados para el día a día.",
    },
  ] as const;

  const productsByCategory = (slug: string) =>
    products.filter((product) => product.node.tags?.includes(slug));

  return (
    <div className="container-luxe py-16 md:py-24">
      <header className="mx-auto mb-14 max-w-3xl text-center">
        <p className="eyebrow mb-3">Colección</p>

        <h1 className="font-display text-5xl md:text-6xl">
          Accesorios
        </h1>

        <p className="mt-4 text-muted-foreground">
          Todo lo que tu móvil necesita: colgantes, protectores y cargadores
          que combinan diseño, utilidad y estilo Kasea.
        </p>
      </header>

      <section className="mb-20 grid grid-cols-1 gap-6 md:grid-cols-3">
        {categories.map((category) => {
          const image = imageMap.get(category.slug);

          return (
            <a
              key={category.slug}
              href={`#${category.slug}`}
              className="group overflow-hidden rounded-xl border border-border bg-card"
            >
              <div className="aspect-[4/5] overflow-hidden bg-secondary">
                {image?.image_url ? (
                  <img
                    src={image.image_url}
                    alt={image.alt || category.title}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center bg-sand/30">
                    <span className="font-display text-2xl text-muted-foreground">
                      {category.title}
                    </span>
                  </div>
                )}
              </div>

              <div className="p-6">
                <p className="font-display text-2xl">
                  {image?.title || category.title}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {category.description}
                </p>
                <span className="mt-5 inline-block text-xs font-semibold uppercase tracking-[0.14em]">
                  Ver productos →
                </span>
              </div>
            </a>
          );
        })}
      </section>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4 md:gap-8">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="aspect-[4/5] animate-pulse rounded-xl bg-sand/40"
            />
          ))}
        </div>
      ) : (
        <div className="space-y-24">
          {categories.map((category) => {
            const categoryProducts = productsByCategory(category.slug);

            if (categoryProducts.length === 0) return null;

            return (
              <section key={category.slug} id={category.slug} className="scroll-mt-24">
                <div className="mb-8 flex items-end justify-between gap-4">
                  <div>
                    <p className="eyebrow mb-2">Accesorios</p>
                    <h2 className="font-display text-4xl md:text-5xl">
                      {category.title}
                    </h2>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4 md:gap-8 animate-fade-in">
                  {categoryProducts.map((product) => (
                    <ProductCard key={product.node.id} product={product} />
                  ))}
                </div>
              </section>
            );
          })}

          {products.length === 0 && (
            <div className="mx-auto max-w-2xl rounded-xl border border-dashed border-border bg-sand/20 py-20 text-center">
              <Package
                className="mx-auto h-10 w-10 text-muted-foreground"
                strokeWidth={1}
              />

              <h2 className="mt-4 font-display text-2xl">
                Aún no hay accesorios
              </h2>

              <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
                Añade productos desde el panel de administración y asígnales las
                categorías Colgantes, Protectores o Cargadores.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
