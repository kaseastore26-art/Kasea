import { createFileRoute } from "@tanstack/react-router";
import { CollectionPage } from "@/components/CollectionPage";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/fundas-sublimacion")({
  head: () =>
    seo({
      title: "Fundas para el móvil — Kasea Store",
      description:
        "Fundas para iPhone con calidad premium y colores vibrantes. Personalízala con la imagen, foto o diseño que elijas.",
      path: "/fundas-sublimacion",
    }),
  component: () => (
    <CollectionPage
      collectionHandle="fundas-sublimacion"
      source="all"
      eyebrow="Colección"
      title="Fundas para el móvil"
      intro="Convierte tu funda en una pieza única. Ideales para personalizar con fotografías, ilustraciones o diseños propios."
    />
  ),
});
