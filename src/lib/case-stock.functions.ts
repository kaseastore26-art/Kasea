import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

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

/**
 * Devuelve el stock físico compartido de todas las fundas por modelo de iPhone.
 *
 * Ejemplo:
 * {
 *   "iPhone 13": 3,
 *   "iPhone 14": 5
 * }
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
