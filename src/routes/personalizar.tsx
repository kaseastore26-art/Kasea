import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useId, useRef, useState } from "react";
import {
  ArrowRight,
  ImagePlus,
  Loader2,
  RotateCcw,
  RotateCw,
  ShoppingBag,
  Trash2,
  Undo2,
  Upload,
  AlertTriangle,
  ZoomIn,
} from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { originalToJpeg, renderCasePreview } from "@/lib/design-render";
import { uploadCustomDesign, saveCustomDesign } from "@/lib/custom-design.functions";
import { useCartStore } from "@/lib/cart";
import { getProductByHandlePublic } from "@/lib/catalog.functions";
import { formatPrice } from "@/lib/shopify";
import { seo } from "@/lib/seo";
import {
  LOW_DPI,
  MAX_ZOOM,
  MODELS,
  cameraShape,
  caseSizeMm,
  clampTransform,
  effectiveDpi,
  fitTransform,
  minPhotoWidth,
  specFor,
  templateForModel,
  templateSizeMm,
  zoomAround,
  type DesignParamsV2,
  type PhotoTransform,
  type Rotation,
} from "@/lib/case-design";

// Producto del catálogo usado para las fundas personalizadas
const CUSTOM_PRODUCT_HANDLE = "funda-personalizada";

type LoadedImage = { url: string; w: number; h: number };

export const Route = createFileRoute("/personalizar")({
  head: () =>
    seo({
      title: "Personaliza tu funda — Kasea Store",
      description:
        "Diseña tu funda de iPhone con tu foto: elige tu modelo, sube tu imagen y colócala como más te guste.",
      path: "/personalizar",
    }),
  component: PersonalizarPage,
});

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No se pudo cargar la imagen"));
    img.src = src;
  });
}

