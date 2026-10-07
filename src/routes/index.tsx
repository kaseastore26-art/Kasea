import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Shield, Truck, Lock, Package, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { listCarouselImagesPublic } from "@/lib/admin.functions";
import { useCategoryImages, pickCategoryImage, type CategorySlug } from "@/hooks/useCategoryImages";
import { useSiteContent } from "@/hooks/useSiteContent";
import { seo } from "@/lib/seo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { formatPrice, type ShopifyProduct } from "@/lib/shopify";

import { BrandLogo } from "@/components/BrandLogo";

const heroImg = "/brand/hero-kasea.png";
const heroSecondImg = "/brand/hero-kasea-2.png";
import lifestyleImg from "@/assets/promo-friends.png.asset.json";

import carousel01 from "@/assets/carousel-01.png.asset.json";
import carousel02 from "@/assets/carousel-02.png.asset.json";
import carousel03 from "@/assets/carousel-03.png.asset.json";
import carousel04 from "@/assets/carousel-04.png.asset.json";
import carousel05 from "@/assets/carousel-05.png.asset.json";
import carousel06 from "@/assets/carousel-06.png.asset.json";
import carousel07 from "@/assets/carousel-07.png.asset.json";
import carousel08 from "@/assets/carousel-08.png.asset.json";
import carousel09 from "@/assets/carousel-09.png.asset.json";

const uploadedCarouselImages = [
  { src: carousel01.url, alt: "Funda Kasea lila con rayas y motivo veraniego" },
  { src: carousel02.url, alt: "Funda Kasea turquesa con rayas y detalle gráfico rojo" },
  { src: carousel03.url, alt: "Funda Kasea con rayas celestes y motivo de langosta" },
  { src: carousel04.url, alt: "Funda Kasea de lunares con ilustración femenina" },
  { src: carousel05.url, alt: "Funda Kasea de rayas azul marino con perro y taza" },
  { src: carousel06.url, alt: "Funda Kasea rosa con lunares y gato ilustrado" },
  { src: carousel07.url, alt: "Funda Kasea rosa con espiral y gato negro" },
  { src: carousel08.url, alt: "Funda Kasea de lunares con perro y pañuelo animal print" },
  { src: carousel09.url, alt: "Funda Kasea rosa con corazones y gato" },
];

export const Route = createFileRoute("/")({
  head: () =>
    seo({
      title: "Kasea Store | Fundas premium para iPhone",
      description:
        "Fundas premium para iPhone con diseño elegante y acabados de alta calidad. Compra online segura en España y crea tu funda personalizada.",
      path: "/",
    }),
  component: HomePage,
});

function HomePage() {
  return (
    <>
      <Hero />
      
      <HomepageCarousel />
      
      <CategoryHighlights />
      
      <PromoBanner />
      
      <AccessoriesSection />
      
      <Reviews />

      

      
    </>
  );
}




import catSublimacion from "@/assets/cat-sublimacion.jpg";

const HOME_CATEGORIES: Array<{
  title: string;
  subtitle: string;
  to: "/fundas-sublimacion";
  image: string;
  alt: string;
  slug: CategorySlug;
}> = [
  {
    title: "Fundas para el móvil",
    subtitle: "",
    to: "/fundas-sublimacion",
    image: catSublimacion,
    alt: "Funda para sublimación con pinceles y paleta de color",
    slug: "sublimacion",
  },
];

