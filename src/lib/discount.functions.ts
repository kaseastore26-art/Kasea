/* eslint-disable @typescript-eslint/no-explicit-any */
// ============================================================================
// Códigos de descuento — server functions.
//
//   - validateDiscountCode: pública, la usa el carrito para mostrar el descuento.
//     (El descuento real lo vuelve a comprobar el servidor al cobrar.)
//   - Funciones de admin: listar, generar, activar/desactivar y borrar códigos.
//     Exigen sesión + rol admin y escriben con la service role.
// ============================================================================
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type AuthedContext = { supabase: any; userId: string };

async function assertAdmin(ctx: AuthedContext) {
  const { data, error } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: se requiere rol de administrador.");
}

async function adminClient(): Promise<any> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

// Sin letras/números que se confunden (O/0, I/1, L).
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function randomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return "KASEA-" + Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

// ---------------------------------------------------------------------------
// Pública: comprobar un código desde el carrito
// ---------------------------------------------------------------------------
export type DiscountCheckResult = { code: string; percent: number } | { error: string };

export const validateDiscountCode = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ code: z.string().max(60) }).parse(d))
  .handler(async ({ data }): Promise<DiscountCheckResult> => {
    const { findValidDiscount } = await import("@/lib/discount.server");
    return findValidDiscount(data.code);
  });

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------
export interface AdminDiscountCode {
  id: string;
  code: string;
  percent: number;
  maxUses: number | null;
  usedCount: number;
  expiresAt: string | null;
  active: boolean;
  note: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export const listDiscountCodes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminDiscountCode[]> => {
    const ctx = context as unknown as AuthedContext;
    await assertAdmin(ctx);
    const admin = await adminClient();
    const { data, error } = await admin
      .from("discount_codes")
      .select("id, code, percent, max_uses, used_count, expires_at, active, note, created_at, last_used_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return ((data ?? []) as any[]).map((r) => ({
      id: r.id,
      code: r.code,
      percent: r.percent,
      maxUses: r.max_uses,
      usedCount: r.used_count,
      expiresAt: r.expires_at,
      active: r.active,
      note: r.note ?? "",
      createdAt: r.created_at,
      lastUsedAt: r.last_used_at,
    }));
  });

const CreateSchema = z.object({
  percent: z.number().int().min(1, "Mínimo 1 %").max(90, "Máximo 90 %"),
  quantity: z.number().int().min(1).max(100).default(1),
  maxUses: z.number().int().positive().nullable().default(1), // null = ilimitado
  expiresOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal("")),
  note: z.string().trim().max(120).default(""),
  customCode: z.string().trim().max(40).optional().or(z.literal("")),
});

export const createDiscountCodes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateSchema.parse(d))
  .handler(async ({ data, context }): Promise<{ codes: string[] }> => {
    const ctx = context as unknown as AuthedContext;
    await assertAdmin(ctx);
    const admin = await adminClient();

    const expires_at = data.expiresOn ? `${data.expiresOn}T23:59:59+01:00` : null;
    const base = {
      percent: data.percent,
      max_uses: data.maxUses,
      expires_at,
      note: data.note || null,
      active: true,
    };

    // Código elegido a mano (solo uno).
    const custom = (data.customCode ?? "").toUpperCase().replace(/\s+/g, "");
    if (custom) {
      if (!/^[A-Z0-9-]{4,40}$/.test(custom)) {
        throw new Error("El código solo puede tener letras, números y guiones (mínimo 4).");
      }
      const { error } = await admin.from("discount_codes").insert({ ...base, code: custom });
      if (error) {
        if (error.code === "23505") throw new Error(`Ya existe un código "${custom}".`);
        throw new Error(error.message);
      }
      return { codes: [custom] };
    }

    // Códigos aleatorios (reintenta si alguno coincide con uno existente).
    const created: string[] = [];
    let remaining = data.quantity;
    for (let attempt = 0; attempt < 5 && remaining > 0; attempt++) {
      const batch = Array.from({ length: remaining }, () => randomCode());
      const unique = [...new Set(batch)];
      const { data: rows, error } = await admin
        .from("discount_codes")
        .upsert(
          unique.map((code) => ({ ...base, code })),
          { onConflict: "code", ignoreDuplicates: true },
        )
        .select("code");
      if (error) throw new Error(error.message);
      for (const r of (rows ?? []) as any[]) created.push(r.code);
      remaining = data.quantity - created.length;
    }
    if (created.length === 0) throw new Error("No se pudieron generar los códigos. Inténtalo de nuevo.");
    return { codes: created };
  });

export const setDiscountCodeActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), active: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as AuthedContext;
    await assertAdmin(ctx);
    const admin = await adminClient();
    const { error } = await admin.from("discount_codes").update({ active: data.active }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteDiscountCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as AuthedContext;
    await assertAdmin(ctx);
    const admin = await adminClient();
    const { error } = await admin.from("discount_codes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
