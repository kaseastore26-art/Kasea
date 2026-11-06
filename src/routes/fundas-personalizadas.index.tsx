// ============================================================================
// /fundas-personalizadas — índice de todos los modelos (SEO + enlaces internos).
// ============================================================================
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { SITE_URL, seo } from "@/lib/seo";
import { CaseMockup } from "@/components/CaseMockup";
import { modelSlug, modelsBySeries } from "@/lib/model-pages";

export const Route = createFileRoute("/fundas-personalizadas/")({
  head: () => {
    const base = seo({
      title: "Fundas personalizadas para iPhone con tu foto | Kasea Store",
      description:
        "Crea tu funda personalizada para iPhone con tu foto, un collage o tu propio diseño. Elige tu modelo: iPhone 17, 16, 15, 14, 13, 12 y 11. Sublimación 3D y envío a toda España.",
      path: "/fundas-personalizadas",
    });
    return {
      ...base,
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Inicio", item: `${SITE_URL}/` },
              { "@type": "ListItem", position: 2, name: "Fundas personalizadas", item: `${SITE_URL}/fundas-personalizadas` },
            ],
          }),
        },
      ],
    };
  },
  component: ModelsIndex,
});

function ModelsIndex() {
  const groups = modelsBySeries();

  return (
    <div className="container-luxe py-12 md:py-20">
      <header className="mx-auto mb-14 max-w-2xl text-center">
        <p className="eyebrow mb-3">Diseña la tuya</p>
        <h1 className="font-display text-4xl leading-tight md:text-6xl">Fundas personalizadas para iPhone</h1>
        <p className="mt-4 text-muted-foreground">
          Elige tu modelo y crea una funda única con tu foto, un collage o tu propio diseño. La imprimimos por
          sublimación 3D: la imagen cubre la trasera y los laterales. ¿Prefieres algo ya creado? Mira también{" "}
          <Link to="/fundas-sublimacion" className="underline underline-offset-4">
            nuestras fundas con diseño exclusivo
          </Link>
          .
        </p>
        <Link
          to="/personalizar"
          className="mt-8 inline-flex h-12 items-center gap-2 rounded-md bg-black px-7 text-xs font-medium uppercase tracking-[0.14em] text-white transition-colors hover:bg-neutral-800"
        >
          Empezar a diseñar <ArrowRight className="h-4 w-4" />
        </Link>
      </header>

      <div className="space-y-12">
        {groups.map((g) => (
          <section key={g.series}>
            <h2 className="mb-5 font-display text-2xl">Fundas personalizadas iPhone {g.series}</h2>
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {g.models.map((m) => (
                <li key={m}>
                  <Link
                    to="/fundas-personalizadas/$modelo"
                    params={{ modelo: modelSlug(m) }}
                    className="group flex h-full flex-col items-center rounded-lg border border-border bg-card p-4 text-center transition-colors hover:bg-secondary"
                  >
                    <CaseMockup model={m} className="h-32 w-auto transition-transform group-hover:scale-105" />
                    <span className="mt-3 text-sm font-medium">Funda {m}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
