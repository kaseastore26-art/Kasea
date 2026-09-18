import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Pencil, Trash2, Loader2, Upload, Package, ImageOff, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatPrice } from "@/lib/shopify";
import { uploadImage, pickFile } from "@/lib/admin-upload";
import {
  listProductsAdmin,
  upsertProduct,
  deleteProduct,
  setProductOrder,
  updateProductImageUrl,
} from "@/lib/admin-catalog.functions";
async function normalizeImageToWhite(url: string): Promise<File> {
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error("No se pudo descargar la imagen.");
  }

  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);

  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;

  const ctx = canvas.getContext("2d", {
    willReadFrequently: true,
  });

  if (!ctx) {
    throw new Error("No se pudo procesar la imagen.");
  }

  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  const imageData = ctx.getImageData(
    0,
    0,
    canvas.width,
    canvas.height,
  );

  const pixels = imageData.data;

  const samples: number[][] = [];

  const points = [
    [0, 0],
    [canvas.width - 1, 0],
    [0, canvas.height - 1],
    [canvas.width - 1, canvas.height - 1],
  ];

  for (const [x, y] of points) {
    const i = (y * canvas.width + x) * 4;
    samples.push([pixels[i], pixels[i + 1], pixels[i + 2]]);
  }

  const bgR = samples.reduce((sum, p) => sum + p[0], 0) / samples.length;
  const bgG = samples.reduce((sum, p) => sum + p[1], 0) / samples.length;
  const bgB = samples.reduce((sum, p) => sum + p[2], 0) / samples.length;

  const tolerance = 35;

  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];

    const distance = Math.sqrt(
      (r - bgR) ** 2 +
        (g - bgG) ** 2 +
        (b - bgB) ** 2,
    );

    const brightness = (r + g + b) / 3;

    if (distance <= tolerance && brightness >= 215) {
      pixels[i] = 255;
      pixels[i + 1] = 255;
      pixels[i + 2] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);

  const outputBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) {
          resolve(result);
        } else {
          reject(new Error("No se pudo crear la imagen."));
        }
      },
      "image/png",
      1,
    );
  });

  return new File(
    [outputBlob],
    `producto-fondo-blanco-${Date.now()}.png`,
    { type: "image/png" },
  );
}
export const Route = createFileRoute("/_authenticated/admin/productos")({
  component: AdminProductos,
});

type ProductRow = Awaited<ReturnType<typeof listProductsAdmin>>[number];

interface FormState {
  id?: string;
  title: string;
  description: string;
  priceEuros: string;
  stock: string;
  status: "active" | "draft" | "archived";
  imageUrl: string;
  isCustom: boolean;
}

const EMPTY: FormState = {
  title: "",
  description: "",
  priceEuros: "14.99",
  stock: "0",
  status: "active",
  imageUrl: "",
  isCustom: false,
};

