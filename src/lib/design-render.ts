import {
  PRINT_SHEET,
  PX_PER_MM,
  TEMPLATES,
  caseSizeMm,
  cameraShape,
  clampTransform,
  clampFree,
  specFor,
  templateSizeMm,
  type PhotoTransform,
  type TemplateId,
} from "@/lib/case-design";

export interface DesignRenderOptions {
  specW: number;
  specH: number;
  image: string | null;
  fit: "cover" | "contain";
  zoom: number;
  imgX: number;
  imgY: number;
  rotation: number;
  text: string;
  font: string;
  color: string;
  fontSize: number; // px en la vista previa
  previewWidth: number; // ancho real de la vista previa en px
  posX: number;
  posY: number;
  textW: number;
  textRot: number;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No se pudo cargar la imagen"));
    img.src = src;
  });
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let current = "";
    for (const word of paragraph.split(" ")) {
      const candidate = current ? `${current} ${word}` : word;
      if (ctx.measureText(candidate).width > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    lines.push(current);
  }
  return lines;
}

/** Renderiza el diseño de la funda a un data URL PNG. */
export async function renderDesign(o: DesignRenderOptions): Promise<string> {
  const W = 1200;
  const H = Math.round((W * o.specH) / o.specW);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas no disponible");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  if (o.image) {
    const img = await loadImage(o.image);
    const scaleBase =
      o.fit === "cover"
        ? Math.max(W / img.width, H / img.height)
        : Math.min(W / img.width, H / img.height);
    const dw = img.width * scaleBase;
    const dh = img.height * scaleBase;
    const dx = (W - dw) * (o.imgX / 100);
    const dy = (H - dh) * (o.imgY / 100);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.clip();
    ctx.translate(W / 2, H / 2);
    ctx.rotate((o.rotation * Math.PI) / 180);
    ctx.scale(o.zoom, o.zoom);
    ctx.translate(-W / 2, -H / 2);
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.restore();
  }

  if (o.text.trim()) {
    const k = W / Math.max(1, o.previewWidth);
    const fontSize = o.fontSize * k;
    ctx.save();
    ctx.font = `${fontSize}px ${o.font}`;
    ctx.fillStyle = o.color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const maxWidth = (o.textW / 100) * W;
    const lines = wrapLines(ctx, o.text, maxWidth);
    const lineHeight = fontSize * 1.1;

    ctx.translate((o.posX / 100) * W, (o.posY / 100) * H);
    ctx.rotate((o.textRot * Math.PI) / 180);
    const startY = -((lines.length - 1) * lineHeight) / 2;
    lines.forEach((line, i) => ctx.fillText(line, 0, startY + i * lineHeight));
    ctx.restore();
  }

  return canvas.toDataURL("image/png");
}

// ============================================================================
// Editor nuevo (sublimación 3D): vista previa, original y archivo de impresión
// ============================================================================

type Drawable = HTMLImageElement | ImageBitmap | HTMLCanvasElement;

function sizeOf(img: Drawable): { w: number; h: number } {
  if (img instanceof HTMLImageElement) return { w: img.naturalWidth, h: img.naturalHeight };
  return { w: img.width, h: img.height };
}

/** Pinta la foto con su transformación. k = px por mm; (ox, oy) = centro de la plantilla en px. */
export function drawPhoto(
  ctx: CanvasRenderingContext2D,
  img: Drawable,
  t: PhotoTransform,
  k: number,
  ox: number,
  oy: number,
) {
  const { w, h } = sizeOf(img);
  const dw = t.w * k;
  const dh = (dw * h) / w;
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.translate(ox + t.cx * k, oy + t.cy * k);
  ctx.rotate((t.rot * Math.PI) / 180);
  ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
  ctx.restore();
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  rx: number,
  ry: number,
) {
  rx = Math.min(rx, w / 2);
  ry = Math.min(ry, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rx, y);
  ctx.lineTo(x + w - rx, y);
  ctx.ellipse(x + w - rx, y + ry, rx, ry, 0, -Math.PI / 2, 0);
  ctx.lineTo(x + w, y + h - ry);
  ctx.ellipse(x + w - rx, y + h - ry, rx, ry, 0, 0, Math.PI / 2);
  ctx.lineTo(x + rx, y + h);
  ctx.ellipse(x + rx, y + h - ry, rx, ry, 0, Math.PI / 2, Math.PI);
  ctx.lineTo(x, y + ry);
  ctx.ellipse(x + rx, y + ry, rx, ry, 0, Math.PI, Math.PI * 1.5);
  ctx.closePath();
}

