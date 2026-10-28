// ============================================================================
// Geometría de las fundas personalizadas (sublimación 3D).
//
// Todo se mide en MILÍMETROS reales. La foto se describe con una transformación
// relativa al CENTRO de la plantilla (que coincide con el centro de la parte
// trasera de la funda). Así el mismo diseño se puede pintar:
//   - en el editor (a cualquier tamaño de pantalla),
//   - en la vista previa del carrito,
//   - y en el archivo de impresión a 300 ppp con la plantilla real.
// ============================================================================

/** Píxeles por milímetro a 300 ppp (las plantillas de Photoshop son de 300 ppp). */
export const PX_PER_MM = 300 / 25.4;

export type TemplateId = "pequena" | "grande";

export interface PrintTemplate {
  id: TemplateId;
  label: string;
  /** Tamaño total del lienzo en píxeles (300 ppp, RGB), igual que el .psd. */
  widthPx: number;
  heightPx: number;
  /** Rectángulo de la parte trasera (entre las guías del .psd). */
  back: { x: number; y: number; w: number; h: number };
}

// Medidas sacadas de las plantillas de Photoshop de Kasea.
export const TEMPLATES: Record<TemplateId, PrintTemplate> = {
  pequena: {
    id: "pequena",
    label: "Plantilla pequeña",
    widthPx: 1240,
    heightPx: 2126,
    back: { x: 177, y: 177, w: 886, h: 1772 },
  },
  grande: {
    id: "grande",
    label: "Plantilla grande",
    widthPx: 1393,
    heightPx: 2303,
    back: { x: 177, y: 177, w: 1039, h: 1949 },
  },
};

/** Hoja de papel de sublimación: 150 × 240 mm a 300 ppp. */
export const PRINT_SHEET = {
  widthMm: 150,
  heightMm: 240,
  widthPx: Math.round(150 * (300 / 25.4)), // 1772
  heightPx: Math.round(240 * (300 / 25.4)), // 2835
};

/** Pro Max, Plus y Air usan la plantilla grande; el resto, la pequeña. */
export function templateForModel(model: string): TemplateId {
  return /pro max|plus|air/i.test(model) ? "grande" : "pequena";
}

/** Tamaño total de la plantilla en mm (incluye los laterales). */
export function templateSizeMm(id: TemplateId): { w: number; h: number } {
  const t = TEMPLATES[id];
  return { w: t.widthPx / PX_PER_MM, h: t.heightPx / PX_PER_MM };
}

// ---------------------------------------------------------------------------
// Modelos (medidas reales aproximadas y módulo de cámara)
// ---------------------------------------------------------------------------
export type ModelSpec = {
  ratio: string; // "ancho / alto" en mm
  radius: number; // radio de las esquinas, % del ancho
  cam: "square" | "vertical" | "wide";
  camW: number; // ancho del módulo de cámara, % del ancho de la funda
  camRatio: string; // proporción ancho / alto del módulo
  camLeft?: number; // % del ancho
  camTop?: number; // % del alto
  /** Bulto redondo a la derecha del módulo (flash), p. ej. iPhone 16 / 16 Plus. % del ancho/alto de la funda. */
  lobe?: { right: number; cy: number; h: number };
};

