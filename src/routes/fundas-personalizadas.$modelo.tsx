// ============================================================================
// Página SEO de un modelo: /fundas-personalizadas/iphone-15-pro
// Pensada para búsquedas como "funda iPhone 15 Pro personalizada con foto".
// El botón abre el editor con el modelo ya elegido.
// ============================================================================
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowRight, Camera, ImagePlus, Palette, Truck } from "lucide-react";
import { getProductByHandlePublic, getProductsPublic } from "@/lib/catalog.functions";
import { formatPrice, type ShopifyProduct } from "@/lib/shopify";
import { SITE_URL, seo } from "@/lib/seo";
import { CaseMockup } from "@/components/CaseMockup";
import { CUSTOM_PRODUCT_HANDLE, modelFromSlug, modelSlug, relatedModels } from "@/lib/model-pages";

// Etiquetas de accesorios: lo que no las lleva es una funda del catálogo.
const ACCESSORY_TAGS = ["accesorios", "colgantes", "protectores", "cargadores", "otros"];

/** Algunas fundas con diseño propio de Kasea para enseñar en la página. */
async function catalogCases(max = 8): Promise<ShopifyProduct[]> {
  try {
    const all = (await getProductsPublic()) as ShopifyProduct[];
    return all.filter((p) => !(p.node.tags ?? []).some((t) => ACCESSORY_TAGS.includes(t))).slice(0, max);
  } catch {
    return [];
  }
}

async function customPrice(): Promise<{ amount: string; currency: string } | null> {
  try {
    const p = await getProductByHandlePublic({ data: { handle: CUSTOM_PRODUCT_HANDLE } });
    const pr = p?.node.priceRange.minVariantPrice;
    return pr ? { amount: pr.amount, currency: pr.currencyCode } : null;
  } catch {
    return null; // sin precio la página se muestra igual
  }
}

export const Route = createFileRoute("/fundas-personalizadas/$modelo")({
  loader: async ({ params }) => {
    const model = modelFromSlug(params.modelo);
    if (!model) throw notFound();
    const [price, designs] = await Promise.all([customPrice(), catalogCases()]);
    return { model, price, designs };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Modelo no encontrado — Kasea Store" }, { name: "robots", content: "noindex" }] };
    }
    const { model, price } = loaderData;
    const path = `/fundas-personalizadas/${modelSlug(model)}`;
    const base = seo({
      title: `Fundas ${model}: personalizada con tu foto o con diseño exclusivo | Kasea Store`,
      description: `Fundas para ${model}: créala con tu foto o un collage, o elige uno de nuestros diseños exclusivos. Sublimación 3D que cubre la trasera y los laterales. Envío gratis.`,
      path,
    });
    const jsonLd: Record<string, unknown>[] = [
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Inicio", item: `${SITE_URL}/` },
          { "@type": "ListItem", position: 2, name: "Fundas personalizadas", item: `${SITE_URL}/fundas-personalizadas` },
          { "@type": "ListItem", position: 3, name: model, item: `${SITE_URL}${path}` },
        ],
      },
    ];
    if (price) {
      jsonLd.push({
        "@context": "https://schema.org",
        "@type": "Product",
        name: `Funda personalizada ${model}`,
        description: `Funda para ${model} personalizada con tu foto o diseño, impresa por sublimación 3D.`,
        brand: { "@type": "Brand", name: "Kasea Store" },
        url: `${SITE_URL}${path}`,
        offers: {
          "@type": "Offer",
          price: price.amount,
          priceCurrency: price.currency,
          availability: "https://schema.org/InStock",
          url: `${SITE_URL}${path}`,
        },
      });
    }
    return {
      ...base,
      scripts: jsonLd.map((d) => ({ type: "application/ld+json", children: JSON.stringify(d) })),
    };
  },
  component: ModelPage,
  notFoundComponent: () => (
    <div className="container-luxe py-32 text-center">
      <h1 className="font-display text-4xl">Modelo no encontrado</h1>
      <Link to="/fundas-personalizadas" className="mt-8 inline-flex items-center gap-2 text-sm uppercase tracking-widest">
        Ver todos los modelos <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  ),
});

