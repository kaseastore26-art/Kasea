import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { CheckCircle2, Package, Loader2, Store } from "lucide-react";
import { useCartStore } from "@/lib/cart";
import { getOrderBySession } from "@/lib/orders.functions";
import { addStoredOrder, statusLabel, toneClasses, formatCents } from "@/lib/orders-local";

export const Route = createFileRoute("/checkout/exito")({
  validateSearch: (search: Record<string, unknown>): { session_id?: string } =>
    typeof search.session_id === "string" ? { session_id: search.session_id } : {},
  head: () => ({
    meta: [
      { title: "¡Gracias por tu compra! — Kasea Store" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CheckoutSuccessPage,
});

function CheckoutSuccessPage() {
  const { session_id } = Route.useSearch();
  const clearCart = useCartStore((s) => s.clearCart);
  const getOrder = useServerFn(getOrderBySession);
  const attempts = useRef(0);
  const purchaseSent = useRef(false);

  // El pago ya se completó en Stripe (solo se llega aquí tras éxito): vaciamos
  // la bolsa local. La confirmación real del pedido y el correo los gestiona
  // el webhook en el servidor, que es la fuente de verdad.
  useEffect(() => {
    clearCart();
  }, [clearCart]);

  // Guardamos el pedido en el historial local en cuanto tengamos el session_id
  // (aunque el webhook aún no lo haya procesado; luego se completa al cargar).
  useEffect(() => {
    if (session_id) {
      addStoredOrder({
        sessionId: session_id,
        savedAt: Date.now(),
        totalCents: 0,
        currency: "EUR",
        itemCount: 0,
        firstTitle: "Pedido",
      });
    }
  }, [session_id]);

  // Leemos el pedido del servidor. El webhook puede tardar 1-2 s en crearlo, así
  // que reintentamos unas veces hasta que aparezca.
  const { data: order, isFetching } = useQuery({
    queryKey: ["order", session_id],
    queryFn: () => getOrder({ data: { sessionId: session_id! } }),
    enabled: !!session_id,
    refetchInterval: (query) => {
      if (query.state.data) return false;
      attempts.current += 1;
      return attempts.current < 8 ? 2000 : false; // ~16 s de margen
    },
  });

  // Cuando llega el detalle real, actualizamos el registro local con importes.
  useEffect(() => {
    if (order && session_id) {
      addStoredOrder({
        sessionId: session_id,
        savedAt: Date.now(),
        totalCents: order.totalCents,
        currency: order.currency,
        itemCount: order.items.reduce((s, i) => s + i.quantity, 0),
        firstTitle: order.items[0]?.title ?? "Pedido",
        status: order.status,
      });
    }
  }, [order, session_id]);
  useEffect(() => {
  if (!order || !session_id || purchaseSent.current) return;
  if (order.paymentStatus !== "paid") return;

  const fbq = (window as any).fbq;

  if (typeof fbq !== "function") return;

  const items = order.items
    .filter((item) => item.variantId)
    .map((item) => ({
      id: item.variantId!,
      quantity: item.quantity,
    }));

  if (items.length === 0) return;

  fbq("track", "Purchase", {
    content_ids: items.map((item) => item.id),
    content_type: "product",
    contents: items,
    value: order.totalCents / 100,
    currency: order.currency,
  });

  purchaseSent.current = true;
}, [order, session_id]);

  const badge = order ? statusLabel(order.status) : null;
  const cashPending = order?.paymentStatus === "pending";

  return (
    <div className="container-luxe py-20 md:py-24">
      <div className="text-center">
        <CheckCircle2 className="mx-auto h-16 w-16 text-espresso" strokeWidth={1.25} />
        <h1 className="mt-6 font-display text-4xl md:text-5xl">
          {cashPending ? "¡Pedido registrado!" : "¡Gracias por tu compra!"}
        </h1>
        <p className="mx-auto mt-4 max-w-md text-muted-foreground">
          {cashPending
            ? "Hemos reservado tu pedido. Pásate por la tienda a recogerlo y pagar en efectivo; te avisaremos cuando esté listo."
            : "Tu pago se ha completado correctamente. Te hemos enviado un correo con la confirmación de tu pedido y lo estamos preparando con cuidado."}
        </p>
      </div>

      {/* Resumen del pedido (en cuanto el webhook lo confirma en el servidor). */}
      <div className="mx-auto mt-10 max-w-md">
        {order ? (
          <div className="rounded-xl border border-border/60 bg-card p-6">
            {badge && (
              <span
                className={`mb-4 inline-flex rounded-full border px-3 py-1 text-xs font-medium ${toneClasses(
                  badge.tone,
                )}`}
              >
                {badge.label}
              </span>
            )}
            {order.deliveryMethod === "pickup" && (
              <p className="mb-3 flex items-center gap-1.5 text-sm text-muted-foreground">
                <Store className="h-4 w-4" strokeWidth={1.5} /> Recogida en tienda
              </p>
            )}
            {cashPending && (
              <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                Pago pendiente: paga{" "}
                <strong>{formatCents(order.totalCents, order.currency)}</strong> en efectivo al
                recoger tu pedido.
              </div>
            )}
            <ul className="divide-y divide-border/60">
              {order.items.map((it, idx) => {
                const attrs = it.attributes
                  .filter((a) => !a.value.startsWith("http"))
                  .map((a) => `${a.key}: ${a.value}`)
                  .join(" · ");
                return (
                  <li key={idx} className="flex items-start justify-between gap-4 py-3 text-sm">
                    <span>
                      {it.title} × {it.quantity}
                      {attrs && <span className="mt-0.5 block text-xs text-muted-foreground">{attrs}</span>}
                    </span>
                    <span className="tabular-nums whitespace-nowrap">
                      {formatCents(it.unitPriceCents * it.quantity, order.currency)}
                    </span>
                  </li>
                );
              })}
            </ul>
            <div className="mt-3 space-y-1.5 border-t border-border/60 pt-3 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span className="tabular-nums">{formatCents(order.subtotalCents, order.currency)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Envío</span>
                <span className="tabular-nums">
                  {order.shippingCents === 0 ? "Gratis" : formatCents(order.shippingCents, order.currency)}
                </span>
              </div>
              <div className="flex justify-between pt-1 font-medium">
                <span>Total</span>
                <span className="tabular-nums">{formatCents(order.totalCents, order.currency)}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-card p-5 text-left">
            {isFetching ? (
              <Loader2 className="mt-0.5 h-5 w-5 flex-shrink-0 animate-spin text-espresso" strokeWidth={1.5} />
            ) : (
              <Package className="mt-0.5 h-5 w-5 flex-shrink-0 text-espresso" strokeWidth={1.5} />
            )}
            <p className="text-sm text-muted-foreground">
              Estamos confirmando tu pedido. Recibirás el correo de confirmación en un momento; también
              puedes consultarlo en <Link to="/mis-pedidos" className="underline underline-offset-2">Mis pedidos</Link>.
            </p>
          </div>
        )}
      </div>

      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <Link
          to="/mis-pedidos"
          className="inline-flex h-12 items-center gap-2 rounded-md bg-espresso px-7 text-sm font-medium uppercase tracking-[0.14em] text-ivory transition-transform hover:-translate-y-0.5"
        >
          Ver mis pedidos
        </Link>
        <Link
          to="/tienda"
          className="inline-flex h-12 items-center gap-2 rounded-md border border-border px-7 text-sm font-medium uppercase tracking-[0.14em] transition-colors hover:bg-secondary"
        >
          Seguir comprando
        </Link>
      </div>
    </div>
  );
}