function CategoryHighlights() {
  const { data: overrides } = useCategoryImages();

  return (
    <section id="categorias" className="border-b border-border/60 bg-background">
      <div className="container-luxe py-16 md:py-24">
        <div className="grid items-center gap-10 md:grid-cols-2 md:gap-16 lg:gap-20">
          <Link to="/fundas-sublimacion" className="group block overflow-hidden rounded-xl">
            <img
              src={pickCategoryImage(
                overrides,
                "sublimacion",
                "/brand/fundas-movil.png",
                "Mujer llevando una funda Kasea",
              ).url}
              alt="Mujer llevando una funda Kasea"
              loading="lazy"
              width={1200}
              height={1500}
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.02]"
            />
          </Link>

          <div className="max-w-xl">
            <p className="mb-4 text-base font-semibold uppercase tracking-[0.18em] md:text-lg">Fundas para móvil</p>

            <h2 className="font-display text-5xl leading-tight md:text-7xl lg:text-8xl">
              Belleza que protege.
            </h2>

            <p className="mt-6 text-base leading-relaxed text-foreground/80 md:text-lg">
              No solo son preciosas, también son súper protectoras.
              La combinación perfecta entre diseño y durabilidad.
            </p>

            <p className="mt-4 text-base leading-relaxed text-foreground/80 md:text-lg">
              Finas, ligeras y resistentes, para proteger tu móvil sin
              hacerlo más voluminoso.
            </p>

            <Link
              to="/fundas-sublimacion"
              className="mt-8 inline-flex items-center gap-2 bg-foreground px-7 py-4 text-sm font-semibold uppercase tracking-[0.18em] text-background transition-all hover:opacity-90 hover:gap-3"
            >
              Diseños exclusivos
              <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function AccessoriesSection() {
  return (
    <section className="border-b border-border/60 bg-background">
      <div className="container-luxe py-16 md:py-24">
        <div className="grid items-center gap-10 md:grid-cols-2 md:gap-16 lg:gap-20">
          <div className="max-w-xl">
            <p className="mb-4 text-base font-semibold uppercase tracking-[0.18em] md:text-lg">
              Accesorios
            </p>

            <h2 className="font-display text-5xl leading-tight md:text-7xl lg:text-8xl">
              Todo lo que tu móvil necesita.
            </h2>

            <p className="mt-6 text-base leading-relaxed text-foreground/80 md:text-lg">
              Dale el toque final a tu móvil con accesorios que combinan
              diseño, utilidad y ese estilo Kasea que se nota en cada detalle.
            </p>

            <p className="mt-4 text-base leading-relaxed text-foreground/80 md:text-lg">
              Cuerdas para el móvil · Protectores · Cargadores
            </p>

            <Link
              to="/accesorios"
              className="mt-8 inline-flex items-center gap-2 bg-foreground px-7 py-4 text-sm font-semibold uppercase tracking-[0.18em] text-background transition-all hover:opacity-90 hover:gap-3"
            >
              Descubre los accesorios
              <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
            </Link>
          </div>

          <div className="group overflow-hidden rounded-xl">
            <img
              src="/brand/accesorios.png"
              alt="Accesorios Kasea para móvil"
              loading="lazy"
              width={989}
              height={1590}
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.02]"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function Hero() {
  const content = useSiteContent();
  const [heroSlide, setHeroSlide] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setHeroSlide((prev) => (prev + 1) % 2);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const heroImages = [heroImg, heroSecondImg];

  return (
    <section className="relative isolate overflow-hidden border-b border-border/60 bg-background">
      {/* Mobile: neutro claro — beige/ivory suave */}
      <div className="md:hidden relative overflow-hidden">
        <div className="absolute inset-0 -z-20 bg-[linear-gradient(160deg,#f7f3ec_0%,#efe8dd_55%,#e6dccb_100%)]" />
        <div className="pointer-events-none absolute -top-28 -right-24 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(210,190,160,0.35)_0%,transparent_70%)] blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(230,215,190,0.4)_0%,transparent_70%)] blur-3xl" />
        <div className="absolute inset-0 -z-10 opacity-[0.12] [background-image:radial-gradient(circle_at_1px_1px,rgba(80,60,40,0.4)_1px,transparent_0)] [background-size:26px_26px]" />
        <div className="pointer-events-none absolute inset-x-6 top-6 h-px bg-[linear-gradient(to_right,transparent,rgba(120,95,60,0.35),transparent)]" />
        <div className="pointer-events-none absolute inset-x-6 bottom-32 h-px bg-[linear-gradient(to_right,transparent,rgba(120,95,60,0.2),transparent)]" />

        <div className="relative w-full">
          {heroImages.map((image, index) => (
            <img
              key={image}
              src={image}
              alt="Portada Kasea con funda de móvil premium"
              className={`absolute inset-0 z-10 block h-full w-full object-contain transition-opacity duration-1000 ${
                heroSlide === index ? "opacity-100" : "opacity-0"
              }`}
              width={1200}
              height={1200}
              fetchPriority={index === 0 ? "high" : "auto"}
            />
          ))}
          <div className="relative aspect-[16/10] w-full bg-[#f7f3ec]" />
          <div className="absolute inset-y-0 left-0 z-20 flex w-[46%] items-center justify-center px-3">
            <h1 className="font-display text-[1.45rem] font-semibold leading-[1.12] tracking-[-0.01em] text-foreground text-center [text-shadow:0_1px_8px_rgba(255,255,255,0.9)] xs:text-[1.7rem] sm:text-[2.1rem]">
              {content.hero_title_line1}
              <br />
              <span className="italic font-normal">{content.hero_title_line2}</span>
            </h1>

          </div>
        </div>
        <div className="container-luxe pb-14 pt-8 text-center">
          <p className="mx-auto max-w-md text-base font-medium leading-relaxed text-foreground/75">
            {content.hero_intro}
          </p>
          <div className="mt-7 flex justify-center">
            <Link
              to="/mas-vendido"
              className="inline-flex h-12 items-center gap-2 rounded-md bg-black px-7 text-sm font-semibold tracking-[0.14em] text-white uppercase shadow-soft transition-transform duration-300 hover:-translate-y-0.5"
            >
              {content.hero_cta}
              <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
            </Link>
          </div>


        </div>
      </div>



      {/* Desktop: overlay layout */}
      <div className="hidden md:block">
        <div className="absolute inset-0">
          {heroImages.map((image, index) => (
            <img
              key={image}
              src={image}
              alt="Ambiente premium de Kasea con funda de móvil en un entorno cálido y elegante"
              className={`absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-1000 ${
                heroSlide === index ? "opacity-100" : "opacity-0"
              }`}
              width={1920}
              height={1280}
            />
          ))}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--color-background)_0%,rgba(0,0,0,0.15)_45%,transparent_70%)]" />
          <div className="absolute inset-x-0 bottom-0 h-32 bg-[linear-gradient(to_bottom,transparent,var(--color-background))]" />
        </div>
        <div className="container-luxe relative grid min-h-[92svh] items-end py-20 md:grid-cols-[1.1fr_0.9fr]">
          <div className="max-w-2xl pb-12">
            <p className="eyebrow mt-8">&nbsp;</p>
            <h1 className="mt-4 max-w-3xl font-display text-6xl font-bold text-black leading-[1.02] tracking-[-0.01em] lg:text-[4.6rem]">
              {content.hero_title_line1}
              <br />
              <span className="italic font-normal">{content.hero_title_line2}</span>
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-relaxed text-black">
              {content.hero_intro}
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link
                to="/mas-vendido"
                className="inline-flex h-12 items-center gap-2 rounded-md bg-black px-7 text-sm font-medium tracking-[0.14em] text-white uppercase transition-transform duration-300 hover:-translate-y-0.5 hover:opacity-95"
              >
                {content.hero_cta}
                <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
              </Link>
            </div>


          </div>
        </div>
      </div>
    </section>
  );
}

