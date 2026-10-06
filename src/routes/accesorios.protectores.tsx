import { createFileRoute } from "@tanstack/react-router";
import { AccessoryCategoryPage } from "@/components/AccessoryCategoryPage";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/accesorios/protectores")({
  head: () =>
    seo({
      title: "Protectores para móvil — Kasea Store",
      description: "Descubre nuestros protectores para móvil.",
      path: "/accesorios/protectores",
    }),
  component: () => <AccessoryCategoryPage category="protectores" />,
});
