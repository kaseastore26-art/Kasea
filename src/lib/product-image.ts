// ============================================================================
// Fotos de producto. Dos herramientas separadas:
//   - whitenBackground: pone el fondo claro en blanco puro. No mueve ni recorta.
//   - equalizeSize: recorta el espacio vacío y centra la funda en un lienzo 4:5
//     (como las tarjetas de la tienda) con el mismo margen siempre. NO cambia el
//     color del fondo: rellena con el mismo color que ya tenía la foto.
// Si la foto no tiene un fondo liso (p. ej. una foto en la mano), equalizeSize
// devuelve null y la foto se deja tal cual.
// ============================================================================

const OUT_W = 1200;
const OUT_H = 1500; // 4:5
/** Parte del lienzo que ocupa la funda (el resto es margen). */
const FILL = 0.86;

type RGB = [number, number, number];

async function toCanvas(source: Blob) {
  const bitmap = await createImageBitmap(source);
  const w = bitmap.width;
  const h = bitmap.height;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("No se pudo procesar la imagen.");
  // Lo transparente pasa a blanco.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return { canvas, ctx, w, h };
}

function cornerColors(px: Uint8ClampedArray, w: number, h: number): RGB[] {
  // Media de un cuadradito de 5×5 en cada esquina.
  const pick = (cx: number, cy: number): RGB => {
    let r = 0, g = 0, b = 0, n = 0;
    for (let y = cy; y < Math.min(h, cy + 5); y++) {
      for (let x = cx; x < Math.min(w, cx + 5); x++) {
        const i = (y * w + x) * 4;
        r += px[i]; g += px[i + 1]; b += px[i + 2]; n++;
      }
    }
    return [r / n, g / n, b / n];
  };
  return [pick(0, 0), pick(Math.max(0, w - 5), 0), pick(0, Math.max(0, h - 5)), pick(Math.max(0, w - 5), Math.max(0, h - 5))];
}

const dist = (a: RGB, b: RGB) => Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);

function toFile(canvas: HTMLCanvasElement, name: string): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(new File([b], `${name}-${Date.now()}.png`, { type: "image/png" })) : reject(new Error("No se pudo crear la imagen."))),
      "image/png",
      1,
    );
  });
}

/** Solo fondo blanco: no recorta ni cambia el tamaño. */
export async function whitenBackground(source: Blob): Promise<File> {
  const { canvas, ctx, w, h } = await toCanvas(source);
  const img = ctx.getImageData(0, 0, w, h);
  const px = img.data;
  const cs = cornerColors(px, w, h);
  const bg: RGB = [0, 1, 2].map((k) => cs.reduce((s, c) => s + c[k], 0) / 4) as RGB;
  const tolerance = 35;
  for (let i = 0; i < px.length; i += 4) {
    const c: RGB = [px[i], px[i + 1], px[i + 2]];
    if (dist(c, bg) <= tolerance && (c[0] + c[1] + c[2]) / 3 >= 215) {
      px[i] = 255;
      px[i + 1] = 255;
      px[i + 2] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return toFile(canvas, "producto-fondo-blanco");
}

/** Solo tamaño: centra la funda con el mismo margen. Mantiene el color de fondo. */
export async function equalizeSize(source: Blob): Promise<File | null> {
  const { canvas, ctx, w, h } = await toCanvas(source);
  const px = ctx.getImageData(0, 0, w, h).data;

  // El fondo tiene que ser liso: las 4 esquinas del mismo color.
  const cs = cornerColors(px, w, h);
  for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) if (dist(cs[a], cs[b]) > 40) return null;
  const bg: RGB = [0, 1, 2].map((k) => cs.reduce((s, c) => s + c[k], 0) / 4) as RGB;

  // Caja de la funda: lo que se aleja del color de fondo (ignora motas sueltas).
  const tol = 30;
  const rowCount = new Uint32Array(h);
  const colCount = new Uint32Array(w);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (dist([px[i], px[i + 1], px[i + 2]], bg) > tol) {
        rowCount[y]++;
        colCount[x]++;
      }
    }
  }
  const minRow = Math.max(2, Math.round(w * 0.004));
  const minCol = Math.max(2, Math.round(h * 0.004));
  let top = 0, bottom = h - 1, left = 0, right = w - 1;
  while (top < h && rowCount[top] < minRow) top++;
  while (bottom > top && rowCount[bottom] < minRow) bottom--;
  while (left < w && colCount[left] < minCol) left++;
  while (right > left && colCount[right] < minCol) right--;
  if (top >= bottom || left >= right) return null;

  const bw = right - left + 1;
  const bh = bottom - top + 1;

  const out = document.createElement("canvas");
  out.width = OUT_W;
  out.height = OUT_H;
  const octx = out.getContext("2d");
  if (!octx) throw new Error("No se pudo procesar la imagen.");
  octx.fillStyle = `rgb(${Math.round(bg[0])}, ${Math.round(bg[1])}, ${Math.round(bg[2])})`;
  octx.fillRect(0, 0, OUT_W, OUT_H);
  octx.imageSmoothingQuality = "high";
  const scale = Math.min((OUT_W * FILL) / bw, (OUT_H * FILL) / bh);
  const dw = Math.round(bw * scale);
  const dh = Math.round(bh * scale);
  octx.drawImage(canvas, left, top, bw, bh, Math.round((OUT_W - dw) / 2), Math.round((OUT_H - dh) / 2), dw, dh);
  return toFile(out, "producto-igualado");
}
