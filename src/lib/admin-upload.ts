import { supabase } from "@/integrations/supabase/client";

const BUCKET = "site-images";

async function convertToWebp(file: File): Promise<Blob> {
  // Si ya es WebP, no lo convertimos otra vez.
  if (file.type === "image/webp") {
    return file;
  }

  // Solo convertimos PNG y JPEG.
  // Otros formatos se mantienen tal cual.
  if (file.type !== "image/png" && file.type !== "image/jpeg") {
    return file;
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const image = new Image();

    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("No se pudo leer la imagen."));
      image.src = objectUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;

    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("No se pudo preparar la imagen.");
    }

    ctx.drawImage(image, 0, 0);

    const webp = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("No se pudo convertir la imagen a WebP."));
            return;
          }

          resolve(blob);
        },
        "image/webp",
        0.85,
      );
    });

    return webp;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

// Imágenes de tienda: productos, carrusel y categorías.
export async function uploadImage(
  file: File,
  folder: "carousel" | "products" | "categories",
): Promise<string> {
  const optimizedFile = await convertToWebp(file);

  const path = `${folder}/${crypto.randomUUID()}.webp`;

  const { error } = await supabase.storage.from(BUCKET).upload(
    path,
    optimizedFile,
    {
      cacheControl: "31536000",
      upsert: false,
      contentType: "image/webp",
    },
  );

  if (error) {
    throw new Error(error.message);
  }

  const { data } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(path);

  return data.publicUrl;
}

export async function pickFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";

    input.onchange = () => {
      resolve(input.files?.[0] ?? null);
    };

    input.click();
  });
}
