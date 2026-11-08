// ============================================================================
// Fotos de producto: fondo blanco + mismo tamaño para todas.
//   1. Pone el fondo claro en blanco puro (también el transparente).
//   2. Recorta el espacio vacío alrededor de la funda.
//   3. La centra en un lienzo 4:5 (como las tarjetas de la tienda), siempre con
//      el mismo margen, para que todas las fundas se vean del mismo tamaño.
// Si la foto no tiene fondo claro (p. ej. una foto en la mano), devuelve null y
// se deja la foto tal cual.
// ============================================================================

const OUT_W = 1200;
const OUT_H = 1500; // 4:5
/** Parte del lienzo que ocupa la funda (el resto es margen blanco). */
const FILL = 0.86;

async function loadBitmap(source: Blob): Promise<ImageBitmap> {
  return await createImageBitmap(source);
}

export async function prepareProductImage(source: Blob): Promise<File | null> {
  const bitmap = await loadBitmap(source);
  const w = bitmap.width;
  const h = bitmap.height;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("No se pudo procesar la imagen.");

  // Fondo blanco debajo: lo transparente pasa a ser blanco.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  const img = ctx.getImageData(0, 0, w, h);
  const px = img.data;

  // Color del fondo: media de las 4 esquinas.
  const corners = [
    [0, 0],
    [w - 1, 0],
    [0, h - 1],
    [w - 1, h - 1],
  ];
  let bgR = 0, bgG = 0, bgB = 0;
  for (const [x, y] of corners) {
    const i = (y * w + x) * 4;
    bgR += px[i];
    bgG += px[i + 1];
    bgB += px[i + 2];
  }
  bgR /= 4;
  bgG /= 4;
  bgB /= 4;

  // Foto sin fondo claro: no la tocamos.
  if ((bgR + bgG + bgB) / 3 < 200) return null;

  // 1) Fondo a blanco puro.
  const tolerance = 35;
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i], g = px[i + 1], b = px[i + 2];
    const dist = Math.sqrt((r - bgR) ** 2 + (g - bgG) ** 2 + (b - bgB) ** 2);
    if (dist <= tolerance && (r + g + b) / 3 >= 215) {
      px[i] = 255;
      px[i + 1] = 255;
      px[i + 2] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  // 2) Caja de la funda (ignora motas sueltas).
  const rowCount = new Uint32Array(h);
  const colCount = new Uint32Array(w);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (Math.min(px[i], px[i + 1], px[i + 2]) < 245) {
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
  if (top >= bottom || left >= right) return null; // imagen vacía

  const bw = right - left + 1;
  const bh = bottom - top + 1;

  // 3) Centrar en el lienzo 4:5 con el mismo margen siempre.
  const out = document.createElement("canvas");
  out.width = OUT_W;
  out.height = OUT_H;
  const octx = out.getContext("2d");
  if (!octx) throw new Error("No se pudo procesar la imagen.");
  octx.fillStyle = "#ffffff";
  octx.fillRect(0, 0, OUT_W, OUT_H);
  octx.imageSmoothingQuality = "high";
  const scale = Math.min((OUT_W * FILL) / bw, (OUT_H * FILL) / bh);
  const dw = Math.round(bw * scale);
  const dh = Math.round(bh * scale);
  octx.drawImage(canvas, left, top, bw, bh, Math.round((OUT_W - dw) / 2), Math.round((OUT_H - dh) / 2), dw, dh);

  const blob = await new Promise<Blob>((resolve, reject) => {
    out.toBlob((b) => (b ? resolve(b) : reject(new Error("No se pudo crear la imagen."))), "image/png", 1);
  });
  return new File([blob], `producto-${Date.now()}.png`, { type: "image/png" });
}
