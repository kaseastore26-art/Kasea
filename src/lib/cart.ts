// ============================================================================
// Carrito PROPIO — 100% en el cliente, sin Shopify.
//
// Estado en Zustand persistido en localStorage: las líneas del carrito
// sobreviven a recargas. Todas las operaciones son locales y síncronas
// (no hay llamadas de red). El precio/stock NO se confía al cliente: se
// vuelve a validar en el servidor al iniciar el checkout (Fase 3).
//
// Nota: cada línea se identifica con `lineId`, una clave local estable
// derivada de (variante + atributos), para poder fusionar cantidades y
// para que los componentes (CartDrawer, etc.) sigan funcionando igual.
// ============================================================================
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ShopifyProduct } from "./shopify";
import { applyPercentDiscount, isCaseProduct, promoTotals } from "./pricing";

export interface CartAttribute {
  key: string;
  value: string;
}

export interface CartItem {
  lineId: string;
  product: ShopifyProduct;
  variantId: string;
  variantTitle: string;
  price: { amount: string; currencyCode: string };
  quantity: number;
  selectedOptions: Array<{ name: string; value: string }>;
  attributes?: CartAttribute[];
  // Solo para la funda personalizada: referencia al diseño guardado.
  customDesignId?: string;
}

// Clave local estable de una línea: misma variante + mismos atributos = misma línea.
function itemKey(variantId: string, attributes?: CartAttribute[]): string {
  const attrs = (attributes ?? [])
    .map((a) => `${a.key}=${a.value}`)
    .sort()
    .join("|");
  return `${variantId}::${attrs}`;
}

interface CartStore {
  items: CartItem[];
  isOpen: boolean;
  // Se mantiene por compatibilidad con los componentes; siempre false
  // porque las operaciones locales no tienen estado de carga.
  isLoading: boolean;
  setOpen: (open: boolean) => void;
  addItem: (item: Omit<CartItem, "lineId">) => void;
  updateQuantity: (lineId: string, quantity: number) => void;
  removeItem: (lineId: string) => void;
  clearCart: () => void;
  subtotal: () => number;
  totalItems: () => number;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,
      isLoading: false,
      setOpen: (open) => set({ isOpen: open }),

      addItem: (item) => {
        const lineId = itemKey(item.variantId, item.attributes);
        const items = get().items;
        const existing = items.find((i) => i.lineId === lineId);
        if (existing) {
          set({
            items: items.map((i) =>
              i.lineId === lineId ? { ...i, quantity: i.quantity + item.quantity } : i,
            ),
            isOpen: true,
          });
        } else {
          set({ items: [...items, { ...item, lineId }], isOpen: true });
        }
      },

      updateQuantity: (lineId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(lineId);
          return;
        }
        set({
          items: get().items.map((i) => (i.lineId === lineId ? { ...i, quantity } : i)),
        });
      },

      removeItem: (lineId) => {
        set({ items: get().items.filter((i) => i.lineId !== lineId) });
      },

      clearCart: () => set({ items: [] }),

      // Subtotal en unidades de la moneda (p. ej. euros), calculado en cliente.
      subtotal: () =>
        get().items.reduce((sum, i) => sum + parseFloat(i.price.amount) * i.quantity, 0),

      totalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
    }),
    {
      name: "kasea-cart",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ items: s.items }),
    },
  ),
);

// ---------------------------------------------------------------------------
// Totales del carrito con la promoción de fundas (2.ª funda y siguientes −25 %)
// y, si lo hay, el código de descuento. Mismas reglas que el servidor.
// ---------------------------------------------------------------------------
export function isCaseItem(item: CartItem): boolean {
  return isCaseProduct(item.product?.node?.tags, { custom: !!item.customDesignId });
}

export interface CartTotals {
  /** Suma a precio normal. */
  subtotalCents: number;
  /** Ahorro por el código de descuento. */
  codeDiscountCents: number;
  /** Ahorro por la promoción de la 2.ª funda. */
  promoCents: number;
  /** Total de productos (sin envío). */
  totalCents: number;
  /** Número de fundas en el carrito. */
  caseCount: number;
}

export function cartTotals(items: CartItem[], codePercent = 0): CartTotals {
  const toCents = (amount: string) => Math.round(parseFloat(amount) * 100);
  const subtotalCents = items.reduce((sum, i) => sum + toCents(i.price.amount) * i.quantity, 0);
  const lines = items.map((i) => ({
    unitCents: applyPercentDiscount(toCents(i.price.amount), codePercent),
    quantity: i.quantity,
    isCase: isCaseItem(i),
  }));
  const promo = promoTotals(lines);
  return {
    subtotalCents,
    codeDiscountCents: subtotalCents - promo.originalCents,
    promoCents: promo.promoCents,
    totalCents: promo.totalCents,
    caseCount: promo.caseCount,
  };
}
