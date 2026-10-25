/* eslint-disable @typescript-eslint/no-explicit-any */
// ============================================================================
// Códigos de descuento — lógica SOLO de servidor.
// Se importa siempre de forma dinámica dentro de handlers de servidor:
//   const { findValidDiscount } = await import("@/lib/discount.server");
// ============================================================================

export type ValidDiscount = { code: string; percent: number };

export function normalizeDiscountCode(raw: string): string {
  return (raw ?? "").trim().toUpperCase().replace(/\s+/g, "");
}

/** Comprueba que el código existe, está activo, no ha caducado y le quedan usos. */
export async function findValidDiscount(raw: string): Promise<ValidDiscount | { error: string }> {
  const code = normalizeDiscountCode(raw);
  if (!code) return { error: "Introduce un código de descuento." };
  if (code.length > 40) return { error: "Este código no es válido." };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await (supabaseAdmin as any)
    .from("discount_codes")
    .select("code, percent, active, max_uses, used_count, expires_at")
    .eq("code", code)
    .maybeSingle();

  if (error) {
    console.error("[discount] Error leyendo el código:", error.message);
    return { error: "No se pudo comprobar el código. Inténtalo de nuevo." };
  }
  if (!data || !data.active) return { error: "Este código no es válido." };
  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
    return { error: "Este código ha caducado." };
  }
  if (data.max_uses != null && data.used_count >= data.max_uses) {
    return { error: "Este código ya se ha utilizado." };
  }
  return { code: data.code as string, percent: Number(data.percent) };
}

/** Marca el código como usado para un pedido (idempotente). No lanza errores. */
export async function redeemDiscountCode(code: string, reference: string): Promise<void> {
  if (!code || !reference) return;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).rpc("redeem_discount_code", {
      _code: normalizeDiscountCode(code),
      _reference: reference,
    });
    if (error) console.error("[discount] No se pudo marcar el código como usado:", error.message);
  } catch (err) {
    console.error("[discount] Error marcando el código como usado:", err);
  }
}
