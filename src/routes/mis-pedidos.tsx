import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Package, Loader2, ShoppingBag, Store } from "lucide-react";
import { getOrderBySession } from "@/lib/orders.functions";
import {
  getStoredOrders,
  syncStoredOrderStatus,
  statusLabel,
  toneClasses,
  formatCents,
  type StoredOrder,
} from "@/lib/orders-local";

export const Route = createFileRoute("/mis-pedidos")({
  head: () => ({
    meta: [
      { title: "Mis pedidos — Kasea Store" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MisPedidosPage,
});

function MisPedidosPage() {
  // localStorage solo existe en el cliente → cargamos tras el montaje para
  // evitar desajustes de hidratación (SSR).
  const [stored, setStored] = useState<StoredOrder[] | null>(null);
  useEffect(() => {
    setStored(getStoredOrders());
  }, []);

  return (
    <div className="container-luxe py-12 md:py-16">
      <h1 className="font-display text-4xl md:text-5xl">Mis pedidos</h1>
      <p className="mt-3 max-w-xl text-muted-foreground">
        Aquí puedes seguir el estado de las compras que has hecho en este dispositivo.
      </p>

      {stored === null ? (
        <div className="mt-10 flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
        </div>
      ) : stored.length === 0 ? (
        <div className="mt-12 rounded-xl border border-border/60 bg-card p-10 text-center">
          <ShoppingBag className="mx-auto h-12 w-12 text-muted-foreground" strokeWidth={1} />
          <h2 className="mt-5 font-display text-2xl">Aún no tienes pedidos</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            Cuando completes una compra, aparecerá aquí con su estado de preparación y envío.
          </p>
          <Link
            to="/tienda"
            className="mt-7 inline-flex h-12 items-center gap-2 rounded-md bg-espresso px-7 text-sm font-medium uppercase tracking-[0.14em] text-ivory transition-transform hover:-translate-y-0.5"
          >
            Ir a la tienda
          </Link>
        </div>
      ) : (
        <ul className="mt-10 space-y-4">
          {stored.map((o) => (
            <OrderRow key={o.sessionId} stored={o} />
          ))}
        </ul>
      )}
    </div>
  );
}

function OrderRow({ stored }: { stored: StoredOrder }) {
  const getOrder = useServerFn(getOrderBySession);
  const { data: order, isLoading } = useQuery({
    queryKey: ["order", stored.sessionId],
    queryFn: () => getOrder({ data: { sessionId: stored.sessionId } }),
    staleTime: 60_000,
  });

  // Persistimos el último estado conocido para que la purga (entregado +30 días)
  // funcione aunque el cliente no pase por la página de éxito.
  useEffect(() => {
    if (order) syncStoredOrderStatus(stored.sessionId, order.status);
  }, [order, stored.sessionId]);

  const badge = order ? statusLabel(order.status) : null;
  const date = new Date(stored.savedAt).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const currency = order?.currency ?? stored.currency;
  const totalCents = order?.totalCents ?? stored.totalCents;

  return (
    <li className="rounded-xl border border-border/60 bg-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Pedido del {date}</p>
          <p className="mt-1 font-display text-lg">
            {order
              ? order.items.map((i) => `${i.title} × ${i.quantity}`).join(", ")
              : stored.firstTitle}
          </p>
          {order?.deliveryMethod === "pickup" && (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Store className="h-3.5 w-3.5" strokeWidth={1.5} /> Recogida en tienda
            </p>
          )}
          {order?.trackingUrl && (
            <a
              href={order.trackingUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 border border-foreground px-3 py-1.5 text-xs uppercase tracking-[0.14em] hover:bg-foreground hover:text-background"
            >
              <Package className="h-3.5 w-3.5" strokeWidth={1.5} /> Seguir mi paquete
            </a>
          )}
          {order?.paymentStatus === "pending" && (
            <p className="mt-2 inline-block rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-800">
              Pago pendiente · {formatCents(order.totalCents, order.currency)} en efectivo al recoger
            </p>
          )}
        </div>
        <div className="text-right">
          {isLoading ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Consultando estado…
            </span>
          ) : badge ? (
            <span
              className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${toneClasses(
                badge.tone,
              )}`}
            >
              {badge.label}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-secondary px-3 py-1 text-xs text-muted-foreground">
              <Package className="h-3.5 w-3.5" /> Confirmando…
            </span>
          )}
          {totalCents > 0 && (
            <p className="mt-2 font-display text-xl tabular-nums">{formatCents(totalCents, currency)}</p>
          )}
        </div>
      </div>
    </li>
  );
}
