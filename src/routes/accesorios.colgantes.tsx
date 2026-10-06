import { createFileRoute } from "@tanstack/react-router";
import { AccessoryCategoryPage } from "@/components/AccessoryCategoryPage";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/accesorios/colgantes")({
  head: () =>
    seo({
      title: "Cuerdas para el móvil — Kasea Store",
      description: "Descubre nuestras cuerdas para el móvil.",
      path: "/accesorios/colgantes",
    }),
  component: () => <AccessoryCategoryPage category="colgantes" />,
});