function Benefits() {
  const items = [
    { icon: Shield, title: "Diseño con carácter", text: "Una estética cuidada que eleva la percepción de marca." },
    { icon: Truck, title: "Compra fluida", text: "Una experiencia clara, rápida y pensada para convertir." },
    { icon: Lock, title: "Checkout seguro", text: "Pago con tarjeta cifrado y procesado de forma segura por Stripe." },
  ];
  return (
    <section className="border-b border-border/60 bg-background">
      <div className="container-luxe grid gap-6 py-8 md:grid-cols-3 md:gap-8 md:py-10">
        {items.map((item) => (
          <div key={item.title} className="flex gap-4 rounded-md border border-border/50 bg-card/60 p-5">
            <item.icon className="mt-0.5 h-5 w-5 text-foreground" strokeWidth={1.4} />
            <div>
              <h2 className="font-sans text-sm font-semibold tracking-[0.08em] uppercase">{item.title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.text}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function HomepageCarousel() {
  const listFn = useServerFn(listCarouselImagesPublic);
  const { data: dbImages } = useQuery({
    queryKey: ["carousel-images"],
    queryFn: () => listFn(),
    staleTime: 5 * 60_000,
  });
  const images = useMemo(() => {
    // Solo filas con URL válida; si no hay ninguna, usar las imágenes locales.
    const valid = (dbImages ?? []).filter((r) => r.image_url && r.image_url.trim() !== "");
    if (valid.length > 0) {
      return valid.map((r) => ({ src: r.image_url, alt: r.alt || r.title || "Kasea" }));
    }
    return uploadedCarouselImages;
  }, [dbImages]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % images.length);
    }, 3500);
    return () => window.clearInterval(timer);
  }, [images.length]);

  const goPrev = () => setActiveIndex((current) => (current - 1 + images.length) % images.length);
  const goNext = () => setActiveIndex((current) => (current + 1) % images.length);

  return (
    <section id="galeria-home" className="border-y border-border/60 bg-secondary/30 py-20 md:py-28">
      <div className="container-luxe">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <p className="eyebrow mb-3">Galería</p>
          <h2 className="font-display text-4xl md:text-5xl">Diseños que marcan la diferencia</h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            Fundas Kasea creadas para proteger tu móvil y darle un toque único a tu estilo.
          </p>
        </div>

        <div className="relative mx-auto max-w-6xl">
          {/* Stage */}
          <div className="relative overflow-hidden">
            <div className="flex items-center justify-center">
              <div className="relative w-full max-w-[36rem] overflow-hidden rounded-[2rem] bg-card shadow-[var(--shadow-elevated)]">
                <div
                  className="flex transition-transform duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
                  style={{ transform: `translateX(-${activeIndex * 100}%)` }}
                >
                  {images.map((image) => (
                    <div key={image.src} className="min-w-full">
                      <img
                        src={image.src}
                        alt={image.alt}
                        className="aspect-[4/5] w-full bg-secondary object-contain p-4 md:p-6"
                        loading="lazy"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Arrows */}
            <button
              type="button"
              onClick={goPrev}
              aria-label="Imagen anterior"
              className="absolute left-2 top-1/2 -translate-y-1/2 inline-flex h-12 w-12 items-center justify-center rounded-full border border-border bg-background/90 backdrop-blur-sm transition-all hover:bg-background hover:shadow-[var(--shadow-soft)] md:left-6"
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
            </button>
            <button
              type="button"
              onClick={goNext}
              aria-label="Imagen siguiente"
              className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-12 w-12 items-center justify-center rounded-full border border-border bg-background/90 backdrop-blur-sm transition-all hover:bg-background hover:shadow-[var(--shadow-soft)] md:right-6"
            >
              <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </div>

          {/* Meta + indicators */}
          <div className="mt-8 flex flex-col items-center gap-5">
            <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
              <span className="text-foreground">{String(activeIndex + 1).padStart(2, "0")}</span>
              <span className="mx-2 text-border">/</span>
              <span>{String(images.length).padStart(2, "0")}</span>
            </p>
            <div className="flex items-center gap-2">
              {images.map((image, index) => (
                <button
                  key={image.src}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  aria-label={`Ver imagen ${index + 1}`}
                  className={`h-[2px] transition-all duration-500 ${
                    activeIndex === index
                      ? "w-10 bg-foreground"
                      : "w-6 bg-border hover:bg-foreground/40"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}


function ProductCard({ product }: { product: ShopifyProduct }) {
  const p = product.node;
  const img = p.images.edges[0]?.node;
  const secondImg = p.images.edges[1]?.node;

  return (
    <Link to="/product/$handle" params={{ handle: p.handle }} className="group block">
      <div className="relative mb-4 aspect-[4/5] overflow-hidden rounded-xl bg-white">
        {img && (
          <img
            src={img.url}
            alt={img.altText ?? p.title}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-contain p-3 transition-opacity duration-700 group-hover:opacity-0 md:p-5"
          />
        )}
        {secondImg ? (
          <img
            src={secondImg.url}
            alt={secondImg.altText ?? p.title}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-contain p-3 md:p-5"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-sand/50 to-accent/40" />
        )}
      </div>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-display text-lg leading-tight">{p.title}</h3>
        <span className="text-sm tabular-nums text-foreground/80">
          {formatPrice(p.priceRange.minVariantPrice.amount, p.priceRange.minVariantPrice.currencyCode)}
        </span>
      </div>
    </Link>
  );
}

function FeaturedProducts({ products, isLoading }: { products: ShopifyProduct[]; isLoading: boolean }) {
  return (
    <section className="container-luxe py-20 md:py-28">
      <div className="mb-12 flex items-end justify-between gap-6">
        <div>
          <p className="eyebrow mb-3">Tienda</p>
          <h2 className="font-display text-4xl md:text-5xl">Compra online</h2>
          <p className="mt-4 max-w-2xl text-muted-foreground">
            Descubre fundas con diseños exclusivos que combinan estilo, calidad y protección para acompañarte cada día.&nbsp;
          </p>
        </div>
        <Link to="/tienda" className="hidden items-center gap-2 text-sm font-medium tracking-[0.14em] uppercase md:inline-flex">
          Ver toda la tienda <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4 md:gap-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="aspect-[4/5] animate-pulse rounded-xl bg-sand/40" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-sand/15 py-20 text-center">
          <Package className="mx-auto h-10 w-10 text-muted-foreground" strokeWidth={1} />
          <h3 className="mt-4 font-display text-2xl">Aún no hay productos publicados</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Cuando añadas productos desde el panel de administración, aparecerán aquí automáticamente con su imagen, precio y enlace a ficha de producto.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4 md:gap-8">
          {products.slice(0, 8).map((p) => (
            <ProductCard key={p.node.id} product={p} />
          ))}
        </div>
      )}
    </section>
  );
}

function PromoBanner() {
  return (
    <section className="overflow-hidden bg-luxe-gradient text-white">
      <div className="container-luxe grid items-center gap-10 py-20 md:grid-cols-2 md:py-28">
        <div className="order-2 md:order-1 overflow-hidden rounded-xl border border-white/10">
          <img
            src={lifestyleImg.url}
            alt="Detalle lifestyle de una funda Kasea en un entorno cuidado"
            loading="lazy"
            className="h-full w-full object-cover"
            width={1600}
            height={1000}
          />
        </div>
        <div className="order-1 md:order-2 contents md:block">

          <p className="order-1 eyebrow mb-4 text-primary-foreground/65 hidden md:block">&nbsp;</p>
          <h2 className="order-1 md:order-none font-display text-5xl leading-tight md:text-7xl lg:text-8xl">
            ¿No ves la funda
            <br />
            que quieres ?
          </h2>
          <p className="order-3 md:order-none mt-8 max-w-2xl text-lg leading-relaxed text-primary-foreground/74 whitespace-pre-line md:text-2xl md:leading-relaxed">
            Personalízala tú mismo con la imagen, fotografía o diseño que quieras.{"\n"}
            O si lo prefieres, escríbenos y la diseñamos nosotros por ti.
          </p>
          <Link
            to="/personalizar"
            className="order-4 md:order-none mt-10 inline-flex h-14 items-center gap-2 rounded-md bg-black text-white px-9 text-base font-medium tracking-[0.14em] uppercase transition-colors hover:bg-neutral-800 md:h-16 md:px-11 md:text-lg"
          >
            Fundas personalizadas <ArrowRight className="h-5 w-5" strokeWidth={1.5} />
          </Link>


        </div>
      </div>
    </section>
  );
}

function BrandStory() {
  return (
    <section className="container-luxe py-20 md:py-28">
      <div className="grid gap-8 md:grid-cols-[0.8fr_1.2fr] md:items-start">
        <div>
          <p className="eyebrow mb-3">{"\n\n\n\n"}</p>
          <h2 className="font-display text-4xl md:text-5xl">{"\n"}</h2>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <div className="rounded-xl border border-border/60 bg-card p-6">
            <h3 className="text-sm font-semibold uppercase tracking-[0.12em]">{"\n"}</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {"\n"}
            </p>
          </div>
          <div className="rounded-xl border border-border/60 bg-card p-6">
            <h3 className="text-sm font-semibold uppercase tracking-[0.12em]">Editable sin código</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {"\n\n\n\n\n\n\n\n\n\n\n"}Los productos, sus imágenes, precios, variantes y stock se gestionan desde el panel de administración, sin tocar el código.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

const REVIEWS = [
  {
    name: "Lucía M.",
    location: "Madrid",
    text: "Estoy encantada con mi funda Kasea. El diseño es precioso, se nota la calidad al tacto y protege el móvil perfectamente. Llegó súper rápido y muy bien embalada. ¡Repetiré seguro!",
  },
  {
    name: "Carla R.",
    location: "Valencia",
    text: "Es la funda más bonita que he tenido nunca. Los colores son tal cual en las fotos y encaja perfecta en mi iPhone. Todo el mundo me pregunta dónde la he comprado.",
  },
  {
    name: "Andrea S.",
    location: "Barcelona",
    text: "Compra 100% recomendada. Materiales premium, acabados impecables y un diseño con muchísima personalidad. Se nota que cuidan cada detalle. ¡Ya tengo pensada la próxima!",
  },
  {
    name: "Marta G.",
    location: "Sevilla",
    text: "La calidad es una pasada. Se ajusta perfectamente al móvil, no resbala y el color se mantiene intacto después de meses de uso diario. Súper contenta con la compra.",
  },
  {
    name: "Paula D.",
    location: "Bilbao",
    text: "Pedí una funda personalizada y el resultado ha superado mis expectativas. Atención al cliente rapidísima y muy amables. Se nota que ponen mimo en cada detalle.",
  },
  {
    name: "Sara L.",
    location: "Zaragoza",
    text: "Me llegó en 48 horas, empaquetado precioso y la funda es aún más bonita en persona. Es mi tercera compra en Kasea y siempre acierto. ¡Diseños con muchísima personalidad!",
  },
  {
    name: "Nuria P.",
    location: "Málaga",
    text: "Preciosa, elegante y muy resistente. Se me cayó el móvil un par de veces y ni un rasguño. Además, el diseño es único, no lo he visto en ningún otro sitio.",
  },
  {
    name: "Elena V.",
    location: "Alicante",
    text: "Regalé una a mi hermana y le encantó tanto que me pedí otra para mí. Los materiales son premium de verdad, no como otras fundas que se ponen amarillas al mes.",
  },
  {
    name: "Cristina F.",
    location: "Murcia",
    text: "Estética impecable, tacto suave y protección total. Kasea se ha convertido en mi marca de fundas favorita, sin duda. Ya estoy esperando la próxima colección.",
  },
];

const REVIEWS_PER_PAGE = 3;
const REVIEW_ROTATION_MS = 5000;

function Reviews() {
  const [startIndex, setStartIndex] = useState(0);
  const [mobileIndex, setMobileIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStartIndex((prev) => (prev + REVIEWS_PER_PAGE) % REVIEWS.length);
    }, REVIEW_ROTATION_MS);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setMobileIndex((prev) => (prev + 1) % REVIEWS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const visibleReviews = useMemo(() => {
    return Array.from({ length: REVIEWS_PER_PAGE }, (_, i) => REVIEWS[(startIndex + i) % REVIEWS.length]);
  }, [startIndex]);

  return (
    <section className="border-y border-border/60 bg-sand/25">
      <div className="container-luxe py-20 md:py-24">
        <div className="max-w-2xl">
          <p className="eyebrow mb-3">Prueba social</p>
          <h2 className="font-display text-4xl md:text-5xl">Lo que dicen nuestros clientes</h2>
          <p className="mt-4 text-muted-foreground">
            Opiniones reales de personas que ya llevan su funda Kasea.
          </p>
        </div>

        {/* Mobile: horizontal sliding carousel, 1 review at a time */}
        <div className="mt-10 md:hidden overflow-hidden">
          <div
            className="flex transition-transform duration-700 ease-out"
            style={{ transform: `translateX(-${mobileIndex * 100}%)` }}
          >
            {REVIEWS.map((review) => (
              <div key={review.name} className="w-full shrink-0 px-1">
                <div className="rounded-xl border border-border/60 bg-card p-8">
                  <div className="mb-4 flex gap-1 text-foreground">
                    {"★★★★★".split("").map((star, idx) => (
                      <span key={idx} className="text-lg">{star}</span>
                    ))}
                  </div>
                  <p className="text-sm italic leading-relaxed text-muted-foreground">"{review.text}"</p>
                  <p className="mt-5 text-sm font-medium tracking-[0.06em] text-foreground">
                    {review.name}
                    <span className="ml-2 text-xs font-normal uppercase tracking-[0.14em] text-muted-foreground">
                      {review.location}
                    </span>
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 flex justify-center gap-2">
            {REVIEWS.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Ver reseña ${i + 1}`}
                onClick={() => setMobileIndex(i)}
                className={`h-1.5 rounded-full transition-all ${mobileIndex === i ? "w-6 bg-foreground" : "w-2 bg-foreground/25"}`}
              />
            ))}
          </div>
        </div>

        {/* Desktop: 3 per page */}
        <div key={startIndex} className="mt-10 hidden md:grid gap-6 md:grid-cols-3 animate-fade-in">
          {visibleReviews.map((review) => (
            <div key={review.name} className="rounded-xl border border-border/60 bg-card p-8">
              <div className="mb-4 flex gap-1 text-foreground">
                {"★★★★★".split("").map((star, idx) => (
                  <span key={idx} className="text-lg">{star}</span>
                ))}
              </div>
              <p className="text-sm italic leading-relaxed text-muted-foreground">"{review.text}"</p>
              <p className="mt-5 text-sm font-medium tracking-[0.06em] text-foreground">
                {review.name}
                <span className="ml-2 text-xs font-normal uppercase tracking-[0.14em] text-muted-foreground">
                  {review.location}
                </span>
              </p>
            </div>
          ))}
        </div>
        <div className="mt-8 hidden md:flex justify-center gap-2">
          {Array.from({ length: Math.ceil(REVIEWS.length / REVIEWS_PER_PAGE) }).map((_, i) => {
            const active = Math.floor(startIndex / REVIEWS_PER_PAGE) === i;
            return (
              <button
                key={i}
                type="button"
                aria-label={`Ver grupo de reseñas ${i + 1}`}
                onClick={() => setStartIndex(i * REVIEWS_PER_PAGE)}
                className={`h-1.5 rounded-full transition-all ${active ? "w-8 bg-foreground" : "w-4 bg-foreground/25"}`}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}




const FAQS = [
  {
    q: "¿Cómo se gestiona el catálogo y los pedidos?",
    a: "El catálogo, el stock y los pedidos se gestionan desde un panel de administración propio, con pagos seguros por tarjeta a través de Stripe.",
  },
  {
    q: "¿Las imágenes de la portada se pueden cambiar?",
    a: "Sí. La galería de portada está pensada para trabajar con tus recursos visuales y evolucionar a medida que cambie la colección o la dirección creativa de la marca.",
  },
  {
    q: "¿La web está optimizada para móvil?",
    a: "Sí. Se ha planteado con un enfoque responsive para que la navegación, el carrusel, las fichas y el proceso de compra mantengan una experiencia sólida en móvil, tablet y escritorio.",
  },
  {
    q: "¿Todo está en español?",
    a: "Sí. La interfaz visible de la tienda se ha planteado en español de España para que el tono de marca y la experiencia de compra sean coherentes con tu mercado.",
  },
];



function Newsletter() {
  return (
    <section className="bg-primary text-primary-foreground">
      <div className="container-luxe mx-auto max-w-2xl py-16 text-center md:py-20">
        <p className="eyebrow mb-3 text-primary-foreground/65">Newsletter</p>
        <h2 className="font-display text-4xl md:text-5xl">Mantén viva la conversación con tu comunidad</h2>
        <p className="mt-4 text-primary-foreground/74">
          Lanza nuevas colecciones, campañas o avisos de reposición desde una imagen de marca coherente y aspiracional.
        </p>
        <form onSubmit={(e) => e.preventDefault()} className="mx-auto mt-8 flex max-w-md flex-col gap-3 sm:flex-row">
          <Input type="email" placeholder="tu@email.com" required className="h-12 rounded-md border-white/20 bg-white text-foreground" />
          <Button type="submit" className="h-12 rounded-md bg-background px-8 text-foreground hover:bg-background/90">
            Suscribirme
          </Button>
        </form>
      </div>
    </section>
  );
}
