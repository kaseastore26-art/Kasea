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

// ---------------------------------------------------------------------------
// Promoción de fundas
//   - Si el pedido lleva al menos UNA funda, el envío es gratis.
//   - A partir de la SEGUNDA funda, cada funda tiene un 25 % de descuento
//     (la funda más cara se cobra entera; el resto, con el descuento).
//   - Los demás productos (accesorios) pagan envío si no van con una funda.
// ---------------------------------------------------------------------------

/**
 * Descuento (%) de la segunda funda y siguientes.
 * 0 = promoción APAGADA. Para Black Friday / Navidad, pon 25 y vuelve a subir la web.
 */
export const MULTI_CASE_DISCOUNT_PERCENT: number = 0;

/** ¿Está activa la promoción de la 2.ª funda? */
export const MULTI_CASE_PROMO_ON = MULTI_CASE_DISCOUNT_PERCENT > 0;

/** Etiquetas de accesorios: un producto con alguna de ellas NO es una funda. */
export const ACCESSORY_TAGS = ["accesorios", "colgantes", "protectores", "cargadores", "otros"];

/** ¿Es una funda? (todo lo que no es accesorio; la personalizada siempre lo es). */
export function isCaseProduct(tags?: string[] | null, opts?: { custom?: boolean }): boolean {
  if (opts?.custom) return true;
  const t = (tags ?? []).map((x) => String(x).trim().toLowerCase());
  return !t.some((x) => ACCESSORY_TAGS.includes(x));
}

export interface PromoLine {
  unitCents: number;
  quantity: number;
  isCase: boolean;
}

/**
 * Reparte cada línea en unidades a precio completo y unidades con el 25 %.
 * Solo UNA funda (la más cara) va a precio completo; el resto de fundas, con
 * descuento. Los accesorios siempre a precio completo.
 */
export function splitMultiCaseDiscount(lines: PromoLine[]): Array<{ fullQty: number; discountedQty: number }> {
  let fullIndex = -1;
  lines.forEach((l, i) => {
    if (!l.isCase || l.quantity <= 0) return;
    if (fullIndex === -1 || l.unitCents > lines[fullIndex].unitCents) fullIndex = i;
  });
  return lines.map((l, i) => {
    if (!l.isCase) return { fullQty: l.quantity, discountedQty: 0 };
    const fullQty = i === fullIndex ? 1 : 0;
    return { fullQty, discountedQty: Math.max(0, l.quantity - fullQty) };
  });
}

/** Total en céntimos de una lista de líneas, con la promoción de fundas aplicada. */
export function promoTotals(lines: PromoLine[]): { originalCents: number; totalCents: number; promoCents: number; caseCount: number } {
  const split = splitMultiCaseDiscount(lines);
  let originalCents = 0;
  let totalCents = 0;
  let caseCount = 0;
  lines.forEach((l, i) => {
    originalCents += l.unitCents * l.quantity;
    totalCents +=
      l.unitCents * split[i].fullQty +
      applyPercentDiscount(l.unitCents, MULTI_CASE_DISCOUNT_PERCENT) * split[i].discountedQty;
    if (l.isCase) caseCount += l.quantity;
  });
  return { originalCents, totalCents, promoCents: originalCents - totalCents, caseCount };
}

/** Envío a Islas Baleares (códigos postales 07xxx). */
export const BALEARES_SHIPPING_CENTS = 1799;

/** Si el envío gratis (pedido con funda) también se aplica a Baleares. */
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

/** ¿El pedido tiene envío gratis? (lleva al menos una funda, o supera el importe del admin). */
export function qualifiesForFreeShipping(
  caseCount: number,
  subtotalCents: number,
  settings: ShippingSettings,
): boolean {
  if (caseCount >= 1) return true;
  return settings.freeThresholdCents > 0 && subtotalCents >= settings.freeThresholdCents;
}

/** Coste del envío en céntimos. */
export function computeShippingCents(
  method: DeliveryMethod,
  opts: { postalCode?: string | null; subtotalCents: number; caseCount: number },
  settings: ShippingSettings,
): number {
  if (method === "pickup") return 0;

  const free = qualifiesForFreeShipping(opts.caseCount, opts.subtotalCents, settings);

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
