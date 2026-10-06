import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Package, ChevronLeft, ChevronRight, X } from "lucide-react";
import { formatPrice, type ShopifyProduct } from "@/lib/shopify";
import { getProductsPublic } from "@/lib/catalog.functions";
import { seo } from "@/lib/seo";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export const Route = createFileRoute("/fundas-movil")({
  head: () =>
    seo({
      title: "Fundas de móvil para iPhone | Kasea Store",
      description:
        "Colección de fundas de móvil premium para iPhone: diseño, protección y estilo Kasea.",
      path: "/fundas-movil",
    }),
  component: FundasPage,
});

type SortKey = "RELEVANCE" | "PRICE_ASC" | "PRICE_DESC" | "TITLE" | "CREATED_AT" | "BEST_SELLING";

interface FundaNode extends ShopifyProduct {
  node: ShopifyProduct["node"] & {
    compareAtPriceRange?: { minVariantPrice: { amount: string; currencyCode: string } };
    variants: {
      edges: Array<{
        node: ShopifyProduct["node"]["variants"]["edges"][number]["node"] & {
          compareAtPrice?: { amount: string; currencyCode: string } | null;
        };
      }>;
    };
  };
}

// Ordenación en cliente (Supabase reemplaza el sortKey de Shopify).
function sortFundas(products: FundaNode[], sort: SortKey): FundaNode[] {
  const price = (p: FundaNode) => parseFloat(p.node.priceRange.minVariantPrice.amount);
  const arr = [...products];
  switch (sort) {
    case "PRICE_ASC":
      return arr.sort((a, b) => price(a) - price(b));
    case "PRICE_DESC":
      return arr.sort((a, b) => price(b) - price(a));
    case "TITLE":
      return arr.sort((a, b) => a.node.title.localeCompare(b.node.title, "es"));
    default:
      return arr; // RELEVANCE / CREATED_AT / BEST_SELLING → orden del catálogo
  }
}

function FundasPage() {
  const [sort, setSort] = useState<SortKey>("RELEVANCE");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [lightbox, setLightbox] = useState<{ product: FundaNode; index: number } | null>(null);

  const productsFn = useServerFn(getProductsPublic);
  const { data: products = [], isLoading } = useQuery({
    queryKey: ["fundas", sort],
    queryFn: async () => {
      const all = (await productsFn()) as FundaNode[];
      // Fundas: mostrar todos los productos que no pertenezcan a una categoría de accesorios.
      // Las fundas existentes pueden tener tags "Fundas", "SUBLIMACIÓN" o no tener tags.
      // Los accesorios se mantienen fuera de esta sección.
      const accessoryTags = ["accesorios", "colgantes", "protectores", "cargadores", "otros"];
      const fundas = all.filter((p) => {
        const tags = p.node.tags ?? [];
        return !tags.some((tag) => accessoryTags.includes(tag.toLowerCase()));
      });
      return sortFundas(fundas, sort);
    },
  });

  const filtered = useMemo(() => {
    const min = minPrice ? parseFloat(minPrice) : -Infinity;
    const max = maxPrice ? parseFloat(maxPrice) : Infinity;
    return products.filter((p) => {
      const price = parseFloat(p.node.priceRange.minVariantPrice.amount);
      return price >= min && price <= max;
    });
  }, [products, minPrice, maxPrice]);

  return (
    <div className="container-luxe py-16 md:py-24">
      <header className="text-center max-w-2xl mx-auto mb-12">
        <p className="eyebrow mb-3">La colección</p>
        <h1 className="font-display text-5xl md:text-6xl">Fundas de móvil</h1>
        <p className="mt-4 text-muted-foreground">
          Fundas premium diseñadas para proteger tu iPhone o Samsung con el estilo Kasea.
        </p>
      </header>

      <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Precio mín.
            </label>
            <Input
              type="number"
              inputMode="decimal"
              placeholder="0"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              className="h-10 w-28"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Precio máx.
            </label>
            <Input
              type="number"
              inputMode="decimal"
              placeholder="∞"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              className="h-10 w-28"
            />
          </div>
          {(minPrice || maxPrice) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setMinPrice("");
                setMaxPrice("");
              }}
            >
              Limpiar
            </Button>
          )}
        </div>

        <div className="flex items-end gap-2">
          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Ordenar por
            </label>
            <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
              <SelectTrigger className="h-10 w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="RELEVANCE">Relevancia</SelectItem>
                <SelectItem value="CREATED_AT">Novedades</SelectItem>
                <SelectItem value="BEST_SELLING">Más vendidos</SelectItem>
                <SelectItem value="PRICE_ASC">Precio: menor a mayor</SelectItem>
                <SelectItem value="PRICE_DESC">Precio: mayor a menor</SelectItem>
                <SelectItem value="TITLE">Nombre: A-Z</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 md:gap-8">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-[4/5] bg-sand/40 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="border border-dashed border-border py-24 text-center bg-sand/20 max-w-2xl mx-auto">
          <Package className="h-12 w-12 mx-auto text-muted-foreground" strokeWidth={1} />
          <h2 className="font-display text-3xl mt-4">Aún no hay fundas</h2>
          <p className="text-sm text-muted-foreground mt-3 max-w-md mx-auto">
            Añade productos desde el panel de administración y aparecerán aquí automáticamente.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 md:gap-8">
          {filtered.map((product) => (
            <FundaCard
              key={product.node.id}
              product={product}
              onOpenGallery={() => setLightbox({ product, index: 0 })}
            />
          ))}
        </div>
      )}

      <Lightbox state={lightbox} onClose={() => setLightbox(null)} onChange={setLightbox} />
    </div>
  );
}

