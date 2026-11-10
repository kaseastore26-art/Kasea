// ============================================================================
// Recordatorio de pedido a medias — utilidades SOLO de servidor.
// La firma evita que alguien dé de baja correos ajenos desde el enlace.
// ============================================================================
const enc = new TextEncoder();

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Firma corta (HMAC-SHA256) de un correo, para el enlace "No quiero más avisos". */
export async function signEmail(email: string): Promise<string> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET || process.env.STRIPE_SECRET_KEY || "";
  const key = await crypto.subtle.importKey("raw", enc.encode(`kasea-reminder:${secret}`), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(normalizeEmail(email)));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

export function siteUrl(): string {
  return (process.env.SITE_URL || "https://kasea.es").replace(/\/$/, "");
}
