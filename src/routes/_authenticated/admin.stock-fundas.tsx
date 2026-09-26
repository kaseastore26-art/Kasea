import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  getCaseModelStockPublic,
  updateCaseModelStock,
} from "@/lib/case-stock.functions";
import { PHONE_MODELS } from "@/lib/phone-models";

export const Route = createFileRoute("/_authenticated/admin/stock-fundas")({
  component: StockFundasPage,
});

function StockFundasPage() {
  const [stock, setStock] = useState<
    Array<{
      id: string;
      model: string;
      stock: number;
      updated_at: string;
    }>
  >([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadStock();
  }, []);

  async function loadStock() {
    try {
      setLoading(true);
      setMessage("");

      const data = await getCaseModelStockPublic();

      setStock(
        Object.entries(data).map(([model, stock]) => ({
          id: model,
          model,
          stock: Number(stock ?? 0),
          updated_at: "",
        })),
      );
    } catch (error) {
      console.error(error);

      const errorMessage =
        error instanceof Error ? error.message : String(error);

      setMessage(`❌ Error: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  }

  async function saveStock(model: string, value: string) {
    const newStock = Number(value);

    if (!Number.isInteger(newStock) || newStock < 0) {
      setMessage(
        "❌ El stock debe ser un número entero igual o mayor que 0.",
      );
      return;
    }

    try {
      setSaving(model);
      setMessage("");

      await updateCaseModelStock({
        data: {
          model,
          stock: newStock,
        },
      });

      setStock((current) =>
        current.map((item) =>
          item.model === model
            ? {
                ...item,
                stock: newStock,
                updated_at: new Date().toISOString(),
              }
            : item,
        ),
      );

      setMessage(`✅ Stock de ${model} actualizado.`);
    } catch (error) {
      console.error(error);

      const errorMessage =
        error instanceof Error ? error.message : String(error);

      setMessage(`❌ Error: ${errorMessage}`);
    } finally {
      setSaving(null);
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">📱 Stock de fundas</h1>
        <p className="mt-4 text-gray-500">Cargando stock...</p>
      </div>
    );
  }

  const iphoneModels = PHONE_MODELS.iPhone ?? [];

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">📱 Stock de fundas</h1>

        <p className="mt-2 text-sm text-gray-500">
          Aquí controlas las unidades físicas disponibles por modelo de iPhone.
          El stock es compartido entre todas las fundas de ese modelo.
        </p>
      </div>

      {message && (
        <div className="mb-5 rounded-lg border bg-white p-3 text-sm">
          {message}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border bg-white">
        <div className="grid grid-cols-[1fr_160px_120px] gap-4 border-b bg-gray-50 px-5 py-3 text-sm font-semibold">
          <div>Modelo</div>
          <div>Stock físico</div>
          <div>Acción</div>
        </div>

        {iphoneModels.map((model) => {
          const item = stock.find((row) => row.model === model);
          const currentStock = item?.stock ?? 0;
          const isSaving = saving === model;

          return (
            <div
              key={model}
              className="grid grid-cols-[1fr_160px_120px] items-center gap-4 border-b px-5 py-4 last:border-b-0"
            >
              <div className="font-medium">{model}</div>

              <input
                type="number"
                min="0"
                step="1"
                defaultValue={currentStock}
                id={`stock-${model}`}
                className="w-full rounded-lg border px-3 py-2"
              />

              <button
                type="button"
                disabled={isSaving}
                onClick={() => {
                  const input = document.getElementById(
                    `stock-${model}`,
                  ) as HTMLInputElement | null;

                  saveStock(model, input?.value ?? "0");
                }}
                className="rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {isSaving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