function FundaCard({
  product,
  onOpenGallery,
}: {
  product: FundaNode;
  onOpenGallery: () => void;
}) {
  const p = product.node;
  const img = p.images.edges[0]?.node;
  const second = p.images.edges[1]?.node;
  const variant = p.variants.edges[0]?.node;
  const compareAt = variant?.compareAtPrice?.amount
    ? parseFloat(variant.compareAtPrice.amount)
    : null;
  const price = parseFloat(p.priceRange.minVariantPrice.amount);
  const hasDiscount = compareAt !== null && compareAt > price;
  

  return (
    <div className="group">
      <button
        type="button"
        onClick={onOpenGallery}
        className="relative block w-full overflow-hidden bg-white aspect-[4/5] mb-4 rounded-xl"
        aria-label={`Ver galería de ${p.title}`}
      >
        {img ? (
          <img
            src={img.url}
            alt={img.altText ?? p.title}
            loading="lazy"
            className="absolute inset-0 w-full h-full object-contain p-3 md:p-5 transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-sand/50 to-accent/40" />
        )}
        {second && (
          <img
            src={second.url}
            alt={second.altText ?? p.title}
            loading="lazy"
            className="absolute inset-0 w-full h-full object-contain p-3 md:p-5 opacity-0 transition-opacity duration-700 group-hover:opacity-100"
          />
        )}
        {hasDiscount && (
          <span className="absolute top-3 left-3 bg-espresso text-ivory text-[10px] tracking-[0.2em] uppercase px-2 py-1">
            Oferta
          </span>
        )}
      </button>

      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-display text-lg leading-tight">{p.title}</h3>
        <div className="text-sm tabular-nums text-right">
          {hasDiscount && (
            <span className="mr-2 text-muted-foreground line-through">
              {formatPrice(compareAt!, variant!.compareAtPrice!.currencyCode)}
            </span>
          )}
          <span>
            {formatPrice(
              p.priceRange.minVariantPrice.amount,
              p.priceRange.minVariantPrice.currencyCode,
            )}
          </span>
        </div>
      </div>

      <div className="mt-3">
        <Button asChild variant="outline" size="sm" className="w-full rounded-none text-[11px] tracking-[0.18em] uppercase">
          <Link to="/product/$handle" params={{ handle: p.handle }}>
            Ver producto
          </Link>
        </Button>
      </div>
    </div>
  );
}

function Lightbox({
  state,
  onClose,
  onChange,
}: {
  state: { product: FundaNode; index: number } | null;
  onClose: () => void;
  onChange: (s: { product: FundaNode; index: number } | null) => void;
}) {
  if (!state) return null;
  const images = state.product.node.images.edges.map((e) => e.node);
  const total = images.length;
  const current = images[state.index];

  const go = (delta: number) => {
    onChange({ ...state, index: (state.index + delta + total) % total });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl p-0 bg-ivory border-none">
        <div className="relative aspect-[4/3] bg-white">
          {current && (
            <img
              src={current.url}
              alt={current.altText ?? state.product.node.title}
              className="absolute inset-0 w-full h-full object-contain"
            />
          )}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 bg-ivory/80 backdrop-blur rounded-full p-2 hover:bg-ivory"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" strokeWidth={1.5} />
          </button>
          {total > 1 && (
            <>
              <button
                onClick={() => go(-1)}
                className="absolute left-3 top-1/2 -translate-y-1/2 bg-ivory/80 backdrop-blur rounded-full p-2 hover:bg-ivory"
                aria-label="Anterior"
              >
                <ChevronLeft className="h-5 w-5" strokeWidth={1.5} />
              </button>
              <button
                onClick={() => go(1)}
                className="absolute right-3 top-1/2 -translate-y-1/2 bg-ivory/80 backdrop-blur rounded-full p-2 hover:bg-ivory"
                aria-label="Siguiente"
              >
                <ChevronRight className="h-5 w-5" strokeWidth={1.5} />
              </button>
            </>
          )}
        </div>
        {total > 1 && (
          <div className="flex gap-2 overflow-x-auto p-4 bg-ivory">
            {images.map((im, i) => (
              <button
                key={im.url}
                onClick={() => onChange({ ...state, index: i })}
                className={`relative shrink-0 h-16 w-16 overflow-hidden border ${
                  i === state.index ? "border-espresso" : "border-transparent opacity-70"
                }`}
              >
                <img src={im.url} alt="" className="absolute inset-0 h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
