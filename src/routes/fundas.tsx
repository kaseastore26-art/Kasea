import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import catSublimacion from "@/assets/cat-sublimacion.jpg";
import { useCategoryImages, pickCategoryImage, type CategorySlug } from "@/hooks/useCategoryImages";
import { seo } from "@/lib/seo";

const CATEGORIES: Array<{
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

export const Route = createFileRoute("/fundas")({
  head: () =>
    seo({
      title: "Fundas para iPhone: diseños exclusivos y personalizadas | Kasea Store",
      description:
        "Fundas para iPhone de Kasea: elige entre nuestros diseños exclusivos o crea tu funda personalizada con tu foto. Sublimación 3D y envío a toda España.",
      path: "/fundas",
    }),
  component: FundasCategoriesPage,
});

function FundasCategoriesPage() {
  const { data: overrides } = useCategoryImages();
  return (
    <section className="bg-background">
      <div className="container-luxe py-16 md:py-24">
        <div className="mx-auto mb-10 max-w-2xl text-center md:mb-14">
          <p className="eyebrow mb-3">Categorías destacadas</p>
          <h1 className="font-display text-4xl md:text-5xl">Encuentra tu estilo de funda</h1>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            Explora nuestra colección y elige el acabado que mejor se adapta a ti.
          </p>
        </div>

        <div className="mx-auto grid max-w-md grid-cols-1 gap-6 md:gap-8">
          {CATEGORIES.map((cat, i) => {
            const picked = pickCategoryImage(overrides, cat.slug, cat.image, cat.alt);
            return (
              <Link
                key={cat.to}
                to={cat.to}
                style={{ animationDelay: `${i * 120}ms` }}
                className="group relative block overflow-hidden rounded-xl border border-border/60 bg-card shadow-[var(--shadow-soft)] transition-all duration-500 hover:-translate-y-1 hover:shadow-[var(--shadow-elevated)] animate-fade-in"
              >
                <div className="relative aspect-[4/5] overflow-hidden sm:aspect-[3/4] lg:aspect-[4/5]">
                  <img
                    src={picked.url}
                    alt={picked.alt}
                    loading="lazy"
                    width={1200}
                    height={1500}
                    className="h-full w-full object-cover transition-transform duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(20,15,10,0.72)_0%,rgba(20,15,10,0.15)_45%,transparent_75%)]" />
                  <div className="absolute inset-x-0 bottom-0 p-6 md:p-7 text-white">
                    <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/75">{cat.subtitle}</p>
                    <h2 className="mt-2 font-display text-2xl leading-tight md:text-[1.75rem]">{cat.title}</h2>
                    <span className="mt-4 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-white/90 transition-all group-hover:gap-3">
                      Ver colección <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
