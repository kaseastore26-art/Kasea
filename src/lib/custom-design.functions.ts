import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const UploadSchema = z.object({
  // data URL PNG/JPEG del diseño renderizado
  dataUrl: z
    .string()
    .regex(/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/, "Formato de imagen no válido")
    // La foto original (hasta 3600 px en JPEG) para poder imprimir a 300 ppp.
    .max(16_000_000, "La imagen es demasiado grande"),
});

// Guarda TODOS los datos del diseño personalizado para producción (visible en
// el admin) y devuelve su id, que viaja con la línea del pedido.
const SaveDesignSchema = z.object({
  model: z.string().default(""),
  imageUrl: z.string().optional(),
  previewUrl: z.string().optional(),
  text: z.string().default(""),
  font: z.string().optional(),
  color: z.string().optional(),
  fontSize: z.number().optional(),
  posX: z.number().optional(),
  posY: z.number().optional(),
  rotation: z.number().optional(),
  params: z.record(z.string(), z.unknown()).optional(),
});

export const saveCustomDesign = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => SaveDesignSchema.parse(d))
  .handler(async ({ data }): Promise<{ id: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("custom_designs")
      .insert({
        model: data.model || null,
        image_url: data.imageUrl ?? null,
        preview_url: data.previewUrl ?? null,
        text_content: data.text || null,
        font: data.font ?? null,
        color: data.color ?? null,
        font_size: data.fontSize ?? null,
        pos_x: data.posX ?? null,
        pos_y: data.posY ?? null,
        rotation: data.rotation ?? null,
        params: (data.params ?? {}) as never,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const uploadCustomDesign = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => UploadSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [header, base64] = data.dataUrl.split(",");
    const contentType = header.includes("jpeg") ? "image/jpeg" : "image/png";
    const ext = contentType === "image/jpeg" ? "jpg" : "png";
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const path = `custom-designs/${crypto.randomUUID()}.${ext}`;

    const { error } = await supabaseAdmin.storage.from("site-images").upload(path, bytes, {
      contentType,
      cacheControl: "31536000",
      upsert: false,
    });
    if (error) throw new Error(error.message);

    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from("site-images")
      .createSignedUrl(path, 60 * 60 * 24 * 365);
    if (signErr || !signed) throw new Error(signErr?.message ?? "No se pudo generar el enlace");

    return { url: signed.signedUrl };
  });