/** Dibuja el módulo de cámara. (x0, y0) = esquina sup. izq. de la funda en px. */
export function drawCamera(
  ctx: CanvasRenderingContext2D,
  model: string,
  k: number,
  x0: number,
  y0: number,
) {
  const cam = cameraShape(model, specFor(model));
  ctx.save();
  ctx.translate(x0, y0);
  ctx.shadowColor = "rgba(0,0,0,0.25)";
  ctx.shadowBlur = 1.2 * k;
  ctx.shadowOffsetY = 0.4 * k;
  roundRectPath(ctx, cam.x * k, cam.y * k, cam.w * k, cam.h * k, cam.rx * k, cam.ry * k);
  const g = ctx.createLinearGradient(0, cam.y * k, 0, (cam.y + cam.h) * k);
  g.addColorStop(0, "#2a2a2d");
  g.addColorStop(1, "#141416");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.shadowColor = "transparent";
  for (const c of cam.circles) {
    const cx = c.cx * k;
    const cy = c.cy * k;
    const r = c.r * k;
    if (c.kind === "lens") {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = "#3a3a3d";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.72, 0, Math.PI * 2);
      ctx.fillStyle = "#08080c";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.32, 0, Math.PI * 2);
      ctx.fillStyle = "#1b2440";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx - r * 0.25, cy - r * 0.25, r * 0.12, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = c.kind === "flash" ? "#efe9d8" : "#2b2b2e";
      ctx.fill();
    }
  }
  ctx.restore();
}

/** Vista previa de la funda (para la bolsa, el correo y el admin). PNG con fondo transparente. */
export function renderCasePreview(
  img: Drawable,
  t: PhotoTransform,
  model: string,
  widthPx = 700,
): string {
  const c = caseSizeMm(specFor(model));
  const pad = 0.04 * widthPx;
  const k = (widthPx - pad * 2) / c.w;
  const W = Math.round(widthPx);
  const H = Math.round(c.h * k + pad * 2);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas no disponible");

  const x0 = pad;
  const y0 = pad;
  // sombra de la funda
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.18)";
  ctx.shadowBlur = 3 * k;
  ctx.shadowOffsetY = 1 * k;
  roundRectPath(ctx, x0, y0, c.w * k, c.h * k, c.r * k, c.r * k);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.restore();

  // foto recortada con la forma de la funda
  ctx.save();
  roundRectPath(ctx, x0, y0, c.w * k, c.h * k, c.r * k, c.r * k);
  ctx.clip();
  drawPhoto(ctx, img, t, k, x0 + (c.w * k) / 2, y0 + (c.h * k) / 2);
  ctx.restore();

  drawCamera(ctx, model, k, x0, y0);

  // borde
  roundRectPath(ctx, x0, y0, c.w * k, c.h * k, c.r * k, c.r * k);
  ctx.strokeStyle = "rgba(0,0,0,0.12)";
  ctx.lineWidth = Math.max(1, 0.35 * k);
  ctx.stroke();

  return canvas.toDataURL("image/png");
}

/** Reduce la foto original (si es enorme) y la pasa a JPEG para subirla. */
export function originalToJpeg(
  img: HTMLImageElement,
  maxSide = 3600,
  quality = 0.92,
): { dataUrl: string; w: number; h: number } {
  const s = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * s);
  const h = Math.round(img.naturalHeight * s);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas no disponible");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, w, h);
  return { dataUrl: canvas.toDataURL("image/jpeg", quality), w, h };
}

// ---- PNG con resolución de 300 ppp (para que Photoshop lo abra a tamaño real) ----
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function setPngDpi(png: Uint8Array, dpi: number): Uint8Array {
  const ppm = Math.round(dpi / 0.0254);
  const chunk = new Uint8Array(4 + 4 + 9 + 4);
  const dv = new DataView(chunk.buffer);
  dv.setUint32(0, 9);
  chunk.set([0x70, 0x48, 0x59, 0x73], 4); // "pHYs"
  dv.setUint32(8, ppm);
  dv.setUint32(12, ppm);
  chunk[16] = 1; // unidad: metro
  dv.setUint32(17, crc32(chunk.subarray(4, 17)));
  // Firma (8) + IHDR (25) = 33 bytes; insertamos justo después.
  const out = new Uint8Array(png.length + chunk.length);
  out.set(png.subarray(0, 33), 0);
  out.set(chunk, 33);
  out.set(png.subarray(33), 33 + chunk.length);
  return out;
}

