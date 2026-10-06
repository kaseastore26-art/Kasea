import { createFileRoute } from "@tanstack/react-router";
import { AccessoryCategoryPage } from "@/components/AccessoryCategoryPage";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/accesorios/colgantes")({
  head: () =>
    seo({
      title: "Colgantes para móvil — Kasea Store",
      description: "Descubre nuestros colgantes para móvil.",
      path: "/accesorios/colgantes",
    }),
  component: () => <AccessoryCategoryPage category="colgantes" />,
});
