import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { SITE_URL } from "@/lib/seo";
import { MODELS } from "@/lib/case-design";
import { modelSlug } from "@/lib/model-pages";

interface SitemapEntry {
  path: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

// Páginas estáticas indexables (las privadas llevan noindex y quedan fuera).
const STATIC_ENTRIES: SitemapEntry[] = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/tienda", changefreq: "daily", priority: "0.9" },
  { path: "/fundas", changefreq: "weekly", priority: "0.8" },
  { path: "/fundas-sublimacion", changefreq: "daily", priority: "0.8" },
  { path: "/mas-vendido", changefreq: "daily", priority: "0.8" },
  { path: "/personalizar", changefreq: "weekly", priority: "0.7" },
  { path: "/fundas-personalizadas", changefreq: "weekly", priority: "0.9" },
  { path: "/accesorios", changefreq: "weekly", priority: "0.7" },
  { path: "/accesorios/colgantes", changefreq: "weekly", priority: "0.6" },
  { path: "/accesorios/protectores", changefreq: "weekly", priority: "0.6" },
  { path: "/accesorios/cargadores", changefreq: "weekly", priority: "0.6" },
  { path: "/accesorios/otros", changefreq: "weekly", priority: "0.5" },
  { path: "/contacto", changefreq: "monthly", priority: "0.5" },
  { path: "/terminos", changefreq: "yearly", priority: "0.2" },
  { path: "/privacidad", changefreq: "yearly", priority: "0.2" },
];

// Una página por modelo de iPhone: /fundas-personalizadas/iphone-15-pro, etc.
const MODEL_ENTRIES: SitemapEntry[] = MODELS.map((m) => ({
  path: `/fundas-personalizadas/${modelSlug(m)}`,
  changefreq: "monthly",
  priority: "0.8",
}));

// Fichas de producto (dinámicas): se leen de Supabase para que el sitemap se
// mantenga solo al añadir/quitar productos desde el panel.
async function productEntries(): Promise<SitemapEntry[]> {
  try {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) return [];
    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const { data } = await supabase
      .from("products")
      .select("handle")
      .eq("status", "active")
      .eq("is_custom", false);
    return ((data ?? []) as Array<{ handle: string }>).map((p) => ({
      path: `/product/${p.handle}`,
      changefreq: "weekly",
      priority: "0.7",
    }));
  } catch {
    return []; // si falla, se devuelve el sitemap con las páginas estáticas
  }
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries = [...STATIC_ENTRIES, ...MODEL_ENTRIES, ...(await productEntries())];

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${SITE_URL}${e.path}</loc>`,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
