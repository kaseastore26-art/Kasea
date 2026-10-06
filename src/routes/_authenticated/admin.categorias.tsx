import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw, Save, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { listCategoryImagesPublic, saveCategoryImage } from "@/lib/admin.functions";
import { pickFile, uploadImage } from "@/lib/admin-upload";
import catSublimacion from "@/assets/cat-sublimacion.jpg";

type Slug = "transparentes" | "sublimacion" | "colgantes" | "protectores" | "cargadores";

const CATEGORIES: Array<{
  slug: Slug;
  title: string;
  route: string;
  fallback: string;
  defaultAlt: string;
}> = [
  {
    slug: "sublimacion",
    title: "Fundas para el móvil",
    route: "/fundas-sublimacion",
    fallback: catSublimacion,
    defaultAlt: "Funda para sublimación con pinceles y paleta de color",
  },
  {
    slug: "colgantes",
    title: "Colgantes",
    route: "/accesorios",
    fallback: catSublimacion,
    defaultAlt: "Colgantes para móvil",
  },
  {
    slug: "protectores",
    title: "Protectores",
    route: "/accesorios",
    fallback: catSublimacion,
    defaultAlt: "Protectores para móvil",
  },
  {
    slug: "cargadores",
    title: "Cargadores",
    route: "/accesorios",
    fallback: catSublimacion,
    defaultAlt: "Cargadores para móvil",
  },
];

export const Route = createFileRoute("/_authenticated/admin/categorias")({
  component: CategoriesAdmin,
});

function CategoriesAdmin() {
  const listFn = useServerFn(listCategoryImagesPublic);
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "category-images"],
    queryFn: () => listFn(),
  });

  const overrides = useMemo(() => {
    const map = new Map<string, { image_url: string; alt: string; title: string }>();
    (data ?? []).forEach((r) => map.set(r.slug, r));
    return map;
  }, [data]);

  return (
    <div>
      <div className="mb-6">
        <h2 className="font-display text-2xl">Imágenes de categorías</h2>
        <p className="text-sm text-muted-foreground">
          Estas son las imágenes de categoría que aparecen en la tienda y en la sección de Accesorios.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {CATEGORIES.map((cat) => {
            const o = overrides.get(cat.slug);
            return (
              <CategoryCard
                key={cat.slug}
                slug={cat.slug}
                title={cat.title}
                route={cat.route}
                imageUrl={o?.image_url ?? cat.fallback}
                alt={o?.alt ?? cat.defaultAlt}
                overrideTitle={o?.title ?? ""}
                isCustom={!!o}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function CategoryCard({
  slug,
  title,
  route,
  imageUrl,
  alt,
  overrideTitle,
  isCustom,
}: {
  slug: Slug;
  title: string;
  route: string;
  imageUrl: string;
  alt: string;
  overrideTitle: string;
  isCustom: boolean;
}) {
  const saveFn = useServerFn(saveCategoryImage);
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [altValue, setAltValue] = useState(alt);
  const [titleValue, setTitleValue] = useState(overrideTitle);
  const [descriptionValue, setDescriptionValue] = useState("");

  useEffect(() => {
    setAltValue(alt);
    setTitleValue(overrideTitle);
  }, [alt, overrideTitle]);

  const saveMutation = useMutation({
    mutationFn: async (payload: { image_url: string; alt: string; title: string; description: string }) =>
      saveFn({ data: { slug, ...payload } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "category-images"] });
      qc.invalidateQueries({ queryKey: ["public", "category-images"] });
      toast.success("Imagen actualizada");
    },
    onError: (err: Error) => toast.error("Error al guardar", { description: err.message }),
  });

  async function handleReplace() {
    const file = await pickFile();
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImage(file, "categories");
      await saveMutation.mutateAsync({ image_url: url, alt: altValue, title: titleValue, description: descriptionValue });
    } catch (err) {
      toast.error("No se pudo subir", { description: err instanceof Error ? err.message : "" });
    } finally {
      setUploading(false);
    }
  }

  function handleSaveMeta() {
    saveMutation.mutate({ image_url: imageUrl, alt: altValue, title: titleValue, description: descriptionValue });
    setEditing(false);
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
      <div className="aspect-[4/5] overflow-hidden bg-secondary">
        <img src={imageUrl} alt={alt} className="h-full w-full object-cover" />
      </div>
      <div className="p-4">
        <p className="font-display text-lg">{title}</p>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {isCustom ? "Imagen personalizada" : "Imagen por defecto"} · {route}
        </p>
        <div className="mt-4 flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 gap-2"
            onClick={handleReplace}
            disabled={uploading || saveMutation.isPending}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Reemplazar
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-2"
            onClick={() => setEditing(true)}
            disabled={saveMutation.isPending}
          >
            <Pencil className="h-4 w-4" />
            Editar
          </Button>
        </div>
      </div>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar {title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium">Título (opcional)</label>
              <Input value={titleValue} onChange={(e) => setTitleValue(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">
                Texto alternativo (accesibilidad / SEO)
              </label>
              <Input value={altValue} onChange={(e) => setAltValue(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveMeta} disabled={saveMutation.isPending} className="gap-2">
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
