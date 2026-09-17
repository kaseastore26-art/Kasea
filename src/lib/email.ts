// ============================================================================
// Correo de confirmación de pedido — Resend vía API REST (sin SDK).
// Solo servidor (usa process.env). Degrada con elegancia si falta la API key.
// ============================================================================

export interface OrderEmailItem {
  title: string;
  quantity: number;
  unit_price_cents: number;
  attributes?: Array<{ key: string; value: string }>;
}

export interface OrderEmailData {
  to: string;
  customerName?: string | null;
  items: OrderEmailItem[];
  currency: string;
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  address?: Record<string, unknown> | null;
  paymentPending?: boolean;
}

function euros(cents: number, currency = "EUR"): string {
  try {
    return new Intl.NumberFormat("es-ES", { style: "currency", currency }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

function buildHtml(data: OrderEmailData): string {
  const rows = data.items
    .map((it) => {
      const attrs = (it.attributes ?? [])
        .filter((a) => !a.value.startsWith("http"))
        .map((a) => `${escapeHtml(a.key)}: ${escapeHtml(a.value)}`)
        .join(" · ");
      return `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #eee;">
            ${escapeHtml(it.title)} × ${it.quantity}
            ${attrs ? `<br><span style="color:#888;font-size:12px">${attrs}</span>` : ""}
          </td>
          <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;white-space:nowrap;">
            ${euros(it.unit_price_cents * it.quantity, data.currency)}
          </td>
        </tr>`;
    })
    .join("");

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a;">
   <h1 style="font-size:22px;">¡Gracias por tu pedido${data.customerName ? `, ${escapeHtml(data.customerName)}` : ""}!</h1>
<p style="color:#555;">
  ${
    data.paymentPending
      ? "Hemos recibido correctamente tu pedido. El pago se realizará en tienda al recogerlo."
      : "Hemos recibido tu pago y estamos preparando tu pedido. Aquí tienes el resumen:"
  }
</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      ${rows}
      <tr><td style="padding:8px 0;color:#555;">Subtotal</td><td style="padding:8px 0;text-align:right;">${euros(data.subtotalCents, data.currency)}</td></tr>
      <tr><td style="padding:4px 0;color:#555;">Envío</td><td style="padding:4px 0;text-align:right;">${data.shippingCents === 0 ? "Gratis" : euros(data.shippingCents, data.currency)}</td></tr>
      <tr><td style="padding:8px 0;font-weight:bold;">Total</td><td style="padding:8px 0;text-align:right;font-weight:bold;">${euros(data.totalCents, data.currency)}</td></tr>
    </table>
    <p style="color:#888;font-size:12px;margin-top:24px;">Kasea Store · Fundas premium para iPhone</p>
  </div>`;
}

// Envío genérico por Resend. No lanza: si falla, solo lo registra.
async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || "Kasea Store <onboarding@resend.dev>";
  if (!key) {
    console.warn("[email] RESEND_API_KEY no configurada; se omite el correo.");
    return;
  }
  if (!to) return;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, html }),
    });
    if (!res.ok) {
      console.error("[email] Resend respondió con error:", res.status, await res.text());
    }
  } catch (err) {
    console.error("[email] Error enviando el correo:", err);
  }
}

/** Correo de confirmación al CLIENTE. */
export async function sendOrderConfirmationEmail(data: OrderEmailData): Promise<void> {
  await sendEmail(data.to, "Confirmación de tu pedido — Kasea Store", buildHtml(data));
}

// ---- Aviso al ADMINISTRADOR de nueva orden (con diseño si es personalizada) ----
export interface AdminOrderDesign {
  model?: string | null;
  text?: string | null;
  font?: string | null;
  color?: string | null;
  previewUrl?: string | null;
}
export interface AdminOrderItem extends OrderEmailItem {
  design?: AdminOrderDesign | null;
}
export interface AdminOrderEmailData {
  to: string;
  customerName?: string | null;
  customerEmail?: string | null;
  phone?: string | null;
  deliveryMethod: "delivery" | "pickup";
  address?: Record<string, unknown> | null;
  paymentNote?: string | null;
  items: AdminOrderItem[];
  currency: string;
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
}

function addressLine(address?: Record<string, unknown> | null): string {
  if (!address) return "";
  const a = (address.address ?? address) as Record<string, unknown>;
  return [a.line1, a.line2, a.postal_code, a.city, a.country].filter(Boolean).map(String).join(", ");
}

function buildAdminHtml(data: AdminOrderEmailData): string {
  const rows = data.items
    .map((it) => {
const design = it.design
  ? `<div style="margin-top:6px;padding:12px;border:1px solid #eee;border-radius:6px;background:#faf8f5;font-size:12px;">
       <strong>Diseño personalizado</strong><br>
       ${
         it.design.previewUrl
           ? `<div style="margin:10px 0;text-align:center;">
                <img
                  src="${escapeHtml(it.design.previewUrl)}"
                  alt="Diseño personalizado"
                  style="display:block;max-width:220px;width:100%;height:auto;margin:0 auto;border:1px solid #ddd;border-radius:4px;"
                >
              </div>`
           : ""
       }
       Modelo: ${escapeHtml(it.design.model || "—")}<br>
       Texto: ${escapeHtml(it.design.text || "—")}<br>
       Fuente: ${escapeHtml(it.design.font || "—")} · Color: ${escapeHtml(it.design.color || "—")}<br>
       ${
         it.design.previewUrl
           ? `<div style="margin-top:8px;">
                <a href="${escapeHtml(it.design.previewUrl)}">Ver/descargar diseño</a>
              </div>`
           : ""
       }
     </div>`
  : "";
      return `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #eee;">
            ${escapeHtml(it.title)} × ${it.quantity}${design}
          </td>
          <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;white-space:nowrap;vertical-align:top;">
            ${euros(it.unit_price_cents * it.quantity, data.currency)}
          </td>
        </tr>`;
    })
    .join("");

  const entrega =
    data.deliveryMethod === "pickup"
      ? "Recoger en tienda"
      : `Envío a domicilio${addressLine(data.address) ? `<br>${escapeHtml(addressLine(data.address))}` : ""}`;

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a;">
    <h1 style="font-size:20px;">Nueva orden recibida</h1>
    <p style="color:#555;margin:0 0 12px;">
      <strong>Cliente:</strong> ${escapeHtml(data.customerName || "—")}
      ${data.customerEmail ? ` · ${escapeHtml(data.customerEmail)}` : ""}
      ${data.phone ? ` · ${escapeHtml(data.phone)}` : ""}<br>
      <strong>Entrega:</strong> ${entrega}
      ${data.paymentNote ? `<br><strong style="color:#b45309;">${escapeHtml(data.paymentNote)}</strong>` : ""}
    </p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      ${rows}
      <tr><td style="padding:8px 0;color:#555;">Subtotal</td><td style="padding:8px 0;text-align:right;">${euros(data.subtotalCents, data.currency)}</td></tr>
      <tr><td style="padding:4px 0;color:#555;">Envío</td><td style="padding:4px 0;text-align:right;">${data.shippingCents === 0 ? "Gratis" : euros(data.shippingCents, data.currency)}</td></tr>
      <tr><td style="padding:8px 0;font-weight:bold;">Total</td><td style="padding:8px 0;text-align:right;font-weight:bold;">${euros(data.totalCents, data.currency)}</td></tr>
    </table>
    <p style="color:#888;font-size:12px;margin-top:20px;">Gestiona el pedido en tu panel de administración.</p>
  </div>`;
}

/** Aviso al ADMINISTRADOR de una nueva orden. */
export async function sendAdminOrderNotification(data: AdminOrderEmailData): Promise<void> {
  const custom = data.items.some((i) => i.design);
  const subject = custom ? "Nueva orden (con diseño personalizado) — Kasea" : "Nueva orden — Kasea Store";
  await sendEmail(data.to, subject, buildAdminHtml(data));
}

// ---- Aviso al CLIENTE de un cambio de estado (enviado / entregado) ----
export interface OrderStatusEmailData {
  to: string;
  customerName?: string | null;
  status: "fulfilled" | "delivered";
  items: OrderEmailItem[];
  currency: string;
  totalCents: number;
}

function buildStatusHtml(data: OrderStatusEmailData): string {
  const shipped = data.status === "fulfilled";
  const heading = shipped ? "¡Tu pedido va en camino!" : "¡Tu pedido ha sido entregado!";
  const message = shipped
    ? "Hemos preparado y enviado tu pedido. Pronto lo tendrás contigo."
    : "Nos consta que tu pedido ya ha sido entregado. Esperamos que disfrutes tu funda Kasea.";
  const rows = data.items
    .map((it) => {
      const attrs = (it.attributes ?? [])
        .filter((a) => !a.value.startsWith("http"))
        .map((a) => `${escapeHtml(a.key)}: ${escapeHtml(a.value)}`)
        .join(" · ");
      return `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #eee;">
            ${escapeHtml(it.title)} × ${it.quantity}
            ${attrs ? `<br><span style="color:#888;font-size:12px">${attrs}</span>` : ""}
          </td>
          <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;white-space:nowrap;">
            ${euros(it.unit_price_cents * it.quantity, data.currency)}
          </td>
        </tr>`;
    })
    .join("");

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a;">
    <h1 style="font-size:22px;">${heading}</h1>
    <p style="color:#555;">${data.customerName ? `${escapeHtml(data.customerName)}, ` : ""}${message}</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      ${rows}
      <tr><td style="padding:8px 0;font-weight:bold;">Total</td><td style="padding:8px 0;text-align:right;font-weight:bold;">${euros(data.totalCents, data.currency)}</td></tr>
    </table>
    <p style="color:#888;font-size:12px;margin-top:24px;">Kasea Store · Fundas premium para iPhone</p>
  </div>`;
}

/** Correo al CLIENTE cuando su pedido pasa a "enviado" o "entregado". */
export async function sendOrderStatusEmail(data: OrderStatusEmailData): Promise<void> {
  const subject =
    data.status === "fulfilled"
      ? "Tu pedido va en camino — Kasea Store"
      : "Tu pedido ha sido entregado — Kasea Store";
  await sendEmail(data.to, subject, buildStatusHtml(data));
}
