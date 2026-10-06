import { createFileRoute } from "@tanstack/react-router";
import { AccessoryCategoryPage } from "@/components/AccessoryCategoryPage";

export const Route = createFileRoute("/accesorios/otros")({
  head: () => ({
    meta: [
      { title: "Otros accesorios — Kasea Store" },
      {
        name: "description",
        content: "Descubre otros accesorios para tu móvil.",
      },
    ],
  }),
  component: () => <AccessoryCategoryPage category="otros" />,
});
