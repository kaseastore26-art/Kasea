import { createFileRoute } from "@tanstack/react-router";
import { AccessoryCategoryPage } from "@/components/AccessoryCategoryPage";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/accesorios/cargadores")({
  head: () =>
    seo({
      title: "Cargadores para móvil — Kasea Store",
      description: "Descubre nuestros cargadores para móvil.",
      path: "/accesorios/cargadores",
    }),
  component: () => <AccessoryCategoryPage category="cargadores" />,
});
