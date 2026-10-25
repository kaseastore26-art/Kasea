import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Check, Copy, Loader2, Percent, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createDiscountCodes,
  deleteDiscountCode,
  listDiscountCodes,
  setDiscountCodeActive,
  type AdminDiscountCode,
} from "@/lib/discount.functions";

export const Route = createFileRoute("/_authenticated/admin/descuentos")({
  component: AdminDescuentos,
});

type UsesMode = "single" | "unlimited" | "custom";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return iso.slice(0, 10);
  }
}

function statusOf(c: AdminDiscountCode): { label: string; tone: string } {
  if (!c.active) return { label: "Desactivado", tone: "bg-muted text-muted-foreground" };
  if (c.expiresAt && new Date(c.expiresAt).getTime() < Date.now()) {
    return { label: "Caducado", tone: "bg-muted text-muted-foreground" };
  }
  if (c.maxUses != null && c.usedCount >= c.maxUses) {
    return { label: "Usado", tone: "bg-secondary text-espresso" };
  }
  return { label: "Activo", tone: "bg-emerald-100 text-emerald-800" };
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          toast.error("No se pudo copiar");
        }
      }}
      className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-xs text-muted-foreground hover:bg-secondary hover:text-espresso"
      aria-label={`Copiar ${text}`}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function AdminDescuentos() {
  const qc = useQueryClient();
  const listFn = useServerFn(listDiscountCodes);
  const createFn = useServerFn(createDiscountCodes);
  const toggleFn = useServerFn(setDiscountCodeActive);
  const deleteFn = useServerFn(deleteDiscountCode);

  const { data: codes, isLoading } = useQuery({
    queryKey: ["admin", "discount-codes"],
    queryFn: () => listFn(),
  });

  const [percent, setPercent] = useState("10");
  const [quantity, setQuantity] = useState("1");
  const [usesMode, setUsesMode] = useState<UsesMode>("single");
  const [customUses, setCustomUses] = useState("5");
  const [expiresOn, setExpiresOn] = useState("");
  const [note, setNote] = useState("");
  const [customCode, setCustomCode] = useState("");
  const [justCreated, setJustCreated] = useState<string[]>([]);

  const qty = Math.max(1, parseInt(quantity, 10) || 1);

  const createMutation = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          percent: parseInt(percent, 10) || 0,
          quantity: customCode.trim() ? 1 : qty,
          maxUses:
            usesMode === "single" ? 1 : usesMode === "unlimited" ? null : Math.max(1, parseInt(customUses, 10) || 1),
          expiresOn: expiresOn || "",
          note: note.trim(),
          customCode: customCode.trim(),
        },
      }),
    onSuccess: (res) => {
      setJustCreated(res.codes);
      setCustomCode("");
      qc.invalidateQueries({ queryKey: ["admin", "discount-codes"] });
      toast.success(res.codes.length === 1 ? "Código creado" : `${res.codes.length} códigos creados`);
    },
    onError: (err: Error) => toast.error("No se pudo crear", { description: err.message }),
  });

  const toggleMutation = useMutation({
    mutationFn: (v: { id: string; active: boolean }) => toggleFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "discount-codes"] }),
    onError: (err: Error) => toast.error("No se pudo cambiar", { description: err.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "discount-codes"] });
      toast.success("Código borrado");
    },
    onError: (err: Error) => toast.error("No se pudo borrar", { description: err.message }),
  });

  const usesOptions: Array<{ value: UsesMode; label: string }> = [
    { value: "single", label: "Un solo uso" },
    { value: "unlimited", label: "Ilimitado" },
    { value: "custom", label: "Nº de usos" },
  ];

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h2 className="font-display text-2xl">Códigos de descuento</h2>
        <p className="text-sm text-muted-foreground">
          Crea códigos para regalar a tus clientes (en tarjetas, redes, etc.). El cliente lo escribe en el
          carrito y se le descuenta el porcentaje de los productos.
        </p>
      </div>

      {/* Generador */}
      <div className="rounded-lg border bg-card p-6">
        <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Percent className="h-4 w-4" /> Generar códigos nuevos
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="percent">Descuento (%)</Label>
            <Input
              id="percent"
              type="number"
              min="1"
              max="90"
              value={percent}
              onChange={(e) => setPercent(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="quantity">Cuántos códigos</Label>
            <Input
              id="quantity"
              type="number"
              min="1"
              max="100"
              value={customCode.trim() ? "1" : quantity}
              disabled={!!customCode.trim()}
              onChange={(e) => setQuantity(e.target.value)}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Por ejemplo 20 si vas a imprimir 20 tarjetas, cada una con su código.
            </p>
          </div>

          <div className="sm:col-span-2">
            <Label>Usos de cada código</Label>
            <div className="mt-1 flex flex-wrap gap-2">
              {usesOptions.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setUsesMode(o.value)}
                  className={`rounded-md border px-3 py-2 text-sm transition-colors ${
                    usesMode === o.value
                      ? "border-espresso bg-secondary/60 text-espresso"
                      : "border-border hover:bg-secondary/30"
                  }`}
                >
                  {o.label}
                </button>
              ))}
              {usesMode === "custom" && (
                <Input
                  type="number"
                  min="1"
                  className="w-24"
                  value={customUses}
                  onChange={(e) => setCustomUses(e.target.value)}
                />
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              "Un solo uso" es lo ideal para tarjetas personales; "Ilimitado" para un código de campaña en redes.
            </p>
          </div>

          <div>
            <Label htmlFor="expires">Caduca el (opcional)</Label>
            <Input id="expires" type="date" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} />
          </div>

          <div>
            <Label htmlFor="note">Nota (opcional)</Label>
            <Input
              id="note"
              placeholder="Ej.: Tarjeta próxima compra"
              maxLength={120}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="custom">Código personalizado (opcional)</Label>
            <Input
              id="custom"
              placeholder="Déjalo vacío para generar uno automático (KASEA-XXXXXX)"
              maxLength={40}
              value={customCode}
              onChange={(e) => setCustomCode(e.target.value.toUpperCase().replace(/\s+/g, ""))}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Por ejemplo NAVIDAD10. Solo letras, números y guiones.
            </p>
          </div>
        </div>

        <div className="mt-6">
          <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending} className="gap-2">
            {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {customCode.trim() || qty === 1 ? "Generar código" : `Generar ${qty} códigos`}
          </Button>
        </div>

        {justCreated.length > 0 && (
          <div className="mt-6 rounded-md border border-emerald-200 bg-emerald-50 p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-emerald-900">
                {justCreated.length === 1 ? "Código listo:" : `${justCreated.length} códigos listos:`}
              </p>
              {justCreated.length > 1 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(justCreated.join("\n"));
                      toast.success("Códigos copiados");
                    } catch {
                      toast.error("No se pudo copiar");
                    }
                  }}
                >
                  <Copy className="h-3.5 w-3.5" /> Copiar todos
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {justCreated.map((c) => (
                <span
                  key={c}
                  className="inline-flex items-center gap-1 rounded bg-white px-2 py-1 font-mono text-sm text-espresso"
                >
                  {c} <CopyButton text={c} />
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Listado */}
      <div className="mt-8">
        <h3 className="mb-3 font-display text-xl">Tus códigos</h3>
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !codes || codes.length === 0 ? (
          <p className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
            Todavía no has creado ningún código.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Código</th>
                  <th className="px-4 py-3">Dto.</th>
                  <th className="px-4 py-3">Usos</th>
                  <th className="px-4 py-3">Caduca</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Nota</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {codes.map((c) => {
                  const st = statusOf(c);
                  return (
                    <tr key={c.id}>
                      <td className="whitespace-nowrap px-4 py-3 font-mono">
                        {c.code} <CopyButton text={c.code} />
                      </td>
                      <td className="px-4 py-3">{c.percent} %</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {c.usedCount} / {c.maxUses ?? "∞"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">{formatDate(c.expiresAt)}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs ${st.tone}`}>{st.label}</span>
                      </td>
                      <td className="max-w-[180px] truncate px-4 py-3 text-muted-foreground">{c.note || "—"}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={toggleMutation.isPending}
                          onClick={() => toggleMutation.mutate({ id: c.id, active: !c.active })}
                        >
                          {c.active ? "Desactivar" : "Activar"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="ml-1 text-muted-foreground hover:text-destructive"
                          disabled={deleteMutation.isPending}
                          onClick={() => {
                            if (window.confirm(`¿Borrar el código ${c.code}? No se puede deshacer.`)) {
                              deleteMutation.mutate(c.id);
                            }
                          }}
                          aria-label={`Borrar ${c.code}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