function AdminProductos() {
  const qc = useQueryClient();
  const listFn = useServerFn(listProductsAdmin);
  const saveFn = useServerFn(upsertProduct);
  const delFn = useServerFn(deleteProduct);
  const orderFn = useServerFn(setProductOrder);
  const [reordering, setReordering] = useState(false);
  const updateImageFn = useServerFn(updateProductImageUrl);
  const [normalizing, setNormalizing] = useState(false);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["admin-products"],
    queryFn: () => listFn(),
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  function openCreate() {
    setForm(EMPTY);
    setOpen(true);
  }
  function openEdit(p: ProductRow) {
    setForm({
      id: p.id,
      title: p.title,
      description: p.description,
      priceEuros: (p.priceCents / 100).toFixed(2),
      stock: String(p.stock),
      status: p.status as FormState["status"],
      imageUrl: p.imageUrl,
      isCustom: p.isCustom,
    });
    setOpen(true);
  }

  async function handleUpload() {
    const file = await pickFile();
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImage(file, "products");
      setForm((f) => ({ ...f, imageUrl: url }));
    } catch (e) {
      toast.error("No se pudo subir la imagen", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!form.title.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    setSaving(true);
    try {
      await saveFn({
        data: {
          id: form.id,
          title: form.title.trim(),
          description: form.description,
          priceEuros: parseFloat(form.priceEuros) || 0,
          stock: parseInt(form.stock, 10) || 0,
          status: form.status,
          imageUrl: form.imageUrl,
        },
      });
      await qc.invalidateQueries({ queryKey: ["admin-products"] });
      toast.success(form.id ? "Producto actualizado" : "Producto creado");
      setOpen(false);
    } catch (e) {
      toast.error("No se pudo guardar", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  async function move(index: number, dir: "up" | "down") {
    const arr = products.map((p) => p.id);
    const j = dir === "up" ? index - 1 : index + 1;
    if (j < 0 || j >= arr.length) return;
    [arr[index], arr[j]] = [arr[j], arr[index]];
    setReordering(true);
    try {
      await orderFn({ data: { orderedIds: arr } });
      await qc.invalidateQueries({ queryKey: ["admin-products"] });
    } catch (e) {
      toast.error("No se pudo reordenar", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setReordering(false);
    }
  }

  async function remove(p: ProductRow) {
    if (!confirm(`¿Eliminar "${p.title}"? Esta acción no se puede deshacer.`)) return;
    try {
      await delFn({ data: { id: p.id } });
      await qc.invalidateQueries({ queryKey: ["admin-products"] });
      toast.success("Producto eliminado");
    } catch (e) {
      toast.error("No se pudo eliminar", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }
  async function normalizeOneProduct(p: ProductRow) {
    if (!p.imageUrl) {
      toast.error("Este producto no tiene imagen.");
      return;
    }

    if (!confirm(`¿Convertir el fondo de "${p.title}" a blanco?`)) {
      return;
    }

    setNormalizing(true);

    try {
      const file = await normalizeImageToWhite(p.imageUrl);

      const newUrl = await uploadImage(file, "products");

      await updateImageFn({
        data: {
          productId: p.id,
          imageUrl: newUrl,
        },
      });

      await qc.invalidateQueries({ queryKey: ["admin-products"] });

      toast.success("Fondo convertido a blanco");
    } catch (e) {
      toast.error("No se pudo normalizar la imagen", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setNormalizing(false);
    }
  }
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl">Productos</h2>
          <p className="text-sm text-muted-foreground">Gestiona catálogo, precios y stock.</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Nuevo producto
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center">
          <Package className="mx-auto h-10 w-10 text-muted-foreground" strokeWidth={1} />
          <p className="mt-3 text-sm text-muted-foreground">Aún no hay productos. Crea el primero.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b bg-secondary/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="p-3">Producto</th>
                <th className="p-3">Precio</th>
                <th className="p-3">Stock</th>
                <th className="p-3">Estado</th>
                <th className="p-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p, index) => (
                <tr key={p.id} className="border-b last:border-0 hover:bg-secondary/20">
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded bg-secondary">
                        {p.imageUrl ? (
                          <img src={p.imageUrl} alt={p.title} className="h-full w-full object-cover" />
                        ) : (
                          <ImageOff className="m-3 h-6 w-6 text-muted-foreground" strokeWidth={1} />
                        )}
                      </div>
                      <div>
                        <div className="font-medium">{p.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {p.handle}
                          {p.isCustom && (
                            <span className="ml-2 rounded bg-espresso/10 px-1.5 py-0.5 text-espresso">
                              Personalizada
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="p-3 tabular-nums">{formatPrice(p.priceCents / 100, "EUR")}</td>
                  <td className="p-3 tabular-nums">
                    {p.isCustom ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <span className={p.stock === 0 ? "text-destructive" : ""}>{p.stock}</span>
                    )}
                  </td>
                  <td className="p-3">
                    <span
                      className={`rounded px-2 py-0.5 text-xs ${
                        p.status === "active"
                          ? "bg-green-100 text-green-800"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {p.status === "active" ? "Publicado" : p.status === "draft" ? "Borrador" : "Archivado"}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={index === 0 || reordering}
                        onClick={() => move(index, "up")}
                        aria-label="Subir"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
  variant="ghost"
  size="icon"
  disabled={index === products.length - 1 || reordering}
  onClick={() => move(index, "down")}
  aria-label="Bajar"
>
  <ArrowDown className="h-4 w-4" />
</Button>

<Button
  variant="ghost"
  size="icon"
  onClick={() => normalizeOneProduct(p)}
  disabled={normalizing}
  aria-label="Fondo blanco"
  title="Convertir fondo a blanco"
>
  ✨
</Button>

<Button
  variant="ghost"
  size="icon"
  onClick={() => openEdit(p)}
  aria-label="Editar"
>
  <Pencil className="h-4 w-4" />
</Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(p)}
                        aria-label="Eliminar"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar producto" : "Nuevo producto"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="p-title">Nombre</Label>
              <Input
                id="p-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="p-desc">Descripción</Label>
              <textarea
                id="p-desc"
                rows={3}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="p-price">Precio (€)</Label>
                <Input
                  id="p-price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.priceEuros}
                  onChange={(e) => setForm({ ...form, priceEuros: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="p-stock">Stock {form.isCustom && "(no aplica)"}</Label>
                <Input
                  id="p-stock"
                  type="number"
                  min="0"
                  disabled={form.isCustom}
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="p-status">Estado</Label>
              <select
                id="p-status"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as FormState["status"] })}
              >
                <option value="active">Publicado</option>
                <option value="draft">Borrador (oculto)</option>
                <option value="archived">Archivado</option>
              </select>
            </div>
            <div>
              <Label>Imagen</Label>
              <div className="mt-1 flex items-center gap-3">
                <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded border bg-secondary">
                  {form.imageUrl ? (
                    <img src={form.imageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <ImageOff className="m-5 h-6 w-6 text-muted-foreground" strokeWidth={1} />
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleUpload}
                  disabled={uploading}
                  className="gap-2"
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Subir imagen
                </Button>
              </div>
              <Input
                className="mt-2"
                placeholder="…o pega una URL de imagen"
                value={form.imageUrl}
                onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Guardar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