export const MODEL_SPECS: Record<string, ModelSpec> = {
  // 17/18 Pro Max y Pro: medidos en las fundas reales de Kasea
  // Pro Max: funda 8,2 × 16,6 cm; hueco 7,5 cm de ancho, de 0,4 a 4,4 cm desde arriba.
  // Pro: funda ~7,7 × 15,4 cm; hueco 6,5 cm de ancho, de 0,45 a 4,45 cm desde arriba.
  "iPhone 18 Pro Max": { ratio: "77.6 / 163.4", radius: 13, cam: "wide", camW: 91.5, camRatio: "1.8 / 1", camTop: 2.4 },
  "iPhone 18 Pro": { ratio: "71.9 / 150", radius: 13, cam: "wide", camW: 84.5, camRatio: "1.56 / 1", camTop: 2.9 },
  "iPhone 17 Pro Max": { ratio: "77.6 / 163.4", radius: 13, cam: "wide", camW: 91.5, camRatio: "1.8 / 1", camTop: 2.4 },
  "iPhone 17 Pro": { ratio: "71.9 / 150", radius: 13, cam: "wide", camW: 84.5, camRatio: "1.56 / 1", camTop: 2.9 },
  "iPhone 17 Air": { ratio: "74.7 / 156.2", radius: 13, cam: "wide", camW: 88, camRatio: "2.55 / 1", camTop: 3 },
  "iPhone 17": { ratio: "71.9 / 149.6", radius: 13, cam: "vertical", camW: 28, camRatio: "0.55 / 1", camLeft: 5, camTop: 3.2 },
  "iPhone 16 Pro Max": { ratio: "77.6 / 163", radius: 12.5, cam: "square", camW: 49, camRatio: "1 / 1" },
  "iPhone 16 Pro": { ratio: "71.5 / 149.6", radius: 12.5, cam: "square", camW: 51, camRatio: "1 / 1" },
  // 16 Plus: medido en funda real (pastilla 1,4 cm × de 0,4 a 4,7 cm; bulto del flash hasta 3,5 cm).
  "iPhone 16 Plus": {
    ratio: "77.8 / 160.9",
    radius: 12.5,
    cam: "vertical",
    camW: 17.2,
    camRatio: "0.318 / 1",
    camLeft: 4.3,
    camTop: 2.4,
    lobe: { right: 43, cy: 15.2, h: 7.9 },
  },
  // 16: medido en funda real (pastilla 1,4 cm × de 0,3 a 3,9 cm; bulto del flash hasta 3,5 cm).
  "iPhone 16": {
    ratio: "71.6 / 147.6",
    radius: 12.5,
    cam: "vertical",
    camW: 18.7,
    camRatio: "0.38 / 1",
    camLeft: 3.3,
    camTop: 2,
    lobe: { right: 46.7, cy: 13.2, h: 7.3 },
  },
  "iPhone 15 Pro Max": { ratio: "76.7 / 159.9", radius: 12.5, cam: "square", camW: 50, camRatio: "1 / 1" },
  "iPhone 15 Pro": { ratio: "70.6 / 146.6", radius: 12.5, cam: "square", camW: 52, camRatio: "1 / 1" },
  "iPhone 15 Plus": { ratio: "77.8 / 160.9", radius: 12.5, cam: "square", camW: 38, camRatio: "1 / 1" },
  "iPhone 15": { ratio: "71.6 / 147.6", radius: 12.5, cam: "square", camW: 40, camRatio: "1 / 1" },
  // 14 Pro Max: medido en funda real (8,1 × 16,4 cm; hueco 4,2 × 4,1 cm, a 0,3 cm de arriba y 0,4 cm de la izquierda).
  "iPhone 14 Pro Max": { ratio: "77.6 / 160.7", radius: 12, cam: "square", camW: 52, camRatio: "1 / 1", camTop: 1.8, camLeft: 4.9 },
  // 13, 13 Pro, 14 y 14 Pro comparten funda: hueco 4,1 × 3,9 cm, a 0,25 cm de arriba y 0,3 cm de la izquierda.
  "iPhone 14 Pro": { ratio: "71.5 / 147.5", radius: 12, cam: "square", camW: 54.7, camRatio: "1.03 / 1", camTop: 1.7, camLeft: 3.7 },
  "iPhone 14 Plus": { ratio: "78.1 / 160.8", radius: 12, cam: "square", camW: 37, camRatio: "1 / 1" },
  "iPhone 14": { ratio: "71.5 / 146.7", radius: 12, cam: "square", camW: 54.7, camRatio: "1.03 / 1", camTop: 1.7, camLeft: 3.7 },
  "iPhone 13 Pro Max": { ratio: "78.1 / 160.8", radius: 11.5, cam: "square", camW: 47, camRatio: "1 / 1" },
  "iPhone 13 Pro": { ratio: "71.5 / 146.7", radius: 11.5, cam: "square", camW: 54.7, camRatio: "1.03 / 1", camTop: 1.7, camLeft: 3.7 },
  "iPhone 13": { ratio: "71.5 / 146.7", radius: 11.5, cam: "square", camW: 54.7, camRatio: "1.03 / 1", camTop: 1.7, camLeft: 3.7 },
  // 12 mini y 13 mini comparten funda: hueco 3,3 × 3,15 cm, a 0,27 cm de arriba y 0,2 cm de la izquierda.
  "iPhone 13 mini": { ratio: "64.2 / 131.5", radius: 11.5, cam: "square", camW: 48.5, camRatio: "1.02 / 1", camTop: 2, camLeft: 2.9 },
  "iPhone 12 Pro Max": { ratio: "78.1 / 160.8", radius: 11, cam: "square", camW: 43, camRatio: "1 / 1" },
  "iPhone 12 Pro": { ratio: "71.5 / 146.7", radius: 11, cam: "square", camW: 43, camRatio: "1 / 1" },
  "iPhone 12": { ratio: "71.5 / 146.7", radius: 11, cam: "square", camW: 36, camRatio: "1 / 1" },
  "iPhone 12 mini": { ratio: "64.2 / 131.5", radius: 11, cam: "square", camW: 48.5, camRatio: "1.02 / 1", camTop: 2, camLeft: 2.9 },
  // 11 Pro Max: medido en funda real (8 × 16,2 cm; hueco 3,5 × 3,55 cm, a 0,2 cm de arriba y 0,25 cm de la izquierda).
  "iPhone 11 Pro Max": { ratio: "77.8 / 158", radius: 12, cam: "square", camW: 43.8, camRatio: "0.99 / 1", camTop: 1.2, camLeft: 3.1 },
};