async function loadBitmap(url: string): Promise<ImageBitmap> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo descargar la foto (${res.status})`);
  return createImageBitmap(await res.blob());
}

/**
 * Archivo de impresión a 300 ppp en una hoja de 150 × 240 mm, con la plantilla
 * (grande o pequeña) centrada y la foto cubriendo la parte trasera Y los
 * laterales. Sin espejo ni perfil: eso se aplica en Photoshop al imprimir.
 */
export async function renderPrintFile(
  imageUrl: string,
  t: PhotoTransform,
  templateId: TemplateId,
): Promise<Blob> {
  const bmp = await loadBitmap(imageUrl);
  const tpl = TEMPLATES[templateId];
  const stage = templateSizeMm(templateId);
  const fixed = clampTransform(t, bmp.width, bmp.height, stage);

  const W = PRINT_SHEET.widthPx;
  const H = PRINT_SHEET.heightPx;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas no disponible");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  // Plantilla centrada en la hoja
  const x0 = Math.round((W - tpl.widthPx) / 2);
  const y0 = Math.round((H - tpl.heightPx) / 2);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, tpl.widthPx, tpl.heightPx);
  ctx.clip();
  drawPhoto(ctx, bmp, fixed, PX_PER_MM, x0 + tpl.widthPx / 2, y0 + tpl.heightPx / 2);
  ctx.restore();
  bmp.close();

  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("No se pudo generar el PNG"))), "image/png"),
  );
  const bytes = setPngDpi(new Uint8Array(await blob.arrayBuffer()), 300);
  return new Blob([bytes], { type: "image/png" });
}


// ============================================================================
// Varias fotos
// ============================================================================
export interface RenderLayer {
  img: Drawable;
  t: PhotoTransform;
}

/** Vista previa con varias fotos (fondo blanco si hay más de una). */
export function renderCasePreviewLayers(
  layers: RenderLayer[],
  model: string,
  opts: { cover: boolean; background: string },
  widthPx = 700,
): string {
  if (opts.cover && layers.length === 1) return renderCasePreview(layers[0].img, layers[0].t, model, widthPx);
  const c = caseSizeMm(specFor(model));
  const pad = 0.04 * widthPx;
  const k = (widthPx - pad * 2) / c.w;
  const W = Math.round(widthPx);
  const H = Math.round(c.h * k + pad * 2);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas no disponible");
  const x0 = pad;
  const y0 = pad;

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.18)";
  ctx.shadowBlur = 3 * k;
  ctx.shadowOffsetY = 1 * k;
  roundRectPath(ctx, x0, y0, c.w * k, c.h * k, c.r * k, c.r * k);
  ctx.fillStyle = opts.background || "#ffffff";
  ctx.fill();
  ctx.restore();

  ctx.save();
  roundRectPath(ctx, x0, y0, c.w * k, c.h * k, c.r * k, c.r * k);
  ctx.clip();
  for (const l of layers) drawPhoto(ctx, l.img, l.t, k, x0 + (c.w * k) / 2, y0 + (c.h * k) / 2);
  ctx.restore();

  drawCamera(ctx, model, k, x0, y0);
  roundRectPath(ctx, x0, y0, c.w * k, c.h * k, c.r * k, c.r * k);
  ctx.strokeStyle = "rgba(0,0,0,0.12)";
  ctx.lineWidth = Math.max(1, 0.35 * k);
  ctx.stroke();
  return canvas.toDataURL("image/png");
}

/**
 * Archivo de impresión con una o varias fotos (hoja 15 × 24 cm, 300 ppp).
 * Con una sola foto, la foto cubre toda la plantilla; con varias, fondo blanco.
 */
export async function renderPrintFileLayers(
  layers: Array<{ url: string; t: PhotoTransform }>,
  templateId: TemplateId,
  opts: { cover: boolean; background: string },
): Promise<Blob> {
  if (opts.cover && layers.length === 1) return renderPrintFile(layers[0].url, layers[0].t, templateId);
  const tpl = TEMPLATES[templateId];
  const stage = templateSizeMm(templateId);
  const bitmaps = await Promise.all(layers.map((l) => loadBitmap(l.url)));

  const W = PRINT_SHEET.widthPx;
  const H = PRINT_SHEET.heightPx;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas no disponible");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  const x0 = Math.round((W - tpl.widthPx) / 2);
  const y0 = Math.round((H - tpl.heightPx) / 2);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, tpl.widthPx, tpl.heightPx);
  ctx.clip();
  // Fondo del collage (cubre también los laterales de la plantilla)
  ctx.fillStyle = opts.background || "#ffffff";
  ctx.fillRect(x0, y0, tpl.widthPx, tpl.heightPx);
  layers.forEach((l, i) =>
    drawPhoto(ctx, bitmaps[i], clampFree(l.t, stage), PX_PER_MM, x0 + tpl.widthPx / 2, y0 + tpl.heightPx / 2),
  );
  ctx.restore();
  bitmaps.forEach((b) => b.close());

  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("No se pudo generar el PNG"))), "image/png"),
  );
  const bytes = setPngDpi(new Uint8Array(await blob.arrayBuffer()), 300);
  return new Blob([bytes], { type: "image/png" });
}
