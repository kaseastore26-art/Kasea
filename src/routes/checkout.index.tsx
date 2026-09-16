import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ShoppingBag, ArrowLeft, Truck, Lock, Loader2, Store, CreditCard, Banknote } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCartStore } from "@/lib/cart";
import { formatPrice } from "@/lib/shopify";
import { createCheckoutSession, createCashPickupOrder } from "@/lib/checkout.functions";
import { getShopSettingsPublic } from "@/lib/catalog.functions";

type DeliveryMethod = "delivery" | "pickup" | "nacex_point";

export const Route = createFileRoute("/checkout/")({
  head: () => ({
    meta: [
      { title: "Finalizar compra — Kasea Store" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const items = useCartStore((s) => s.items);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const startCheckout = useServerFn(createCheckoutSession);
  const startCash = useServerFn(createCashPickupOrder);
  const getSettings = useServerFn(getShopSettingsPublic);
  const [loading, setLoading] = useState(false);
  const [delivery, setDelivery] = useState<DeliveryMethod>("delivery");
  // Solo aplica a recogida en tienda: pagar ahora con tarjeta o en efectivo allí.
  const [payMethod, setPayMethod] = useState<"card" | "cash">("card");
  const [cashName, setCashName] = useState("");
  const [cashPhone, setCashPhone] = useState("");
  const [cashEmail, setCashEmail] = useState("");

  const { data: settings } = useQuery({
    queryKey: ["shop-settings"],
    queryFn: () => getSettings(),
    staleTime: 5 * 60_000,
  });
  const flatEur = (settings?.shippingFlatCents ?? 499) / 100;
  const nacexEur = (settings?.shippingNacexCents ?? 499) / 100;
  const thresholdEur = (settings?.freeThresholdCents ?? 5500) / 100;
  
  const onPay = async () => {
    setLoading(true);
    try {
      const res = await startCheckout({
        data: {
          items: items.map((i) => ({
            variantId: i.variantId,
            quantity: i.quantity,
            attributes: i.attributes,
            customDesignId: i.customDesignId,
          })),
          deliveryMethod: delivery,
          origin: window.location.origin,
        },
      });
      if ("url" in res) {
        window.location.href = res.url; // redirige a la pasarela de Stripe
        return;
      }
      toast.error("No se pudo iniciar el pago", { description: res.error });
    } catch (e) {
      toast.error("No se pudo iniciar el pago", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  };

  // Recogida en tienda + pago en efectivo: registra el pedido sin pasar por Stripe.
  const onCashOrder = async () => {
    if (!cashName.trim() || !cashPhone.trim()) {
      toast.error("Falta tu nombre y teléfono", {
        description: "Los necesitamos para preparar tu pedido de recogida.",
      });
      return;
    }
    setLoading(true);
    try {
      const res = await startCash({
        data: {
          items: items.map((i) => ({
            variantId: i.variantId,
            quantity: i.quantity,
            attributes: i.attributes,
            customDesignId: i.customDesignId,
          })),
          customerName: cashName.trim(),
          phone: cashPhone.trim(),
          email: cashEmail.trim() || undefined,
        },
      });
      if ("ref" in res) {
        window.location.href = `/checkout/exito?session_id=${encodeURIComponent(res.ref)}`;
        return;
      }
      toast.error("No se pudo registrar el pedido", { description: res.error });
    } catch (e) {
      toast.error("No se pudo registrar el pedido", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  };

  const isCash = delivery === "pickup" && payMethod === "cash";

  const currency = items[0]?.price.currencyCode ?? "EUR";
  const subtotal = items.reduce((sum, i) => sum + parseFloat(i.price.amount) * i.quantity, 0);
  const shipping =
  delivery === "pickup"
    ? 0
    : subtotal >= thresholdEur
      ? 0
      : delivery === "nacex_point"
        ? nacexEur
        : flatEur;
  const total = subtotal + shipping;
  const missingForFree = delivery === "delivery" ? Math.max(0, thresholdEur - subtotal) : 0;

  if (items.length === 0) {
    return (
      <div className="container-luxe py-24 text-center">
        <ShoppingBag className="mx-auto h-12 w-12 text-muted-foreground" strokeWidth={1} />
        <h1 className="mt-6 font-display text-4xl">Tu bolsa está vacía</h1>
        <p className="mx-auto mt-3 max-w-md text-muted-foreground">
          Añade productos a la bolsa para poder finalizar tu compra.
        </p>
        <Link
          to="/tienda"
          className="mt-8 inline-flex h-12 items-center gap-2 rounded-md bg-espresso px-7 text-sm font-medium uppercase tracking-[0.14em] text-ivory transition-transform hover:-translate-y-0.5"
        >
          Ir a la tienda
        </Link>
      </div>
    );
  }

  return (
    <div className="container-luxe py-12 md:py-16">
      <Link
        to="/tienda"
        className="mb-8 inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground hover:text-espresso"
      >
        <ArrowLeft className="h-4 w-4" /> Seguir comprando
      </Link>

      <h1 className="font-display text-4xl md:text-5xl">Finalizar compra</h1>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:gap-16">
        {/* Líneas del pedido */}
        <section>
          <h2 className="eyebrow mb-5">Tu pedido</h2>
          <ul className="divide-y divide-border/60 border-y border-border/60">
            {items.map((item) => {
              const img = item.product.node.images?.edges?.[0]?.node;
              return (
                <li key={item.lineId} className="flex gap-4 py-5">
                  <div className="h-24 w-20 flex-shrink-0 overflow-hidden rounded-sm bg-sand/40">
                    {img && (
                      <img
                        src={img.url}
                        alt={img.altText ?? item.product.node.title}
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <div className="flex flex-1 flex-col justify-between">
                    <div>
                      <h3 className="font-display text-lg leading-tight">{item.product.node.title}</h3>
                      {item.attributes && item.attributes.length > 0 && (
                        <p className="mt-1 text-xs text-espresso">
                          {item.attributes
                            .filter((a) => !a.value.startsWith("http"))
                            .map((a) => `${a.key}: ${a.value}`)
                            .join(" · ")}
                        </p>
                      )}
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formatPrice(item.price.amount, item.price.currencyCode)}
                      </p>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center rounded-sm border border-border">
                        <button
                          onClick={() => updateQuantity(item.lineId, item.quantity - 1)}
                          className="px-3 py-1.5 hover:bg-secondary"
                          aria-label="Disminuir"
                        >
                          −
                        </button>
                        <span className="w-9 text-center text-sm">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.lineId, item.quantity + 1)}
                          className="px-3 py-1.5 hover:bg-secondary"
                          aria-label="Aumentar"
                        >
                          +
                        </button>
                      </div>
                      <button
                        onClick={() => removeItem(item.lineId)}
                        className="text-xs text-muted-foreground underline underline-offset-2 hover:text-espresso"
                      >
                        Quitar
                      </button>
                    </div>
                  </div>
                  <div className="hidden w-24 text-right sm:block">
                    <span className="tabular-nums">
                      {formatPrice(parseFloat(item.price.amount) * item.quantity, currency)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Entrega + Resumen */}
        <aside className="space-y-5 lg:sticky lg:top-28 lg:self-start">
          {/* Método de entrega */}
          <div className="rounded-xl border border-border/60 bg-card p-6">
            <h2 className="eyebrow mb-4">Entrega</h2>
            <div className="space-y-3">
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
                  delivery === "delivery" ? "border-espresso bg-secondary/40" : "border-border hover:bg-secondary/20"
                }`}
              >
                <input
                  type="radio"
                  name="delivery"
                  className="mt-1 accent-espresso"
                  checked={delivery === "delivery"}
                  onChange={() => setDelivery("delivery")}
                />
                <span className="flex-1">
                  <span className="flex items-center gap-2 font-medium">
                    <Truck className="h-4 w-4" strokeWidth={1.5} /> Envío a domicilio
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {formatPrice(flatEur, currency)} · Gratis desde {formatPrice(thresholdEur, currency)}
                  </span>
                </span>
              </label>
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
                  delivery === "nacex_point" ? "border-espresso bg-secondary/40" : "border-border hover:bg-secondary/20"
                }`}
              >
                <input
                  type="radio"
                  name="delivery"
                  className="mt-1 accent-espresso"
                  checked={delivery === "nacex_point"}
                  onChange={() => setDelivery("nacex_point")}
                />
                <span className="flex-1">
                  <span className="flex items-center gap-2 font-medium">
                    <Truck className="h-4 w-4" strokeWidth={1.5} /> Recogida en punto NACEX
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {formatPrice(nacexEur, currency)} · Gratis desde {formatPrice(thresholdEur, currency)}
                  </span>
                </span>
              </label>
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
                  delivery === "pickup" ? "border-espresso bg-secondary/40" : "border-border hover:bg-secondary/20"
                }`}
              >
                <input
                  type="radio"
                  name="delivery"
                  className="mt-1 accent-espresso"
                  checked={delivery === "pickup"}
                  onChange={() => setDelivery("pickup")}
                />
                <span className="flex-1">
                  <span className="flex items-center gap-2 font-medium">
                    <Store className="h-4 w-4" strokeWidth={1.5} /> Recoger en tienda
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    Gratis · Sin gastos de envío
                  </span>
                </span>
              </label>
            </div>

            {/* Recogida en tienda: elegir pagar ahora con tarjeta o en efectivo allí. */}
            {delivery === "pickup" && (
              <div className="mt-5 border-t border-border/60 pt-5">
                <p className="mb-3 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  ¿Cómo quieres pagar?
                </p>
                <div className="space-y-3">
                  <label
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
                      payMethod === "card" ? "border-espresso bg-secondary/40" : "border-border hover:bg-secondary/20"
                    }`}
                  >
                    <input
                      type="radio"
                      name="pay"
                      className="mt-1 accent-espresso"
                      checked={payMethod === "card"}
                      onChange={() => setPayMethod("card")}
                    />
                    <span className="flex-1">
                      <span className="flex items-center gap-2 font-medium">
                        <CreditCard className="h-4 w-4" strokeWidth={1.5} /> Pagar ahora con tarjeta
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">Pago seguro con Stripe.</span>
                    </span>
                  </label>

                  <label
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
                      payMethod === "cash" ? "border-espresso bg-secondary/40" : "border-border hover:bg-secondary/20"
                    }`}
                  >
                    <input
                      type="radio"
                      name="pay"
                      className="mt-1 accent-espresso"
                      checked={payMethod === "cash"}
                      onChange={() => setPayMethod("cash")}
                    />
                    <span className="flex-1">
                      <span className="flex items-center gap-2 font-medium">
                        <Banknote className="h-4 w-4" strokeWidth={1.5} /> Pagar en efectivo al recoger
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        Reservamos tu pedido y pagas en tienda.
                      </span>
                    </span>
                  </label>
                </div>

                {payMethod === "cash" && (
                  <div className="mt-4 space-y-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium">Nombre y apellidos</label>
                      <Input value={cashName} onChange={(e) => setCashName(e.target.value)} placeholder="Tu nombre" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium">Teléfono</label>
                      <Input
                        value={cashPhone}
                        onChange={(e) => setCashPhone(e.target.value)}
                        placeholder="Para avisarte cuando esté listo"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium">Email (opcional)</label>
                      <Input
                        type="email"
                        value={cashEmail}
                        onChange={(e) => setCashEmail(e.target.value)}
                        placeholder="tu@email.com"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border/60 bg-card p-6">
            <h2 className="eyebrow mb-5">Resumen</h2>

            <div className="space-y-3 text-sm">
              <div className="flex items-baseline justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="tabular-nums">{formatPrice(subtotal, currency)}</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-muted-foreground">
                  {delivery === "pickup" ? "Recogida en tienda" : "Envío"}
                </span>
                <span className="tabular-nums">
                  {shipping === 0 ? "Gratis" : formatPrice(shipping, currency)}
                </span>
              </div>

              {missingForFree > 0 && (
                <p className="flex items-start gap-2 rounded-md bg-secondary/60 p-3 text-xs text-muted-foreground">
                  <Truck className="mt-0.5 h-4 w-4 flex-shrink-0" strokeWidth={1.5} />
                  <span>
                    Te faltan{" "}
                    <span className="font-medium text-espresso">
                      {formatPrice(missingForFree, currency)}
                    </span>{" "}
                    para el envío gratis (desde {formatPrice(thresholdEur, currency)}).
                  </span>
                </p>
              )}

              <div className="flex items-baseline justify-between border-t border-border/60 pt-3">
                <span className="eyebrow">Total</span>
                <span className="font-display text-2xl tabular-nums">
                  {formatPrice(total, currency)}
                </span>
              </div>
              <p className="text-right text-xs text-muted-foreground">IVA incluido</p>
            </div>

            <Button
              onClick={isCash ? onCashOrder : onPay}
              disabled={loading}
              className="mt-6 h-13 w-full rounded-none bg-espresso py-6 text-ivory tracking-[0.14em] hover:bg-espresso/90"
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : isCash ? (
                <Banknote className="mr-2 h-4 w-4" strokeWidth={1.5} />
              ) : (
                <Lock className="mr-2 h-4 w-4" strokeWidth={1.5} />
              )}
              {isCash ? "Confirmar pedido (pagas en tienda)" : "Pagar con tarjeta"}
            </Button>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
              <Lock className="h-3 w-3" strokeWidth={1.5} />
              {isCash
                ? "Reservamos tu pedido; pagas en efectivo al recogerlo en tienda."
                : "Pago seguro con tarjeta (Visa/MasterCard) gestionado por Stripe."}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
