import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Shield, Truck, RotateCcw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPrice, isVariantAvailable, variantStockLabel, type ShopifyProduct } from "@/lib/shopify";
import { useCartStore } from "@/lib/cart";
import { PHONE_BRANDS, PHONE_MODELS, type PhoneBrand } from "@/lib/phone-models";
import { listProductImageOverridesPublic } from "@/lib/admin.functions";
import { getProductByHandlePublic, getProductsPublic } from "@/lib/catalog.functions";
import { FavoriteButton } from "@/components/FavoriteButton";
import { SITE_URL } from "@/lib/seo";


async function fetchProduct(handle: string): Promise<ShopifyProduct | null> {
  return await getProductByHandlePublic({ data: { handle } });
}

export const Route = createFileRoute("/product/$handle")({
  // `collection` es opcional: la clave es opcional (no solo su valor), para que
  // los enlaces a la ficha no estén obligados a pasar `search`.
  validateSearch: (search: Record<string, unknown>): { collection?: string } =>
    typeof search.collection === "string" ? { collection: search.collection } : {},
  loader: async ({ params }) => {
    const product = await fetchProduct(params.handle);
    if (!product) throw notFound();
    return { product };
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) {
      return { meta: [{ title: "Producto no encontrado — Kasea" }, { name: "robots", content: "noindex" }] };
    }
    const p = loaderData.product.node;
    
    const img = p.images.edges[0]?.node?.url;
    return {
      meta: [
        { title: `${p.title} — Kasea Store` },
        { name: "description", content: p.description?.slice(0, 155) || `Descubre ${p.title} en Kasea Store.` },
        { property: "og:title", content: `${p.title} — Kasea Store` },
        { property: "og:description", content: p.description?.slice(0, 155) || "" },
        { property: "og:type", content: "product" },
        { property: "og:url", content: `${SITE_URL}/product/${params.handle}` },
        { name: "robots", content: "index, follow" },
        ...(img ? [{ property: "og:image", content: img }, { name: "twitter:image", content: img }] : []),
      ],
      links: [{ rel: "canonical", href: `${SITE_URL}/product/${params.handle}` }],
      scripts: [{
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Product",
          name: p.title,
          description: p.description,
          image: img,
          offers: {
            "@type": "Offer",
            price: p.priceRange.minVariantPrice.amount,
            priceCurrency: p.priceRange.minVariantPrice.currencyCode,
            availability: "https://schema.org/InStock",
          },
        }),
      }],
    };
  },
  component: ProductPage,
  notFoundComponent: () => (
    <div className="container-luxe py-32 text-center">
      <h1 className="font-display text-4xl">Producto no encontrado</h1>
      <Link to="/tienda" className="inline-flex items-center gap-2 mt-8 text-sm uppercase tracking-widest">
        <ArrowLeft className="h-4 w-4" /> Volver a la tienda
      </Link>
    </div>
  ),
});