function ModelPage() {
  const { model, price, designs } = Route.useLoaderData();
  const others = relatedModels(model);
  const priceText = price ? formatPrice(price.amount, price.currency) : null;

  const steps = [
    {
      icon: ImagePlus,
      title: "Sube tu foto",
      text: `Elige una foto de tu galería, o varias para hacer un collage. El editor ya está preparado para el ${model}.`,
    },
    {
      icon: Camera,
      title: "Colócala a tu gusto",
      text: `Muévela y amplíala con los dedos. Verás marcado en rojo el hueco de la cámara del ${model}, para que nada importante quede debajo.`,
    },
    {
      icon: Palette,
      title: "La fabricamos para ti",
      text: "Imprimimos tu diseño por sublimación 3D: la imagen cubre la trasera y los laterales, con colores vivos y nítidos.",
    },
  ];

  return (
    <div className="container-luxe py-12 md:py-20">
      <nav aria-label="Ruta" className="mb-8 text-xs text-muted-foreground">
        <Link to="/" className="hover:text-foreground">Inicio</Link>
        <span className="mx-2">/</span>
        <Link to="/fundas-personalizadas" className="hover:text-foreground">Fundas personalizadas</Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">{model}</span>
      </nav>

      <div className="grid items-center gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] md:gap-16">
        <div className="mx-auto w-[min(60vw,260px)] md:w-[300px]">
          <CaseMockup model={model} className="h-auto w-full drop-shadow-xl" />
        </div>

        <div>
          <p className="eyebrow mb-3">Funda personalizada</p>
          <h1 className="font-display text-4xl leading-tight md:text-5xl">Funda personalizada para {model}</h1>
          <p className="mt-5 max-w-xl text-muted-foreground">
            Convierte tu {model} en algo solo tuyo. Sube tu foto favorita, haz un collage con varias o usa tu propio
            diseño, y nosotros fabricamos la funda tal y como la dejes en el editor.
          </p>
          {priceText && (
            <p className="mt-6 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-display text-3xl tabular-nums">{priceText}</span>
              <span className="text-sm text-muted-foreground">IVA incluido · Envío gratis</span>
            </p>
          )}
          <Link
            to="/personalizar"
            search={{ modelo: model }}
            className="mt-8 inline-flex h-14 items-center gap-2 rounded-md bg-black px-8 text-sm font-medium uppercase tracking-[0.14em] text-white transition-colors hover:bg-neutral-800"
          >
            Diseñar mi funda {model} <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Truck className="h-4 w-4" strokeWidth={1.5} /> Envío a domicilio en 24/48 h
          </p>
        </div>
      </div>

      <section className="mt-20">
        <h2 className="font-display text-3xl">Cómo crear tu funda para {model}</h2>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {steps.map((s, i) => (
            <div key={s.title} className="rounded-lg border border-border bg-card p-6">
              <s.icon className="h-6 w-6" strokeWidth={1.5} />
              <h3 className="mt-4 font-display text-xl">
                {i + 1}. {s.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {designs.length > 0 && (
        <section className="mt-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-3xl">Fundas {model} con nuestros diseños</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                ¿Prefieres algo ya creado? Elige uno de nuestros diseños exclusivos y después tu modelo.
              </p>
            </div>
            <Link to="/fundas-sublimacion" className="inline-flex items-center gap-1.5 text-sm underline underline-offset-4">
              Ver todos los diseños <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <ul className="mt-8 grid grid-cols-2 gap-6 md:grid-cols-4">
            {designs.map((d) => {
              const img = d.node.images.edges[0]?.node;
              return (
                <li key={d.node.handle}>
                  <Link to="/product/$handle" params={{ handle: d.node.handle }} className="group block">
                    <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-white">
                      {img && (
                        <img
                          src={img.url}
                          alt={img.altText ?? d.node.title}
                          loading="lazy"
                          className="absolute inset-0 h-full w-full object-contain p-3 transition-transform duration-700 group-hover:scale-105"
                        />
                      )}
                    </div>
                    <div className="mt-3 flex items-baseline justify-between gap-3">
                      <h3 className="font-display text-lg leading-tight">{d.node.title}</h3>
                      <span className="text-sm tabular-nums text-foreground/80">
                        {formatPrice(d.node.priceRange.minVariantPrice.amount, d.node.priceRange.minVariantPrice.currencyCode)}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="mt-16 max-w-3xl">
        <h2 className="font-display text-3xl">Preguntas frecuentes</h2>
        <dl className="mt-6 space-y-5">
          <div>
            <dt className="font-medium">¿Puedo poner varias fotos en la funda de mi {model}?</dt>
            <dd className="mt-1 text-sm text-muted-foreground">
              Sí. En el editor elige «Collage» y añade hasta 6 fotos con el color de fondo que prefieras.
            </dd>
          </div>
          <div>
            <dt className="font-medium">¿Qué calidad debe tener la foto?</dt>
            <dd className="mt-1 text-sm text-muted-foreground">
              Cuanto más grande, mejor. Si la foto tiene poca resolución para el tamaño de la funda, el editor te avisa
              antes de comprar.
            </dd>
          </div>
          <div>
            <dt className="font-medium">¿La imagen llega a los bordes?</dt>
            <dd className="mt-1 text-sm text-muted-foreground">
              Sí. La impresión por sublimación 3D cubre la parte trasera y también los laterales de la funda.
            </dd>
          </div>
        </dl>
      </section>

      <section className="mt-16">
        <h2 className="font-display text-2xl">Fundas personalizadas para otros modelos</h2>
        <ul className="mt-5 flex flex-wrap gap-2">
          {others.map((m) => (
            <li key={m}>
              <Link
                to="/fundas-personalizadas/$modelo"
                params={{ modelo: modelSlug(m) }}
                className="inline-flex h-10 items-center rounded-full border border-border px-4 text-sm hover:bg-secondary"
              >
                {m}
              </Link>
            </li>
          ))}
          <li>
            <Link
              to="/fundas-personalizadas"
              className="inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm underline underline-offset-4"
            >
              Ver todos <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </li>
        </ul>
      </section>
    </div>
  );
}
