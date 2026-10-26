/* eslint-disable @typescript-eslint/no-explicit-any */
// ============================================================================
// Admin → Imprimir: fundas personalizadas listas para producción.
// Genera el archivo a 300 ppp con el tamaño exacto de la plantilla de Photoshop
// (grande o pequeña). Se abre en Photoshop, se aplica espejo + perfil y se imprime.
// ============================================================================
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AlertTriangle, Download, ExternalLink, Loader2, Printer, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { listOrdersAdmin } from "@/lib/admin-catalog.functions";
import { renderPrintFile } from "@/lib/design-render";
import { LOW_DPI, TEMPLATES, isDesignV2, templateForModel, type TemplateId } from "@/lib/case-design";

export const Route = createFileRoute("/_authenticated/admin/imprimir")({
  component: AdminImprimir,
});

const STATUS: Record<string, { label: string; tone: string }> = {
  paid: { label: "Pendiente", tone: "bg-amber-100 text-amber-900" },
  fulfilled: { label: "Enviado", tone: "bg-sky-100 text-sky-900" },
  delivered: { label: "Entregado", tone: "bg-emerald-100 text-emerald-800" },
  cancelled: { label: "Cancelado", tone: "bg-muted text-muted-foreground" },
  refunded: { label: "Reembolsado", tone: "bg-muted text-muted-foreground" },
};

function slug(s: string): string {
  return (
    (s || "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "cliente"
  );
}

function formatDate(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

type Job = { key: string; order: any; item: any; design: any };

function AdminImprimir() {
  const listFn = useServerFn(listOrdersAdmin);
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "orders-print"],
    queryFn: () => listFn(),
  });
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const jobs: Job[] = ((data ?? []) as any[]).flatMap((order) =>
    ((order.order_items ?? []) as any[])
      .map((item, i) => {
        const d = Array.isArray(item.custom_designs) ? item.custom_designs[0] : item.custom_designs;
        return d ? { key: `${order.id}-${i}`, order, item, design: d } : null;
      })
      .filter(Boolean) as Job[],
  );
  const visible = showAll ? jobs : jobs.filter((j) => j.order.status === "paid");

  async function download(job: Job, templateId: TemplateId) {
    const d = job.design;
    const p = d.params;
    if (!isDesignV2(p) || !d.image_url) return;
    const id = `${job.key}-${templateId}`;
    setBusy(id);
    try {
      const blob = await renderPrintFile(d.image_url, { cx: p.cx, cy: p.cy, w: p.w, rot: p.rot }, templateId);
      const date = (job.order.created_at ?? "").slice(0, 10);
      const name = `kasea_${slug(d.model ?? "funda")}_${slug(job.order.customer_name ?? "")}_${date}_${templateId}.png`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast.success("Archivo listo para Photoshop");
    } catch (e) {
      toast.error("No se pudo generar el archivo", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-2xl">Fundas para imprimir</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Descarga cada diseño ya montado en su plantilla y centrado en una hoja de 15 × 24 cm (300 ppp, RGB),
            con la foto cubriendo la parte trasera y los laterales. Ábrelo en Photoshop, aplica el espejo y tu perfil
            de color, e imprime al 100 %.
          </p>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
          Ver también enviados y entregados
        </label>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : visible.length === 0 ? (
        <p className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
          {showAll ? "No hay fundas personalizadas todavía." : "No hay fundas personalizadas pendientes."}
        </p>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {visible.map((job) => {
            const d = job.design;
            const p = d.params;
            const v2 = isDesignV2(p);
            const recommended: TemplateId = v2 ? p.template : templateForModel(d.model ?? "");
            const other: TemplateId = recommended === "grande" ? "pequena" : "grande";
            const st = STATUS[job.order.status] ?? { label: job.order.status, tone: "bg-muted" };
            return (
              <div key={job.key} className="flex gap-4 rounded-lg border bg-card p-4 shadow-sm">
                <div className="w-24 flex-shrink-0">
                  {d.preview_url ? (
                    <img src={d.preview_url} alt="Diseño" className="w-full rounded object-contain" />
                  ) : (
                    <div className="aspect-[1/2] rounded bg-secondary" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-display text-lg leading-tight">{d.model || "Funda personalizada"}</p>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${st.tone}`}>{st.label}</span>
                  </div>
                  <p className="mt-1 truncate text-sm text-muted-foreground">
                    {job.order.customer_name || "—"} · {formatDate(job.order.created_at)}
                  </p>
                  <p className="text-xs text-muted-foreground">Pedido {String(job.order.id).slice(0, 8)}</p>

                  {v2 && p.dpi < LOW_DPI && (
                    <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-800">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                      Foto de baja calidad (~{p.dpi} ppp). El cliente aceptó el aviso.
                    </p>
                  )}

                  {v2 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        className="gap-1.5"
                        disabled={busy !== null}
                        onClick={() => download(job, recommended)}
                      >
                        {busy === `${job.key}-${recommended}` ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                        {TEMPLATES[recommended].label}
                        <Star className="h-3.5 w-3.5 fill-current" aria-label="Recomendada" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        disabled={busy !== null}
                        onClick={() => download(job, other)}
                      >
                        {busy === `${job.key}-${other}` ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Printer className="h-4 w-4" />
                        )}
                        {TEMPLATES[other].label}
                      </Button>
                    </div>
                  ) : (
                    <div className="mt-3">
                      <p className="mb-2 text-xs text-muted-foreground">
                        Diseño hecho con el editor anterior: móntalo en la plantilla como siempre.
                      </p>
                      {d.preview_url && (
                        <a
                          href={d.preview_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm underline underline-offset-4"
                        >
                          <ExternalLink className="h-4 w-4" /> Abrir imagen
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
