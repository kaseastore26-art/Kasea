// ============================================================================
// Reglas de precio compartidas por la web (navegador) y el servidor.
//
// El navegador las usa solo para MOSTRAR el precio; el importe que se cobra lo
// vuelve a calcular el servidor (checkout.functions.ts) con estas mismas reglas.
// ============================================================================

/** Recogida en punto NACEX. Desactivada: pon `true` para volver a mostrarla. */
export const NACEX_POINT_ENABLED: boolean = false;

/** Nombre del envío a domicilio que ve el cliente (web, Stripe y correos). */
export const HOME_DELIVERY_LABEL = "Envío a domicilio · 24/48 h";

/** A partir de cuántos productos en el pedido el envío es gratis. */
export const FREE_SHIPPING_MIN_ITEMS = 2;

/** Envío a Islas Baleares (códigos postales 07xxx). */
export const BALEARES_SHIPPING_CENTS = 1799;

/** Si el envío gratis por 2 productos también se aplica a Baleares. */
export const FREE_SHIPPING_IN_BALEARES: boolean = false;

export type DeliveryMethod = "delivery" | "pickup" | "nacex_point";

export interface ShippingSettings {
  flatCents: number;
  nacexCents: number;
  freeThresholdCents: number;
}

export const DEFAULT_SHIPPING_SETTINGS: ShippingSettings = {
  flatCents: 799,
  nacexCents: 499,
  freeThresholdCents: 5500,
};

export function isBalearesPostalCode(postalCode?: string | null): boolean {
  return /^07\d{3}$/.test((postalCode ?? "").replace(/\s/g, ""));
}

/** ¿El pedido tiene envío gratis? (2 productos o más, o superar el importe del admin). */
export function qualifiesForFreeShipping(
  itemCount: number,
  subtotalCents: number,
  settings: ShippingSettings,
): boolean {
  if (itemCount >= FREE_SHIPPING_MIN_ITEMS) return true;
  return settings.freeThresholdCents > 0 && subtotalCents >= settings.freeThresholdCents;
}

/** Coste del envío en céntimos. */
export function computeShippingCents(
  method: DeliveryMethod,
  opts: { postalCode?: string | null; subtotalCents: number; itemCount: number },
  settings: ShippingSettings,
): number {
  if (method === "pickup") return 0;

  const free = qualifiesForFreeShipping(opts.itemCount, opts.subtotalCents, settings);

  if (method === "nacex_point") return free ? 0 : settings.nacexCents;

  if (isBalearesPostalCode(opts.postalCode)) {
    return free && FREE_SHIPPING_IN_BALEARES ? 0 : BALEARES_SHIPPING_CENTS;
  }

  return free ? 0 : settings.flatCents;
}

/** Aplica un % de descuento a un precio en céntimos. */
export function applyPercentDiscount(cents: number, percent: number): number {
  if (!percent || percent <= 0) return cents;
  return Math.max(0, Math.round((cents * (100 - percent)) / 100));
}

export function formatEuros(cents: number): string {
  try {
    return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} €`;
  }
}

/** Texto que se muestra en correos cuando se ha usado un código. */
export function discountNoteText(code: string, percent: number, savedCents: number): string {
  return `Código ${code} aplicado (−${percent} %) · Ahorras ${formatEuros(savedCents)}`;
}
