/* eslint-disable @typescript-eslint/no-explicit-any */
// Pagos que se quedaron a medias (NO son pedidos: no hay que enviar nada).
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, Mail, Check } from "lucide-react";
import { toast } from "sonner";
import { listAbandonedCheckoutsAdmin, sendCartReminderAdmin } from "@/lib/admin-catalog.functions";

export const Route = createFileRoute("/_authenticated/admin/a-medias")({
  component: AdminAMedias,
});

const eur = (c: number) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format((c ?? 0) / 100);

function AdminAMedias() {
  const listFn = useServerFn(listAbandonedCheckoutsAdmin);
  const { data: rows = [], isLoading } = useQuery({ queryKey: ["admin", "abandoned"], queryFn: () => listFn() });
  const pending = (rows as any[]).filter((r) => !r.recovered).length;
  const sendFn = useServerFn(sendCartReminderAdmin);
  const [busy, setBusy] = useState<string | null>(null);
  const [sent, setSent] = useState<Record<string, boolean>>({});

  async function send(r: any) {
    if (!confirm(`¿Mandar el recordatorio a ${r.customer_name || r.email}?`)) return;
    setBusy(r.id);
    try {
      const res = await sendFn({ data: { sessionId: r.stripe_session_id } });
      if ("error" in res) toast.error(res.error);
      else {
        setSent((m) => ({ ...m, [r.id]: true }));
        toast.success("Recordatorio enviado");
      }
    } catch {
      toast.error("No se pudo enviar");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="font-display text-2xl">Pagos a medias</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          <strong>No son pedidos y no hay que enviar nada.</strong> Son clientes que empezaron a pagar y no terminaron
          en los últimos 30 días. A cada uno le llega un recordatorio automático por correo.
        </p>
        {rows.length > 0 && (
          <p className="mt-2 text-sm">
            {rows.length} en total · <strong>{pending} sin terminar</strong> · {rows.length - pending} compraron después
          </p>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Consultando a Stripe…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center text-sm text-muted-foreground">
          Nadie ha dejado un pago a medias en los últimos 30 días.
        </div>
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {(rows as any[]).map((r) => (
            <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 text-sm">
              <div className="min-w-0">
                <p className="font-medium">
                  {r.customer_name || "Sin nombre"}{" "}
                  {r.recovered ? (
                    <span className="ml-1 rounded bg-green-100 px-1.5 py-0.5 text-[11px] text-green-800">Compró después</span>
                  ) : (
                    <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-800">Sin terminar</span>
                  )}
                </p>
                <p className="text-muted-foreground">
                  {r.email}
                  {r.phone ? ` · ${r.phone}` : ""}
                </p>
                <p className="mt-1 text-muted-foreground">
                  {((r.items ?? []) as any[])
                    .map((it) => `${it.title}${it.quantity > 1 ? ` × ${it.quantity}` : ""}${it.model ? ` (${it.model})` : ""}`)
                    .join(", ")}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1 text-right">
                <p className="font-medium tabular-nums">{eur(r.total_cents)}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleString("es-ES", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
                {!r.recovered && r.autoReminded && (
                  <span className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Check className="h-3.5 w-3.5" /> Recordatorio automático enviado
                  </span>
                )}
                {!r.recovered &&
                  !r.autoReminded &&
                  (sent[r.id] ? (
                    <span className="mt-1 inline-flex items-center gap-1 text-xs text-green-700">
                      <Check className="h-3.5 w-3.5" /> Enviado
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => send(r)}
                      disabled={busy === r.id}
                      className="mt-1 inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs hover:bg-secondary disabled:opacity-50"
                    >
                      {busy === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                      Enviar recordatorio
                    </button>
                  ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
