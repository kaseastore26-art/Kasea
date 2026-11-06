// ============================================================================
// Páginas SEO por modelo: /fundas-personalizadas/iphone-15-pro, etc.
// Cada modelo del editor (MODELS en case-design.ts) tiene su propia página,
// pensada para búsquedas como "funda iPhone 15 Pro personalizada".
// ============================================================================
import { MODELS } from "@/lib/case-design";

/** "iPhone 15 Pro Max" -> "iphone-15-pro-max" */
export function modelSlug(model: string): string {
  return model
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** "iphone-15-pro-max" -> "iPhone 15 Pro Max" (o null si no existe) */
export function modelFromSlug(slug: string): string | null {
  const s = slug.toLowerCase();
  return MODELS.find((m) => modelSlug(m) === s) ?? null;
}

/** Número de generación ("iPhone 15 Pro" -> "15"). */
export function modelSeries(model: string): string {
  return model.match(/iPhone (\d+)/)?.[1] ?? "";
}

/** Modelos agrupados por generación, de la más nueva a la más antigua. */
export function modelsBySeries(): Array<{ series: string; models: string[] }> {
  const groups = new Map<string, string[]>();
  for (const m of MODELS) {
    const s = modelSeries(m);
    if (!groups.has(s)) groups.set(s, []);
    groups.get(s)!.push(m);
  }
  return [...groups.entries()]
    .sort((a, b) => Number(b[0]) - Number(a[0]))
    .map(([series, models]) => ({ series, models }));
}

/** Modelos "vecinos" para enlazar al final de cada página. */
export function relatedModels(model: string, max = 8): string[] {
  const series = modelSeries(model);
  const same = MODELS.filter((m) => m !== model && modelSeries(m) === series);
  const others = MODELS.filter((m) => m !== model && modelSeries(m) !== series);
  return [...same, ...others].slice(0, max);
}

export const CUSTOM_PRODUCT_HANDLE = "funda-personalizada";
