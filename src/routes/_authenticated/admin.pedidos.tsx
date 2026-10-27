/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, ChevronDown, Package, Truck, Store, AlertTriangle, Trash2, Banknote } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/shopify";
import { listOrdersAdmin, updateOrderStatus, deleteOrderAdmin, markOrderPaid } from "@/lib/admin-catalog.functions";

export const Route = createFileRoute("/_authenticated/admin/pedidos")({
  component: AdminPedidos,
});

const STATUS_LABEL: Record<string, string> = {
  paid: "En preparación",
  fulfilled: "Enviado",
  delivered: "Entregado",
  cancelled: "Cancelado",
  refunded: "Reembolsado",
};

function fmtDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" }).format(
      new Date(iso),
    );
  } catch {
    return iso;
  }
}

function AdminPedidos() {
  const qc = useQueryClient();
  const listFn = useServerFn(listOrdersAdmin);
  const statusFn = useServerFn(updateOrderStatus);
  const deleteFn = useServerFn(deleteOrderAdmin);
  const markPaidFn = useServerFn(markOrderPaid);
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: () => listFn(),
  });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Borra un pedido concreto (pensado para los pedidos de prueba)
  async function removeOrder(o: any) {
    const who = o.customer_name || o.email || "Cliente";
    const total = formatPrice((o.total_cents ?? 0) / 100, o.currency || "EUR");
    if (
      !confirm(
        `¿Borrar el pedido de ${who} (${total}, ${fmtDate(o.created_at)})?\n\nSe elimina para siempre y no se puede deshacer.`,
      )
    )
      return;
    setDeleting(o.id);
    try {
      await deleteFn({ data: { id: o.id } });
      setExpanded(null);
      await qc.invalidateQueries({ queryKey: ["admin-orders"] });
      await qc.invalidateQueries({ queryKey: ["admin", "orders-print"] });
      toast.success("Pedido borrado");
    } catch (e) {
      toast.error("No se pudo borrar el pedido", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setDeleting(null);
    }
  }

  async function changeStatus(id: string, status: string) {
    try {
      await statusFn({
        data: { id, status: status as "paid" | "fulfilled" | "delivered" | "cancelled" | "refunded" },
      });
      await qc.invalidateQueries({ queryKey: ["admin-orders"] });
      toast.success("Estado actualizado");
    } catch (e) {
      toast.error("No se pudo actualizar", { description: e instanceof Error ? e.message : undefined });
    }
  }

  async function markPaid(id: string) {
    try {
      await markPaidFn({ data: { id } });
      await qc.invalidateQueries({ queryKey: ["admin-orders"] });
      toast.success("Cobro en efectivo registrado");
    } catch (e) {
      toast.error("No se pudo registrar el cobro", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl">Pedidos</h2>
          <p className="text-sm text-muted-foreground">
            Consulta pedidos, cambia su estado y revisa los diseños personalizados.
          </p>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center">
          <Package className="mx-auto h-10 w-10 text-muted-foreground" strokeWidth={1} />
          <p className="mt-3 text-sm text-muted-foreground">Aún no hay pedidos.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((o: any) => {
            const isOpen = expanded === o.id;
            const address = o.shipping_address?.address ?? o.shipping_address ?? null;
            return (
              <div key={o.id} className="rounded-lg border bg-card">
                <button
                  onClick={() => setExpanded(isOpen ? null : o.id)}
                  className="flex w-full items-center justify-between gap-4 p-4 text-left"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{o.customer_name || o.email || "Cliente"}</span>
                      {o.needs_review && (
                        <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
                          <AlertTriangle className="h-3 w-3" /> Revisar
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                      {o.delivery_method === "pickup" ? (
                        <Store className="h-3.5 w-3.5" />
                      ) : (
                        <Truck className="h-3.5 w-3.5" />
                      )}
                      {fmtDate(o.created_at)}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="tabular-nums font-medium">
                      {formatPrice((o.total_cents ?? 0) / 100, o.currency || "EUR")}
                    </span>
                    {o.payment_status === "pending" ? (
                      <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                        Efectivo · Pendiente
                      </span>
                    ) : o.payment_method === "cash" ? (
                      <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-800">
                        Efectivo · Pagado
                      </span>
                    ) : null}
                    <span className="rounded bg-secondary px-2 py-0.5 text-xs">
                      {STATUS_LABEL[o.status] ?? o.status}
                    </span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t p-4 text-sm">
                    <div className="grid gap-6 md:grid-cols-2">
                      {/* Datos del cliente / entrega */}
                      <div>
                        <h3 className="eyebrow mb-2">Cliente y entrega</h3>
                        <p>{o.email}</p>
                        {o.phone && <p className="text-muted-foreground">{o.phone}</p>}
                        <p className="mt-2 font-medium">
                          {o.delivery_method === "pickup" ? "Recoger en tienda" : "Envío a domicilio"}
                        </p>
                        {o.delivery_method === "delivery" && address && (
                          <p className="mt-1 text-muted-foreground">
                            {[address.line1, address.line2, address.postal_code, address.city, address.country]
                              .filter(Boolean)
                              .join(", ")}
                          </p>
                        )}
                        <div className="mt-4">
                          <label className="text-xs text-muted-foreground">Estado del pedido</label>
                          <select
                            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            value={o.status}
                            onChange={(e) => changeStatus(o.id, e.target.value)}
                          >
                            {Object.entries(STATUS_LABEL)
                              // En recogida en tienda no hay "Enviado": el cliente pasa a
                              // recogerlo, así que el estado útil es "Entregado".
                              .filter(([v]) => !(o.delivery_method === "pickup" && v === "fulfilled"))
                              .map(([v, l]) => (
                                <option key={v} value={v}>
                                  {l}
                                </option>
                              ))}
                          </select>
                          {o.delivery_method === "pickup" && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Recogida en tienda: marca “Entregado” cuando el cliente lo recoja.
                            </p>
                          )}
                        </div>

                        {/* Pago: método + estado, con botón para registrar el cobro en efectivo. */}
                        <div className="mt-4">
                          <label className="text-xs text-muted-foreground">Pago</label>
                          <p className="mt-1 font-medium">
                            {o.payment_method === "cash" ? "Efectivo en tienda" : "Tarjeta (Stripe)"} ·{" "}
                            {o.payment_status === "pending" ? "Pendiente de cobro" : "Pagado"}
                          </p>
                          {o.payment_status === "pending" && (
                            <Button size="sm" className="mt-2 gap-2" onClick={() => markPaid(o.id)}>
                              <Banknote className="h-4 w-4" /> Marcar como cobrado (
                              {formatPrice((o.total_cents ?? 0) / 100, o.currency || "EUR")})
                            </Button>
                          )}
                        </div>

                        {/* Borrar este pedido (p. ej. pedidos de prueba) */}
                        <div className="mt-6 border-t pt-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => removeOrder(o)}
                            disabled={deleting !== null}
                            className="gap-2 text-destructive hover:text-destructive"
                          >
                            {deleting === o.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                            Borrar este pedido
                          </Button>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Útil para quitar pedidos de prueba. Te pedirá confirmación.
                          </p>
                        </div>
                      </div>

                      {/* Líneas + totales */}
                      <div>
                        <h3 className="eyebrow mb-2">Artículos</h3>
                        <ul className="space-y-3">
                          {(o.order_items ?? []).map((it: any) => (
                            <li key={it.id} className="border-b pb-3 last:border-0">
                              <div className="flex justify-between gap-2">
                                <span>
                                  {it.title} × {it.quantity}
                                </span>
                                <span className="tabular-nums">
                                  {formatPrice((it.unit_price_cents * it.quantity) / 100, o.currency || "EUR")}
                                </span>
                              </div>
                              {/* Atributos legibles */}
                              {Array.isArray(it.attributes) && it.attributes.length > 0 && (
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {it.attributes
                                    .filter((a: any) => !String(a.value).startsWith("http"))
                                    .map((a: any) => `${a.key}: ${a.value}`)
                                    .join(" · ")}
                                </p>
                              )}
                              {/* Diseño personalizado (para producción) */}
                              {it.custom_designs && (
                                <div className="mt-2 rounded-md border bg-secondary/30 p-3">
                                  <p className="mb-2 text-xs font-medium text-espresso">Diseño personalizado</p>
                                  <div className="flex gap-3">
                                    {it.custom_designs.preview_url && (
                                      <a
                                        href={it.custom_designs.preview_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="block h-24 w-20 flex-shrink-0 overflow-hidden rounded border bg-white"
                                      >
                                        <img
                                          src={it.custom_designs.preview_url}
                                          alt="Diseño"
                                          className="h-full w-full object-contain"
                                        />
                                      </a>
                                    )}
                                    <dl className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
                                      <dt className="text-muted-foreground">Modelo</dt>
                                      <dd>{it.custom_designs.model || "—"}</dd>
                                      <dt className="text-muted-foreground">Texto</dt>
                                      <dd>{it.custom_designs.text_content || "—"}</dd>
                                      <dt className="text-muted-foreground">Fuente</dt>
                                      <dd>{it.custom_designs.font || "—"}</dd>
                                      <dt className="text-muted-foreground">Color</dt>
                                      <dd>{it.custom_designs.color || "—"}</dd>
                                    </dl>
                                  </div>
                                </div>
                              )}
                            </li>
                          ))}
                        </ul>
                        <div className="mt-3 space-y-1 text-sm">
                          <div className="flex justify-between text-muted-foreground">
                            <span>Subtotal</span>
                            <span className="tabular-nums">
                              {formatPrice((o.subtotal_cents ?? 0) / 100, o.currency || "EUR")}
                            </span>
                          </div>
                          <div className="flex justify-between text-muted-foreground">
                            <span>Envío</span>
                            <span className="tabular-nums">
                              {o.shipping_cents === 0
                                ? "Gratis"
                                : formatPrice((o.shipping_cents ?? 0) / 100, o.currency || "EUR")}
                            </span>
                          </div>
                          <div className="flex justify-between border-t pt-1 font-medium">
                            <span>Total</span>
                            <span className="tabular-nums">
                              {formatPrice((o.total_cents ?? 0) / 100, o.currency || "EUR")}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