// ---------------------------------------------------------------------------
// Capa SVG: zona lateral, contorno de la funda y cámara
// ---------------------------------------------------------------------------
function CaseOverlay({ model, hasImage }: { model: string; hasImage: boolean }) {
  const rawId = useId();
  const maskId = `case-mask-${rawId.replace(/[^a-zA-Z0-9]/g, "")}`;
  const stage = templateSizeMm(templateForModel(model));
  const spec = specFor(model);
  const c = caseSizeMm(spec);
  const x0 = (stage.w - c.w) / 2;
  const y0 = (stage.h - c.h) / 2;
  const cam = cameraShape(model, spec);

  return (
    <svg
      viewBox={`0 0 ${stage.w} ${stage.h}`}
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden
    >
      <defs>
        <mask id={maskId}>
          <rect x="0" y="0" width={stage.w} height={stage.h} fill="white" />
          <rect x={x0} y={y0} width={c.w} height={c.h} rx={c.r} ry={c.r} fill="black" />
        </mask>
        <linearGradient id={`${maskId}-cam`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2a2a2d" />
          <stop offset="100%" stopColor="#141416" />
        </linearGradient>
        <linearGradient id={`${maskId}-shine`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="white" stopOpacity="0.22" />
          <stop offset="45%" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Zona de los laterales: velo claro sobre la foto */}
      <rect
        x="0"
        y="0"
        width={stage.w}
        height={stage.h}
        fill={hasImage ? "rgba(250,247,241,0.66)" : "transparent"}
        mask={`url(#${maskId})`}
      />
      <rect
        x="0.25"
        y="0.25"
        width={stage.w - 0.5}
        height={stage.h - 0.5}
        rx="2"
        fill="none"
        stroke="rgba(43,36,32,0.35)"
        strokeWidth="0.35"
        strokeDasharray="1.6 1.2"
      />

      {/* Funda */}
      <g transform={`translate(${x0} ${y0})`}>
        {!hasImage && <rect x="0" y="0" width={c.w} height={c.h} rx={c.r} ry={c.r} fill="#ffffff" />}
        <rect x="0" y="0" width={c.w} height={c.h} rx={c.r} ry={c.r} fill={`url(#${maskId}-shine)`} />
        <rect
          x="0"
          y="0"
          width={c.w}
          height={c.h}
          rx={c.r}
          ry={c.r}
          fill="none"
          stroke="rgba(0,0,0,0.18)"
          strokeWidth="0.45"
        />

        {/* Cámara */}
        <rect
          x={cam.x}
          y={cam.y}
          width={cam.w}
          height={cam.h}
          rx={cam.rx}
          ry={cam.ry}
          fill={`url(#${maskId}-cam)`}
          style={{ filter: "drop-shadow(0 0.4px 0.8px rgba(0,0,0,0.35))" }}
        />
        {cam.circles.map((p, i) =>
          p.kind === "lens" ? (
            <g key={i}>
              <circle cx={p.cx} cy={p.cy} r={p.r} fill="#3a3a3d" />
              <circle cx={p.cx} cy={p.cy} r={p.r * 0.72} fill="#08080c" />
              <circle cx={p.cx} cy={p.cy} r={p.r * 0.32} fill="#1b2440" />
              <circle cx={p.cx - p.r * 0.25} cy={p.cy - p.r * 0.25} r={p.r * 0.12} fill="rgba(255,255,255,0.35)" />
            </g>
          ) : (
            <circle key={i} cx={p.cx} cy={p.cy} r={p.r} fill={p.kind === "flash" ? "#efe9d8" : "#2b2b2e"} />
          ),
        )}
      </g>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------
function PersonalizarPage() {
  const [model, setModel] = useState(MODELS[3]);
  const templateId = templateForModel(model);
  const stage = templateSizeMm(templateId);
  const caseMm = caseSizeMm(specFor(model));

  const [image, setImage] = useState<LoadedImage | null>(null);
  const [t, setT] = useState<PhotoTransform | null>(null);
  const [history, setHistory] = useState<PhotoTransform[]>([]);
  const [showHint, setShowHint] = useState(false);
  const [acceptLow, setAcceptLow] = useState(false);
  const [confirmLayout, setConfirmLayout] = useState(false);
  const [coarse, setCoarse] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; mid: { x: number; y: number } } | null>(null);
  const lastWheel = useRef(0);

  // Estado más reciente para los manejadores (rueda del ratón, etc.)
  const live = useRef({ image, t, stage });
  live.current = { image, t, stage };

  useEffect(() => {
    try {
      setCoarse(window.matchMedia("(pointer: coarse)").matches);
    } catch {
      /* sin matchMedia */
    }
  }, []);

  // Al cambiar de modelo (puede cambiar la plantilla) se reajusta la foto.
  useEffect(() => {
    if (image && t) setT(clampTransform(t, image.w, image.h, stage));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model]);

  // Liberar la URL temporal de la foto
  useEffect(() => {
    return () => {
      if (image) URL.revokeObjectURL(image.url);
    };
  }, [image]);

  function pushHistory() {
    const cur = live.current.t;
    if (cur) setHistory((h) => [...h.slice(-30), cur]);
  }

  function undo() {
    if (!image || history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory(history.slice(0, -1));
    setT(clampTransform(prev, image.w, image.h, stage));
  }

  function toMm(clientX: number, clientY: number) {
    const r = stageRef.current!.getBoundingClientRect();
    const k = r.width / stage.w;
    return { x: (clientX - r.left - r.width / 2) / k, y: (clientY - r.top - r.height / 2) / k, k };
  }

  // ---- Arrastrar / pellizcar ----
  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!image || !t) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    if (pointers.current.size === 0) pushHistory();
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    setShowHint(false);
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = {
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      };
    }
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const prev = pointers.current.get(e.pointerId);
    if (!prev || !image) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 1) {
      const { k } = toMm(e.clientX, e.clientY);
      const dx = (e.clientX - prev.x) / k;
      const dy = (e.clientY - prev.y) / k;
      setT((cur) =>
        cur ? clampTransform({ ...cur, cx: cur.cx + dx, cy: cur.cy + dy }, image.w, image.h, stage) : cur,
      );
    } else if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const factor = dist / Math.max(1, pinch.current.dist);
      const p = toMm(mid.x, mid.y);
      const pdx = (mid.x - pinch.current.mid.x) / p.k;
      const pdy = (mid.y - pinch.current.mid.y) / p.k;
      setT((cur) => {
        if (!cur) return cur;
        const moved = { ...cur, cx: cur.cx + pdx, cy: cur.cy + pdy };
        return zoomAround(moved, factor, p, image.w, image.h, stage);
      });
      pinch.current = { dist, mid };
    }
  }

  function onPointerEnd(e: React.PointerEvent<HTMLDivElement>) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  }

  // ---- Rueda del ratón (ordenador) ----
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const { image: img, t: cur, stage: st } = live.current;
      if (!img || !cur) return;
      e.preventDefault();
      const now = Date.now();
      if (now - lastWheel.current > 400) pushHistory();
      lastWheel.current = now;
      setShowHint(false);
      const r = el.getBoundingClientRect();
      const k = r.width / st.w;
      const p = { x: (e.clientX - r.left - r.width / 2) / k, y: (e.clientY - r.top - r.height / 2) / k };
      const factor = Math.exp(-e.deltaY * 0.0015);
      setT((c) => (c ? zoomAround(c, factor, p, img.w, img.h, st) : c));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Subir foto ----
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Ese archivo no es una imagen.");
      return;
    }
    if (file.size > 40 * 1024 * 1024) {
      toast.error("La imagen es demasiado grande (máximo 40 MB).");
      return;
    }
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImage(url);
      const loaded = { url, w: img.naturalWidth, h: img.naturalHeight };
      setImage(loaded);
      setT(fitTransform(loaded.w, loaded.h, stage));
      setHistory([]);
      setAcceptLow(false);
      setConfirmLayout(false);
      setShowHint(true);
    } catch {
      URL.revokeObjectURL(url);
      toast.error("No hemos podido abrir esta imagen", {
        description: "Prueba con una foto en formato JPG o PNG.",
      });
    }
  }

  function removeImage() {
    setImage(null);
    setT(null);
    setHistory([]);
    setConfirmLayout(false);
    setAcceptLow(false);
  }

  function rotate(dir: 1 | -1) {
    if (!image || !t) return;
    pushHistory();
    const rot = (((t.rot + dir * 90) % 360) + 360) % 360 as Rotation;
    setT(clampTransform({ ...t, rot }, image.w, image.h, stage));
    setConfirmLayout(false);
  }

  function reset() {
    if (!image) return;
    pushHistory();
    setT(fitTransform(image.w, image.h, stage));
  }

  // Cualquier cambio en el diseño obliga a volver a confirmar
  useEffect(() => {
    setConfirmLayout(false);
  }, [t]);

  const minW = image && t ? minPhotoWidth(image.w, image.h, t.rot, stage) : 1;
  const zoomLevel = t ? t.w / minW : 1;
  const dpi = image && t ? effectiveDpi(image.w, t.w) : 999;
  const lowQuality = !!image && dpi < LOW_DPI;

  // ---- Añadir a la bolsa ----
  const addItem = useCartStore((s) => s.addItem);
  const upload = useServerFn(uploadCustomDesign);
  const saveDesign = useServerFn(saveCustomDesign);
  const fetchCustom = useServerFn(getProductByHandlePublic);
  const [adding, setAdding] = useState(false);

  // Precio de la funda personalizada (se muestra desde el principio)
  const { data: customProduct } = useQuery({
    queryKey: ["custom-product", CUSTOM_PRODUCT_HANDLE],
    queryFn: () => fetchCustom({ data: { handle: CUSTOM_PRODUCT_HANDLE } }),
    staleTime: 5 * 60_000,
  });
  const priceInfo = customProduct?.node?.variants?.edges?.[0]?.node?.price;
  const priceText = priceInfo ? formatPrice(priceInfo.amount, priceInfo.currencyCode) : null;

  async function addDesignToCart() {
    if (!image || !t) {
      toast.error("Sube una foto antes de continuar.");
      return;
    }
    if (lowQuality && !acceptLow) {
      toast.error("Marca la casilla sobre la calidad de la foto para continuar.");
      return;
    }
    if (!confirmLayout) {
      toast.error("Revisa tu diseño y marca la casilla de confirmación para continuar.");
      return;
    }
    setAdding(true);
    try {
      const img = await loadImage(image.url);
      const original = originalToJpeg(img);
      const previewDataUrl = renderCasePreview(img, t, model);

      const [{ url: originalUrl }, { url: previewUrl }] = await Promise.all([
        upload({ data: { dataUrl: original.dataUrl } }),
        upload({ data: { dataUrl: previewDataUrl } }),
      ]);

      const custom = await fetchCustom({ data: { handle: CUSTOM_PRODUCT_HANDLE } });
      const node = custom?.node;
      const variant = node?.variants?.edges?.[0]?.node;
      if (!node || !variant) {
        toast.error("El producto de funda personalizada no está disponible", {
          description: "Crea en el panel un producto con el identificador «funda-personalizada».",
        });
        return;
      }

      const params: DesignParamsV2 = {
        v: 2,
        template: templateId,
        cx: t.cx,
        cy: t.cy,
        w: t.w,
        rot: t.rot,
        imgW: original.w,
        imgH: original.h,
        dpi: Math.round(dpi),
        lowQualityAccepted: lowQuality,
        layoutConfirmedAt: new Date().toISOString(),
      };

      const { id: designId } = await saveDesign({
        data: {
          model,
          imageUrl: originalUrl,
          previewUrl,
          text: "",
          params: params as unknown as Record<string, unknown>,
        },
      });

      await addItem({
        product: {
          node: {
            ...node,
            images: { edges: [{ node: { url: previewUrl, altText: "Tu diseño personalizado" } }] },
          },
        },
        variantId: variant.id,
        variantTitle: variant.title,
        price: variant.price,
        quantity: 1,
        customDesignId: designId,
        selectedOptions: [{ name: "Modelo", value: model }],
        attributes: [
          { key: "Modelo", value: model },
          { key: "Diseño", value: previewUrl },
        ],
      });
      toast.success("Diseño añadido a la bolsa");
    } catch (err) {
      console.error(err);
      toast.error("No se pudo añadir el diseño", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="container-luxe py-12 md:py-20">
      <p className="eyebrow mb-3">Diseña la tuya</p>
      <h1 className="font-display text-4xl leading-tight md:text-6xl">Personaliza tu funda</h1>
      <p className="mt-4 max-w-2xl text-muted-foreground">
        Elige tu modelo de iPhone, sube una foto de tu galería y colócala como más te guste.
      </p>
      {priceText && (
        <div className="mt-5 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <p className="font-display text-3xl tabular-nums">{priceText}</p>
          <p className="text-sm text-muted-foreground">IVA incluido · Envío gratis comprando 2 productos</p>
        </div>
      )}

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
        {/* ---------- Vista previa / editor ---------- */}
        <div className="self-start lg:sticky lg:top-24">
          <div className="mx-auto w-[min(78vw,300px)] lg:w-[360px]">
            <div
              ref={stageRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerEnd}
              onPointerCancel={onPointerEnd}
              className={`relative select-none overflow-hidden rounded-md ${
                image ? "cursor-grab active:cursor-grabbing" : ""
              }`}
              style={{ aspectRatio: `${stage.w} / ${stage.h}`, touchAction: image ? "none" : "auto" }}
            >
              {image && t && (
                <img
                  src={image.url}
                  alt="Tu foto"
                  draggable={false}
                  className="pointer-events-none absolute max-w-none select-none"
                  style={{
                    left: `${50 + (t.cx / stage.w) * 100}%`,
                    top: `${50 + (t.cy / stage.h) * 100}%`,
                    width: `${(t.w / stage.w) * 100}%`,
                    height: "auto",
                    transform: `translate(-50%, -50%) rotate(${t.rot}deg)`,
                  }}
                />
              )}

              <CaseOverlay model={model} hasImage={!!image} />

              <span className="pointer-events-none absolute left-1/2 top-[1.6%] -translate-x-1/2 whitespace-nowrap text-[9px] uppercase tracking-[0.18em] text-espresso/60">
                Zona lateral
              </span>

              {!image && (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2 text-espresso"
                >
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-espresso text-ivory shadow-lg transition-transform hover:scale-105">
                    <ImagePlus className="h-6 w-6" strokeWidth={1.5} />
                  </span>
                  <span className="text-xs font-medium uppercase tracking-[0.14em]">Sube tu foto</span>
                </button>
              )}

              {image && showHint && (
                <div className="pointer-events-none absolute inset-x-0 bottom-[14%] flex justify-center">
                  <span className="rounded-full bg-espresso/85 px-3 py-1.5 text-center text-[11px] text-ivory shadow">
                    {coarse ? "Arrastra para mover · Pellizca para ampliar" : "Arrastra para mover · Rueda para ampliar"}
                  </span>
                </div>
              )}
            </div>

            <p className="mt-4 text-center text-xs uppercase tracking-wider text-muted-foreground">{model}</p>
            <p className="mt-1 text-center text-[11px] text-muted-foreground">
              La zona más clara va en los laterales de la funda.
            </p>
          </div>
        </div>

        {/* ---------- Controles ---------- */}
        <div className="space-y-8">
          <div>
            <label className="mb-2 block text-sm font-medium">Modelo de iPhone</label>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger className="h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {MODELS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {caseMm.w} × {caseMm.h} mm — tamaño real del modelo
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Tu foto</label>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => fileRef.current?.click()}
                className="inline-flex h-12 items-center gap-2 rounded-md border border-border px-5 text-sm transition-colors hover:bg-secondary"
              >
                <Upload className="h-4 w-4" strokeWidth={1.5} />
                {image ? "Cambiar foto" : "Subir desde la galería"}
              </button>
              {image && (
                <button
                  onClick={removeImage}
                  className="inline-flex h-12 items-center gap-2 rounded-md border border-border px-5 text-sm text-destructive transition-colors hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" strokeWidth={1.5} /> Quitar
                </button>
              )}
            </div>
            {!image && (
              <p className="mt-2 text-xs text-muted-foreground">
                Para el mejor resultado, usa la foto original de tu galería.
              </p>
            )}
          </div>

          {image && t && (
            <div className="space-y-5 rounded-lg border border-border p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Ajusta tu foto</p>
                <button
                  onClick={reset}
                  className="text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
                >
                  Restablecer
                </button>
              </div>

              <p className="text-xs text-muted-foreground">
                Mueve la foto directamente sobre la funda.{" "}
                {coarse ? "Pellizca con dos dedos para ampliarla." : "Usa la rueda del ratón o la barra para ampliarla."}
              </p>

              <div onPointerDown={pushHistory}>
                <label className="mb-3 flex items-center gap-2 text-sm">
                  <ZoomIn className="h-4 w-4" strokeWidth={1.5} /> Zoom
                </label>
                <Slider
                  value={[zoomLevel]}
                  min={1}
                  max={MAX_ZOOM}
                  step={0.01}
                  onValueChange={(v) => {
                    setShowHint(false);
                    setT((cur) =>
                      cur ? zoomAround(cur, v[0] / (cur.w / minW), { x: 0, y: 0 }, image.w, image.h, stage) : cur,
                    );
                  }}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => rotate(-1)}
                  className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-4 text-sm hover:bg-secondary"
                >
                  <RotateCcw className="h-4 w-4" strokeWidth={1.5} /> Girar
                </button>
                <button
                  onClick={() => rotate(1)}
                  className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-4 text-sm hover:bg-secondary"
                >
                  <RotateCw className="h-4 w-4" strokeWidth={1.5} /> Girar
                </button>
                <button
                  onClick={undo}
                  disabled={history.length === 0}
                  className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-4 text-sm hover:bg-secondary disabled:opacity-40"
                >
                  <Undo2 className="h-4 w-4" strokeWidth={1.5} /> Deshacer
                </button>
              </div>

              {lowQuality && (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                  <p className="flex items-start gap-2 font-medium">
                    <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" strokeWidth={1.75} />
                    Tu foto tiene poca resolución
                  </p>
                  <p className="mt-1 text-amber-900/90">
                    Puede que al imprimirla se vea borrosa o pixelada y que los colores no salgan exactamente como en
                    tu pantalla. Para un mejor resultado, sube la foto original de tu galería (no una captura ni una
                    imagen descargada de WhatsApp o redes sociales){zoomLevel > 1.05 ? " o reduce el zoom" : ""}.
                  </p>
                  <label className="mt-3 flex cursor-pointer items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-1 accent-espresso"
                      checked={acceptLow}
                      onChange={(e) => setAcceptLow(e.target.checked)}
                    />
                    <span>Entiendo que la calidad final depende de la foto que he subido.</span>
                  </label>
                </div>
              )}
            </div>
          )}

          <div className="border-t border-border pt-8">
            {image && (
              <label className="mb-5 flex cursor-pointer items-start gap-3 rounded-md border border-border bg-secondary/30 p-4 text-sm">
                <input
                  type="checkbox"
                  className="mt-1 accent-espresso"
                  checked={confirmLayout}
                  onChange={(e) => setConfirmLayout(e.target.checked)}
                />
                <span>
                  He revisado mi diseño y acepto que la funda se fabricará{" "}
                  <strong className="font-medium">exactamente como la he dejado</strong> (posición, tamaño y giro de la
                  foto). Una vez hecho el pedido, el diseño no se podrá modificar.
                </span>
              </label>
            )}

            <p className="mb-4 text-sm text-muted-foreground">
              Cuando tengas tu diseño listo, añádelo a la bolsa y finaliza la compra. Nos llega tu diseño con el
              modelo elegido y lo producimos para ti.
            </p>
            <button
              type="button"
              onClick={addDesignToCart}
              disabled={adding || !image || !confirmLayout || (lowQuality && !acceptLow)}
              className="inline-flex h-14 items-center gap-2 rounded-md bg-black px-9 text-base font-medium uppercase tracking-[0.14em] text-white transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {adding ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" strokeWidth={1.5} /> Preparando tu diseño…
                </>
              ) : (
                <>
                  <ShoppingBag className="h-5 w-5" strokeWidth={1.5} /> Añadir a la bolsa
                  {priceText && <span className="tabular-nums"> · {priceText}</span>}
                </>
              )}
            </button>
            <p className="mt-3 text-xs text-muted-foreground">
              Los colores pueden variar ligeramente respecto a tu pantalla.
            </p>

            <div className="mt-8 rounded-lg border border-border p-6">
              <p className="mb-4 text-sm text-muted-foreground">
                ¿Prefieres que la diseñemos nosotros por ti? Cuéntanos tu idea y creamos la funda a tu medida.
              </p>
              <a
                href={`https://wa.me/34711278306?text=${encodeURIComponent(
                  `Hola Kasea, quiero que me personalicéis vosotros una funda.\nModelo: ${model}`,
                )}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-black px-5 py-3 text-center text-xs font-medium uppercase leading-snug tracking-[0.08em] text-white transition-colors hover:bg-neutral-800 sm:w-auto sm:text-sm"
              >
                Si quieres que te la personalicemos, escríbenos
                <ArrowRight className="h-4 w-4 shrink-0" strokeWidth={1.5} />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
