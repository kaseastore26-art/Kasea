import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ShoppingBag, Minus, Plus, Trash2 } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { cartTotals, useCartStore } from "@/lib/cart";
import { MULTI_CASE_DISCOUNT_PERCENT, MULTI_CASE_PROMO_ON } from "@/lib/pricing";
import { formatPrice } from "@/lib/shopify";

export function CartDrawer() {
  const { items, isOpen, setOpen, updateQuantity, removeItem } = useCartStore();
  const navigate = useNavigate();

  const totalItems = items.reduce((s, i) => s + i.quantity, 0);
  const currency = items[0]?.price.currencyCode ?? "EUR";
  // Subtotal calculado con las líneas locales: sube/baja al instante.
  const totals = cartTotals(items);
  const subtotal = totals.subtotalCents / 100;
  const total = totals.totalCents / 100;

  const handleCheckout = () => {
    setOpen(false);
    navigate({ to: "/checkout" });
  };

  return (
    <Sheet open={isOpen} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative rounded-full hover:bg-secondary" aria-label="Abrir carrito">
          <ShoppingBag className="h-5 w-5" strokeWidth={1.5} />
          {totalItems > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 min-w-5 rounded-full px-1 flex items-center justify-center text-[10px] bg-espresso text-ivory">
              {totalItems}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-lg flex flex-col h-full bg-ivory p-0">
        <SheetHeader className="flex-shrink-0 px-6 pt-6 pb-4 border-b">
          <SheetTitle className="font-display text-2xl">Tu bolsa</SheetTitle>
          <p className="text-sm text-muted-foreground">
            {totalItems === 0 ? "Tu bolsa está vacía" : `${totalItems} artículo${totalItems !== 1 ? "s" : ""}`}
          </p>
        </SheetHeader>
        <div className="flex flex-col flex-1 min-h-0">
          {items.length === 0 ? (
            <div className="flex-1 flex items-center justify-center px-6">
              <div className="text-center">
                <ShoppingBag className="h-10 w-10 text-muted-foreground mx-auto mb-4" strokeWidth={1} />
                <p className="text-muted-foreground">Descubre nuestra colección</p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto px-6 py-4">
                <div className="space-y-6">
                  {items.map((item) => {
                    const img = item.product.node.images?.edges?.[0]?.node;
                    return (
                      <div key={item.lineId ?? item.variantId} className="flex gap-4">
                        <div className="w-20 h-24 bg-sand/40 rounded-sm overflow-hidden flex-shrink-0">
                          {img && <img src={img.url} alt={img.altText ?? item.product.node.title} className="w-full h-full object-cover" />}
                        </div>
                        <div className="flex-1 min-w-0 flex flex-col justify-between">
                          <div>
                            <h4 className="font-display text-lg leading-tight truncate">{item.product.node.title}</h4>
                            {item.selectedOptions.length > 0 && item.selectedOptions[0]?.value !== "Default Title" && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {item.selectedOptions.map((o) => o.value).join(" · ")}
                              </p>
                            )}
                            {item.attributes && item.attributes.length > 0 && (
                              <div className="mt-1 space-y-1">
                                <p className="text-espresso text-xs font-medium">
                                  {item.attributes
                                    .filter((a) => !a.value.startsWith("http"))
                                    .map((a) => `${a.key}: ${a.value}`)
                                    .join(" · ")}
                                </p>
                                {item.attributes
                                  .filter((a) => a.value.startsWith("http"))
                                  .map((a) => (
                                    <a
                                      key={a.key}
                                      href={a.value}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-muted-foreground block text-xs underline"
                                    >
                                      Ver {a.key.toLowerCase()}
                                    </a>
                                  ))}
                              </div>
                            )}

                            <p className="text-sm mt-1">{formatPrice(item.price.amount, item.price.currencyCode)}</p>
                          </div>
                          <div className="flex items-center justify-between mt-2">
                            <div className="flex items-center border border-border rounded-sm">
                              <button onClick={() => updateQuantity(item.lineId, item.quantity - 1)} className="p-1.5 hover:bg-secondary transition-colors" aria-label="Disminuir">
                                <Minus className="h-3 w-3" />
                              </button>
                              <span className="w-8 text-center text-sm">{item.quantity}</span>
                              <button onClick={() => updateQuantity(item.lineId, item.quantity + 1)} className="p-1.5 hover:bg-secondary transition-colors" aria-label="Aumentar">
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>
                            <button onClick={() => removeItem(item.lineId)} className="text-xs text-muted-foreground hover:text-espresso underline underline-offset-2" aria-label="Eliminar">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                </div>
              </div>
              <div className="flex-shrink-0 space-y-3 px-6 py-5 border-t bg-ivory">
                {MULTI_CASE_PROMO_ON && totals.caseCount === 1 && (
                  <p className="rounded-md border border-gold/50 bg-secondary/40 px-3 py-2 text-xs text-espresso">
                    ✦ Añade otra funda y llévatela con un <strong>{MULTI_CASE_DISCOUNT_PERCENT} % de descuento</strong>.
                  </p>
                )}
                <div className="flex justify-between items-baseline text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="tabular-nums">{formatPrice(subtotal, currency)}</span>
                </div>
                {totals.promoCents > 0 && (
                  <div className="flex justify-between items-baseline text-sm text-espresso">
                    <span>2.ª funda y siguientes (−{MULTI_CASE_DISCOUNT_PERCENT} %)</span>
                    <span className="tabular-nums">−{formatPrice(totals.promoCents / 100, currency)}</span>
                  </div>
                )}
                <div className="flex justify-between items-baseline pt-2 border-t">
                  <span className="text-sm eyebrow">Total</span>
                  <span className="text-xl font-display tabular-nums">{formatPrice(total, currency)}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {totals.caseCount > 0
                    ? "Envío gratis: tu pedido lleva una funda."
                    : "Añade una funda y el envío es gratis."}
                </p>
                <Button onClick={handleCheckout} className="w-full h-12 rounded-none bg-espresso text-ivory hover:bg-espresso/90 tracking-wide">
                  Finalizar compra
                </Button>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
