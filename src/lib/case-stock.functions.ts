import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function publicClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: {
        storage: undefined,
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}

async function assertAdmin(context: any) {
  const { data, error } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Forbidden: admin role required");
  }
}

/**
 * STOCK PÚBLICO
 *
 * Devuelve el stock físico compartido de todas las fundas
 * por modelo de iPhone.
 */
export const getCaseModelStockPublic = createServerFn({ method: "GET" })
  .handler(async () => {
    const supabase = publicClient();

    const { data, error } = await supabase
      .from("case_model_stock")
      .select("model, stock")
      .order("model", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return Object.fromEntries(
      (data ?? []).map((row) => [
        row.model,
        Number(row.stock ?? 0),
      ]),
    ) as Record<string, number>;
  });

/**
 * STOCK PARA ADMIN
 *
 * Devuelve todos los modelos con su stock actual.
 */
export const getCaseModelStockAdmin = createServerFn({ method: "GET" })
  .handler(async () => {
    const supabase = publicClient();

    const { data, error } = await supabase
      .from("case_model_stock")
      .select("id, model, stock, updated_at")
      .order("model", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return data ?? [];
  });

/**
 * ACTUALIZAR STOCK DE UN MODELO
 */
const UpdateCaseModelStockSchema = z.object({
  model: z.string().min(1),
  stock: z.number().int().min(0),
});

export const updateCaseModelStock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    UpdateCaseModelStockSchema.parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    const { error } = await context.supabase
      .from("case_model_stock")
      .update({
        stock: data.stock,
        updated_at: new Date().toISOString(),
      })
      .eq("model", data.model);

    if (error) {
      throw new Error(error.message);
    }

    return { ok: true };
  });
