import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Loader2, Truck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getShopSettingsAdmin, updateShopSettings } from "@/lib/admin-catalog.functions";

export const Route = createFileRoute("/_authenticated/admin/ajustes")({
  component: AdminAjustes,
});

function AdminAjustes() {
  const qc = useQueryClient();
  const getFn = useServerFn(getShopSettingsAdmin);
  const saveFn = useServerFn(updateShopSettings);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: () => getFn(),
  });

  const [flat, setFlat] = useState("");
  const [nacex, setNacex] = useState("");
  const [threshold, setThreshold] = useState("");
  const [notifyEmail, setNotifyEmail] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) {
      setFlat((data.shippingFlatCents / 100).toFixed(2));
      setNacex((data.shippingNacexCents / 100).toFixed(2));
      setThreshold((data.freeThresholdCents / 100).toFixed(2));
      setNotifyEmail(data.notifyEmail ?? "");
    }
  }, [data]);

  async function save() {
    setSaving(true);
    try {
      await saveFn({
        data: {
          shippingFlatEuros: parseFloat(flat) || 0,
          shippingNacexEuros: parseFloat(nacex) || 0,
          freeThresholdEuros: parseFloat(threshold) || 0,
          notifyEmail: notifyEmail.trim(),
        },
      });
      await qc.invalidateQueries({ queryKey: ["admin-settings"] });
      await qc.invalidateQueries({ queryKey: ["shop-settings"] });
      toast.success("Ajustes guardados");
    } catch (e) {
      toast.error("No se pudo guardar", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-lg">
      <div className="mb-6">
        <h2 className="font-display text-2xl">Ajustes de envío</h2>
        <p className="text-sm text-muted-foreground">
          Configura la tarifa de envío y el importe a partir del cual el envío es gratis.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="rounded-lg border bg-card p-6">
          <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Truck className="h-4 w-4" /> Estas reglas se aplican en el checkout automáticamente.
          </div>
          <div className="space-y-4">
            <div>
              <Label htmlFor="flat">Tarifa de envío (€)</Label>
              <Input
                id="flat"
                type="number"
                step="0.01"
                min="0"
                value={flat}
                onChange={(e) => setFlat(e.target.value)}
              />
              <p className="mt-1 text-xs text-muted-foreground">Coste del envío a domicilio.</p>
            </div>
                       <div>
              <Label htmlFor="nacex">Recogida en punto NACEX (€)</Label>
              <Input
                id="nacex"
                type="number"
                step="0.01"
                min="0"
                value={nacex}
                onChange={(e) => setNacex(e.target.value)}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Coste de la recogida en un punto NACEX.
              </p>
            </div>

            <div>
              <Label htmlFor="threshold">Envío gratis a partir de (€)</Label>
              <Input
                id="threshold"
                type="number"
                step="0.01"
                min="0"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Pedidos con subtotal igual o superior a este importe no pagan envío.
              </p>
            </div>

            <div className="border-t border-border/60 pt-4">
              <Label htmlFor="notify">Correo para avisos de pedidos</Label>
              <Input
                id="notify"
                type="email"
                placeholder="tu-correo@ejemplo.com"
                value={notifyEmail}
                onChange={(e) => setNotifyEmail(e.target.value)}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Recibirás aquí un aviso con cada nueva orden (y el diseño, si es funda
                personalizada). Déjalo vacío para no recibir avisos.
              </p>
            </div>
          </div>
          <div className="mt-6">
            <Button onClick={save} disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Guardar cambios
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