function ProductPage() {
  const { product } = Route.useLoaderData();
  const { collection } = Route.useSearch();
  const p = product.node;
  const [selectedImgIdx, setSelectedImgIdx] = useState(0);
  const [variantIdx, setVariantIdx] = useState(0);
  const [qty, setQty] = useState(1);
  const [selectedBrand, setSelectedBrand] = useState<PhoneBrand | "">("");
  const [selectedModel, setSelectedModel] = useState<string>("");

  const variant = p.variants.edges[variantIdx]?.node;

useEffect(() => {
  const fbq = (window as any).fbq;

  if (typeof fbq === "function" && variant) {
    fbq("track", "ViewContent", {
      content_ids: [variant.id],
      content_type: "product",
      content_name: p.title,
      value: Number(variant.price.amount),
      currency: variant.price.currencyCode,
    });
  }
}, [p.id, p.title, variantIdx]);
  
  const inStock = isVariantAvailable(variant);
  const addItem = useCartStore((s) => s.addItem);
  const isLoading = useCartStore((s) => s.isLoading);
  const navigate = useNavigate();

  // Detect if variant already provides a model (e.g. "iPhone 17 Pro Max" in title or options)
  const variantAlreadyHasModel = (variant?.selectedOptions ?? []).some(
    (o: { name: string; value: string }) => o.name.toLowerCase() === "modelo" || /iphone/i.test(o.value),
  );
  const needsModelSelector = !variantAlreadyHasModel;

  // Fundas subliminadas → solo iPhone. Resto (transparentes, etc.) → selector de marca.
  const productCollections = p.collections?.edges.map((edge: { node: { handle: string; title: string } }) => `${edge.node.handle} ${edge.node.title}`) ?? [];
  const isSublimacion = /sublim/i.test(
    `${collection ?? ""} ${p.handle} ${p.title} ${(p.tags ?? []).join(" ")} ${productCollections.join(" ")}`,
  );
  const iPhoneOnly = isSublimacion;


  const productsFn = useServerFn(getProductsPublic);
  const { data: related = [] } = useQuery({
    queryKey: ["related", p.id],
    queryFn: async () => {
      const all = (await productsFn()) as ShopifyProduct[];
      return all.filter((e) => e.node.id !== p.id).slice(0, 4);
    },
  });

  const handleAdd = async (openCheckout = false) => {
    if (!variant) return;
    if (needsModelSelector && (!selectedModel || (!iPhoneOnly && !selectedBrand))) return;
    const effectiveBrand = iPhoneOnly ? "iPhone" : selectedBrand;
    await addItem({
      product,
      variantId: variant.id,
      variantTitle: variant.title,
      price: variant.price,
      quantity: qty,
      selectedOptions: variant.selectedOptions ?? [],
      attributes: needsModelSelector && selectedModel
        ? [{ key: "Marca", value: effectiveBrand }, { key: "Modelo", value: selectedModel }]
        : undefined,
    });
    const fbq = (window as any).fbq;

if (typeof fbq === "function") {
  fbq("track", "AddToCart", {
    content_ids: [variant.id],
    content_type: "product",
    content_name: p.title,
    value: Number(variant.price.amount) * qty,
    currency: variant.price.currencyCode,
    contents: [{ id: variant.id, quantity: qty }],
  });
}
    if (openCheckout) {
      navigate({ to: "/checkout" });
    }
  };


  const overridesFn = useServerFn(listProductImageOverridesPublic);
  const { data: overrides } = useQuery({
    queryKey: ["product-overrides", p.handle],
    queryFn: () => overridesFn({ data: { handle: p.handle } }),
    staleTime: 5 * 60_000,
  });
  const images = useMemo(() => {
    const valid = (overrides ?? []).filter((o) => o.image_url && o.image_url.trim() !== "");
    if (valid.length > 0) {
      return valid.map((o) => ({ node: { url: o.image_url, altText: o.alt } }));
    }
    return p.images.edges;
  }, [overrides, p.images.edges]);

  return (
    <div className="container-luxe py-8 md:py-16">
      <nav className="text-xs tracking-widest uppercase text-muted-foreground mb-6">
        <Link to="/" className="hover:text-espresso">Inicio</Link>
        <span className="mx-2">/</span>
        <Link to="/tienda" className="hover:text-espresso">Tienda</Link>
        <span className="mx-2">/</span>
        <span className="text-espresso">{p.title}</span>
      </nav>

      <div className="grid md:grid-cols-2 gap-10 lg:gap-16">
        <div className="aspect-[4/5] bg-white overflow-hidden rounded-xl">
          {images[selectedImgIdx] && (
            <img
              src={images[selectedImgIdx].node.url}
              alt={images[selectedImgIdx].node.altText ?? p.title}
              className="w-full h-full object-contain p-4 md:p-6"
            />
          )}
        </div>


        <div className="md:sticky md:top-28 md:self-start">
          
          <div className="flex items-start justify-between gap-4">
            <h1 className="font-display text-4xl md:text-5xl leading-tight">{p.title}</h1>
            <FavoriteButton product={product} className="mt-1 h-11 w-11 flex-shrink-0" />
          </div>
          <p className="mt-4 text-2xl font-display">
            {variant && formatPrice(variant.price.amount, variant.price.currencyCode)}
          </p>

          {p.description && (
            <p className="mt-6 text-muted-foreground leading-relaxed">{p.description}</p>
          )}

          {p.variants.edges.length > 1 && (
            <div className="mt-8">
              <p className="eyebrow mb-3">Variante</p>
              <div className="flex flex-wrap gap-2">
                {p.variants.edges.map((v: { node: { id: string; title: string } }, i: number) => (
                  <button
                    key={v.node.id}
                    onClick={() => setVariantIdx(i)}
                    className={`px-4 py-2.5 text-sm border transition-colors ${variantIdx === i ? "border-espresso bg-espresso text-ivory" : "border-border hover:border-espresso"}`}
                  >
                    {v.node.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          {needsModelSelector && (
            <div className="mt-8 space-y-4">
              {!iPhoneOnly && (
                <div>
                  <label htmlFor="brand-select" className="eyebrow mb-3 block">
                    Elige tu marca <span className="text-espresso">*</span>
                  </label>
                  <select
                    id="brand-select"
                    value={selectedBrand}
                    onChange={(e) => {
                      setSelectedBrand(e.target.value as PhoneBrand | "");
                      setSelectedModel("");
                    }}
                    className="w-full h-12 px-4 border border-border bg-ivory text-espresso font-medium focus:outline-none focus:border-espresso transition-colors appearance-none cursor-pointer"
                    style={{
                      backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3e%3cpath fill='none' stroke='%23333' stroke-width='1.5' d='M1 1l5 5 5-5'/%3e%3c/svg%3e")`,
                      backgroundRepeat: "no-repeat",
                      backgroundPosition: "right 1rem center",
                      paddingRight: "2.5rem",
                    }}
                  >
                    <option value="">— Selecciona la marca —</option>
                    {PHONE_BRANDS.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
              )}

              {(iPhoneOnly || selectedBrand) && (
                <div>
                  <label htmlFor="model-select" className="eyebrow mb-3 block">
                    {iPhoneOnly ? "iPhone — elige tu modelo" : "Elige tu modelo"} <span className="text-espresso">*</span>
                  </label>

                  <select
                    id="model-select"
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="w-full h-12 px-4 border border-border bg-ivory text-espresso font-medium focus:outline-none focus:border-espresso transition-colors appearance-none cursor-pointer"
                    style={{
                      backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3e%3cpath fill='none' stroke='%23333' stroke-width='1.5' d='M1 1l5 5 5-5'/%3e%3c/svg%3e")`,
                      backgroundRepeat: "no-repeat",
                      backgroundPosition: "right 1rem center",
                      paddingRight: "2.5rem",
                    }}
                  >
                    <option value="">— Selecciona el modelo —</option>
                    {PHONE_MODELS[iPhoneOnly ? "iPhone" : (selectedBrand as PhoneBrand)].map((model) => (
                      <option key={model} value={model}>{model}</option>
                    ))}
                  </select>
                </div>
              )}


              <p className="text-xs text-muted-foreground">
                ¿No encuentras tu modelo?{" "}
                <Link to="/contacto" className="underline text-espresso hover:opacity-80">
                  Pregúntanos
                </Link>{" "}
                y te ayudamos a encontrar la funda perfecta.
              </p>
            </div>
          )}

          <div className="mt-8 flex items-center gap-4">
            <div className="flex items-center border border-border">
              <button onClick={() => setQty(Math.max(1, qty - 1))} className="px-4 py-3 hover:bg-secondary">−</button>
              <span className="w-10 text-center">{qty}</span>
              <button onClick={() => setQty(qty + 1)} className="px-4 py-3 hover:bg-secondary">+</button>
            </div>
            <span className="text-sm text-muted-foreground">
              {variantStockLabel(variant)}
            </span>
          </div>

          <div className="mt-6 space-y-3">
            <Button
              onClick={() => handleAdd(false)}
              variant="outline"
              disabled={isLoading || !inStock || (needsModelSelector && (!selectedModel || (!iPhoneOnly && !selectedBrand)))}
              className="w-full h-14 rounded-none border-espresso text-espresso hover:bg-secondary tracking-[0.2em] uppercase text-xs"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Añadir a la bolsa"}
            </Button>
            <Button
              onClick={() => handleAdd(true)}
              disabled={isLoading || !inStock || (needsModelSelector && (!selectedModel || (!iPhoneOnly && !selectedBrand)))}
              style={{ backgroundColor: "#000", color: "#fff" }}
              className="w-full h-14 rounded-none hover:opacity-90 tracking-[0.2em] uppercase text-xs disabled:opacity-100 disabled:cursor-not-allowed"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Comprar ahora"}
            </Button>
          </div>



        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-24 md:mt-32">
          <h2 className="font-display text-3xl mb-8">También te puede gustar</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
            {related.slice(0, 4).map((rel: ShopifyProduct) => {
              const img = rel.node.images?.edges?.[0]?.node;
              return (
                <Link key={rel.node.id} to="/product/$handle" params={{ handle: rel.node.handle }} className="group">
                  <div className="aspect-[4/5] bg-white overflow-hidden mb-3 rounded-xl">
                    {img && <img src={img.url} alt={img.altText ?? rel.node.title} className="w-full h-full object-contain p-3 md:p-5 group-hover:scale-105 transition-transform duration-700" loading="lazy" />}
                  </div>
                  <div className="flex justify-between items-baseline">
                    <h3 className="font-display text-base">{rel.node.title}</h3>
                    <span className="text-sm">{formatPrice(rel.node.priceRange.minVariantPrice.amount, rel.node.priceRange.minVariantPrice.currencyCode)}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
