// Seguimiento de envíos (Correos Express, a través de Loginser).
// El número es la "Expedición agencia" de la plataforma de Loginser.

export function cleanTracking(n: string | null | undefined): string {
  return String(n ?? "").replace(/\s+/g, "").trim();
}

/** Enlace a la página de seguimiento de Correos Express. */
export function trackingUrl(number: string | null | undefined, postalCode?: string | null): string | null {
  const n = cleanTracking(number);
  if (!n) return null;
  const cp = String(postalCode ?? "").replace(/\D/g, "").slice(0, 5);
  return `https://s.correosexpress.com/search?s=${encodeURIComponent(n)}${cp ? `&cp=${cp}` : ""}`;
}

/** Código postal guardado en el pedido (admite los dos formatos de dirección). */
export function orderPostalCode(shippingAddress: any): string | null {
  const a = shippingAddress?.address ?? shippingAddress ?? null;
  return a?.postal_code ?? null;
}