export const MODELS = Object.keys(MODEL_SPECS);

function parseRatio(r: string): [number, number] {
  const [a, b] = r.split("/").map((n) => Number(n.trim()));
  return [a || 1, b || 1];
}

export function specFor(model: string): ModelSpec {
  return MODEL_SPECS[model] ?? MODEL_SPECS["iPhone 17 Pro"];
}

/** Medidas de la parte trasera de la funda en mm. */
export function caseSizeMm(spec: ModelSpec): { w: number; h: number; r: number } {
  const [w, h] = parseRatio(spec.ratio);
  return { w, h, r: (spec.radius / 100) * w };
}

// ---------------------------------------------------------------------------
// Transformación de la foto
// ---------------------------------------------------------------------------
export type Rotation = 0 | 90 | 180 | 270;

/** Posición de la foto en mm respecto al centro de la plantilla. */
export interface PhotoTransform {
  cx: number;
  cy: number;
  /** Ancho de la foto (sin girar) en mm. */
  w: number;
  rot: Rotation;
}

/** Hasta cuántas veces se puede ampliar sobre el tamaño mínimo. */
export const MAX_ZOOM = 5;

/** Ancho mínimo para que la foto cubra TODA la plantilla (frontal + laterales). */
export function minPhotoWidth(
  imgW: number,
  imgH: number,
  rot: Rotation,
  stage: { w: number; h: number },
): number {
  const ar = imgH / imgW;
  if (rot % 180 === 0) return Math.max(stage.w, stage.h / ar);
  return Math.max(stage.w / ar, stage.h);
}

/** Corrige zoom y posición para que nunca queden huecos en blanco. */
export function clampTransform(
  t: PhotoTransform,
  imgW: number,
  imgH: number,
  stage: { w: number; h: number },
): PhotoTransform {
  const min = minPhotoWidth(imgW, imgH, t.rot, stage);
  const w = Math.min(Math.max(t.w, min), min * MAX_ZOOM);
  const ar = imgH / imgW;
  const effW = t.rot % 180 === 0 ? w : w * ar;
  const effH = t.rot % 180 === 0 ? w * ar : w;
  const mx = Math.max(0, (effW - stage.w) / 2);
  const my = Math.max(0, (effH - stage.h) / 2);
  return {
    w,
    rot: t.rot,
    cx: Math.min(mx, Math.max(-mx, t.cx)),
    cy: Math.min(my, Math.max(-my, t.cy)),
  };
}

export function fitTransform(imgW: number, imgH: number, stage: { w: number; h: number }): PhotoTransform {
  return { cx: 0, cy: 0, w: minPhotoWidth(imgW, imgH, 0, stage), rot: 0 };
}

/** Amplía o reduce manteniendo fijo el punto `p` (mm desde el centro). */
export function zoomAround(
  t: PhotoTransform,
  factor: number,
  p: { x: number; y: number },
  imgW: number,
  imgH: number,
  stage: { w: number; h: number },
): PhotoTransform {
  const min = minPhotoWidth(imgW, imgH, t.rot, stage);
  const w2 = Math.min(Math.max(t.w * factor, min), min * MAX_ZOOM);
  const f = w2 / t.w;
  return clampTransform(
    { ...t, w: w2, cx: p.x + (t.cx - p.x) * f, cy: p.y + (t.cy - p.y) * f },
    imgW,
    imgH,
    stage,
  );
}

