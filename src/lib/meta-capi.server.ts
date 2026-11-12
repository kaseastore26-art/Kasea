// ============================================================================
// Meta Conversions API (solo servidor).
// Cuando Stripe confirma un pago, avisamos a Meta desde el servidor (no se puede
// bloquear como el píxel del navegador). Los datos personales van cifrados
// (SHA-256), como exige Meta. El mismo event_id que usa el píxel en la página
// de "gracias" evita que la compra se cuente dos veces.
//
// Variables de entorno:
//   META_CAPI_TOKEN  → código de acceso (Administrador de eventos → Settings)
//   META_PIXEL_ID    → opcional, por defecto el píxel de Kasea
// ============================================================================
const DEFAULT_PIXEL_ID = "2951615248506873";
const GRAPH_VERSION = "v21.0";

const enc = new TextEncoder();
async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const norm = (v: string | null | undefined) =>
  String(v ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

async function hashed(v: string | null | undefined): Promise<string | undefined> {
  const n = norm(v);
  return n ? await sha256(n) : undefined;
}

function normalizePhone(phone: string | null | undefined): string {
  let d = String(phone ?? "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 9 && /^[6789]/.test(d)) d = `34${d}`; // móvil/fijo español sin prefijo
  return d;
}

export interface MetaPurchaseData {
  eventId: string;
  eventTimeSec: number;
  email?: string | null;
  phone?: string | null;
  fullName?: string | null;
  city?: string | null;
  postalCode?: string | null;
  country?: string | null;
  clientIp?: string | null;
  userAgent?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  valueCents: number;
  currency: string;
  contents: Array<{ id: string; quantity: number; item_price?: number }>;
  sourceUrl?: string | null;
}

/** Envía la compra a Meta. Nunca lanza error: si falla, solo lo deja en el log. */
export async function sendMetaPurchase(d: MetaPurchaseData): Promise<void> {
  const token = process.env.META_CAPI_TOKEN;
  if (!token) return; // sin configurar: no hace nada
  const pixelId = process.env.META_PIXEL_ID || DEFAULT_PIXEL_ID;

  try {
    const parts = norm(d.fullName).split(/\s+/).filter(Boolean);
    const phone = normalizePhone(d.phone);
    const country = norm(d.country);
    const userData: Record<string, unknown> = {
      em: await hashed(d.email),
      ph: phone ? await sha256(phone) : undefined,
      fn: parts[0] ? await sha256(parts[0]) : undefined,
      ln: parts.length > 1 ? await sha256(parts.slice(1).join(" ")) : undefined,
      ct: (await hashed(d.city))?.toString(),
      zp: await hashed(String(d.postalCode ?? "").replace(/\s+/g, "")),
      country: await sha256(country === "espana" || country === "spain" || !country ? "es" : country.slice(0, 2)),
      client_ip_address: d.clientIp || undefined,
      client_user_agent: d.userAgent || undefined,
      fbp: d.fbp || undefined,
      fbc: d.fbc || undefined,
    };
    Object.keys(userData).forEach((k) => userData[k] === undefined && delete userData[k]);

    const body = {
      data: [
        {
          event_name: "Purchase",
          event_time: d.eventTimeSec,
          event_id: d.eventId,
          action_source: "website",
          event_source_url: d.sourceUrl || undefined,
          user_data: userData,
          custom_data: {
            currency: d.currency,
            value: Math.round(d.valueCents) / 100,
            content_type: "product",
            content_ids: d.contents.map((c) => c.id),
            contents: d.contents,
            num_items: d.contents.reduce((n, c) => n + c.quantity, 0),
          },
        },
      ],
    };

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${pixelId}/events?access_token=${encodeURIComponent(token)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      },
    );
    clearTimeout(timer);
    if (!res.ok) console.error("[meta-capi] Meta respondió", res.status, await res.text());
  } catch (err) {
    console.error("[meta-capi] no se pudo enviar la compra:", err);
  }
}