/** Resolución real a la que se imprimiría la foto. */
export function effectiveDpi(imgW: number, wMm: number): number {
  return imgW / (wMm / 25.4);
}

/** Por debajo de esto se avisa al cliente de que puede salir borrosa. */
export const LOW_DPI = 150;

// ---------------------------------------------------------------------------
// Cámara (dibujada por código, en mm desde la esquina sup. izq. de la funda)
// ---------------------------------------------------------------------------
export interface CameraCircle {
  cx: number;
  cy: number;
  r: number;
  kind: "lens" | "flash" | "sensor";
}
export interface CameraShape {
  x: number;
  y: number;
  w: number;
  h: number;
  rx: number;
  ry: number;
  circles: CameraCircle[];
  /** Piezas extra del hueco (mismo color), p. ej. el bulto del flash. */
  extras?: Array<{ x: number; y: number; w: number; h: number; r: number }>;
}

export function cameraShape(model: string, spec: ModelSpec): CameraShape {
  const c = caseSizeMm(spec);
  const [ra, rb] = parseRatio(spec.camRatio);
  const w = (spec.camW / 100) * c.w;
  const h = w / (ra / rb);
  const y = ((spec.camTop ?? 3.2) / 100) * c.h;
  const x = spec.cam === "wide" ? (c.w - w) / 2 : ((spec.camLeft ?? 5) / 100) * c.w;
  const isPro = /pro/i.test(model);

  let rx: number;
  let ry: number;
  const pts: Array<[number, number, number, CameraCircle["kind"]]> = []; // fx, fy, diámetro (fracción), tipo

  if (spec.cam === "wide") {
    rx = Math.min(0.16 * w, 0.38 * h);
    ry = Math.min(0.38 * h, 0.16 * w);
    if (/air/i.test(model)) {
      pts.push([0.14, 0.5, 0.52, "lens"], [0.3, 0.5, 0.14, "flash"]);
    } else {
      // Lentes con tamaño fijo en mm (no crecen si el hueco es más alto)
      const d = Math.min(0.4 * h, 0.17 * w, 14);
      const pad = 0.05 * w;
      const lx1 = x + pad + d / 2;
      const lx2 = lx1 + d * 0.95;
      const midY = y + h * 0.42;
      const circles: CameraCircle[] = [
        { cx: lx1, cy: midY - d * 0.55, r: d / 2, kind: "lens" },
        { cx: lx1, cy: midY + d * 0.55, r: d / 2, kind: "lens" },
        { cx: lx2, cy: midY, r: d / 2, kind: "lens" },
        { cx: x + w - pad - d * 0.2, cy: midY - d * 0.45, r: d * 0.17, kind: "flash" },
        { cx: x + w - pad - d * 0.2, cy: midY + d * 0.45, r: d * 0.14, kind: "sensor" },
      ];
      return { x, y, w, h, rx, ry, circles };
    }
    // en "wide" el diámetro va en fracción del ALTO del módulo
    return {
      x, y, w, h, rx, ry,
      circles: pts.map(([fx, fy, d, kind]) => ({ cx: x + fx * w, cy: y + fy * h, r: (d * h) / 2, kind })),
    };
  }

  if (spec.cam === "vertical") {
    rx = Math.min(0.5 * w, 0.24 * h);
    ry = rx;
    if (spec.lobe) {
      const lh = (spec.lobe.h / 100) * c.h;
      const lcy = (spec.lobe.cy / 100) * c.h;
      const lright = (spec.lobe.right / 100) * c.w;
      const lx = x + w / 2;
      const d = Math.min(0.85 * w, 0.4 * h);
      return {
        x, y, w, h, rx, ry,
        extras: [{ x: lx, y: lcy - lh / 2, w: lright - lx, h: lh, r: lh / 2 }],
        circles: [
          { cx: x + w / 2, cy: y + d / 2 + w * 0.08, r: d / 2, kind: "lens" },
          { cx: x + w / 2, cy: y + h - d / 2 - w * 0.08, r: d / 2, kind: "lens" },
          { cx: lright - lh / 2, cy: lcy, r: lh * 0.22, kind: "flash" },
        ],
      };
    }
    pts.push([0.5, 0.27, 0.78, "lens"], [0.5, 0.73, 0.78, "lens"]);
  } else {
    rx = 0.24 * w;
    ry = 0.24 * h;
    if (isPro) {
      pts.push(
        [0.27, 0.27, 0.42, "lens"],
        [0.27, 0.73, 0.42, "lens"],
        [0.74, 0.5, 0.42, "lens"],
        [0.74, 0.17, 0.12, "flash"],
        [0.74, 0.83, 0.12, "sensor"],
      );
    } else {
      pts.push([0.29, 0.29, 0.38, "lens"], [0.71, 0.71, 0.38, "lens"], [0.75, 0.26, 0.13, "flash"]);
    }
  }
  // en el resto el diámetro va en fracción del ANCHO del módulo
  return {
    x, y, w, h, rx, ry,
    circles: pts.map(([fx, fy, d, kind]) => ({ cx: x + fx * w, cy: y + fy * h, r: (d * w) / 2, kind })),
  };
}

/** Datos del diseño que se guardan con el pedido (params de custom_designs). */
export interface DesignParamsV2 {
  v: 2;
  template: TemplateId;
  cx: number;
  cy: number;
  w: number;
  rot: Rotation;
  imgW: number;
  imgH: number;
  dpi: number;
  lowQualityAccepted: boolean;
  /** El cliente confirmó que se fabrica tal cual lo dejó (sin cambios ni devoluciones). */
  layoutConfirmedAt: string;
}

export function isDesignV2(p: unknown): p is DesignParamsV2 {
  return !!p && typeof p === "object" && (p as { v?: unknown }).v === 2;
}

// ---------------------------------------------------------------------------
// Varias fotos (fondo blanco, colocación libre)
// ---------------------------------------------------------------------------
export const MAX_PHOTOS = 6;
/** Ancho mínimo de una foto en modo libre (mm). */
export const MIN_FREE_WIDTH = 12;

/** Ancho (sin girar) para que la foto quepa dentro de una caja boxW × boxH. */
export function fitWidthInBox(
  imgW: number,
  imgH: number,
  rot: Rotation,
  boxW: number,
  boxH: number,
): number {
  const ar = imgH / imgW;
  return rot % 180 === 0 ? Math.min(boxW, boxH / ar) : Math.min(boxW / ar, boxH);
}

/** Tamaño real que ocupa la foto en pantalla (ya girada). */
export function effectiveBox(t: PhotoTransform, imgW: number, imgH: number): { w: number; h: number } {
  const ar = imgH / imgW;
  return t.rot % 180 === 0 ? { w: t.w, h: t.w * ar } : { w: t.w * ar, h: t.w };
}

/** En modo libre: tamaño entre un mínimo y un máximo y centro dentro de la plantilla. */
export function clampFree(t: PhotoTransform, stage: { w: number; h: number }): PhotoTransform {
  const maxW = Math.max(stage.w, stage.h) * 2;
  return {
    rot: t.rot,
    w: Math.min(Math.max(t.w, MIN_FREE_WIDTH), maxW),
    cx: Math.min(stage.w / 2, Math.max(-stage.w / 2, t.cx)),
    cy: Math.min(stage.h / 2, Math.max(-stage.h / 2, t.cy)),
  };
}

export function zoomFreeAround(
  t: PhotoTransform,
  factor: number,
  p: { x: number; y: number },
  stage: { w: number; h: number },
): PhotoTransform {
  const maxW = Math.max(stage.w, stage.h) * 2;
  const w2 = Math.min(Math.max(t.w * factor, MIN_FREE_WIDTH), maxW);
  const f = w2 / t.w;
  return clampFree({ ...t, w: w2, cx: p.x + (t.cx - p.x) * f, cy: p.y + (t.cy - p.y) * f }, stage);
}

export interface DesignLayerV3 {
  url: string;
  cx: number;
  cy: number;
  w: number;
  rot: Rotation;
  imgW: number;
  imgH: number;
  dpi: number;
}

/** Diseño con una o varias fotos. Con 1 foto cubre toda la plantilla; con más, fondo blanco. */
export interface DesignParamsV3 {
  v: 3;
  template: TemplateId;
  /** "single": una foto que cubre todo; "collage": fotos libres sobre un fondo de color. */
  mode: "single" | "collage";
  background: string;
  layers: DesignLayerV3[];
  dpi: number; // la peor resolución de todas las fotos
  lowQualityAccepted: boolean;
  layoutConfirmedAt: string;
}

export function isDesignV3(p: unknown): p is DesignParamsV3 {
  return !!p && typeof p === "object" && (p as { v?: unknown }).v === 3;
}
