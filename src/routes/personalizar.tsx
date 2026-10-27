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
  HelpCircle,
  Copy,
  Check,
  BringToFront,
  SendToBack,
  Replace,
  Palette,
  LayoutGrid,
  Image as ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { originalToJpeg, renderCasePreviewLayers } from "@/lib/design-render";
import { uploadCustomDesign, saveCustomDesign } from "@/lib/custom-design.functions";
import { useCartStore } from "@/lib/cart";
import { getProductByHandlePublic } from "@/lib/catalog.functions";
import { formatPrice } from "@/lib/shopify";
import { seo } from "@/lib/seo";
import {
  LOW_DPI,
  MAX_PHOTOS,
  MAX_ZOOM,
  MIN_FREE_WIDTH,
  MODELS,
  cameraShape,
  caseSizeMm,
  clampFree,
  clampTransform,
  effectiveBox,
  effectiveDpi,
  fitTransform,
  fitWidthInBox,
  minPhotoWidth,
  specFor,
  templateForModel,
  templateSizeMm,
  zoomAround,
  zoomFreeAround,
  type DesignLayerV3,
  type DesignParamsV3,
  type PhotoTransform,
  type Rotation,
} from "@/lib/case-design";

// Producto del catálogo usado para las fundas personalizadas
const CUSTOM_PRODUCT_HANDLE = "funda-personalizada";

type Layer = { id: string; url: string; w: number; h: number; t: PhotoTransform };

const BACKGROUNDS = [
  { label: "Blanco", value: "#ffffff" },
  { label: "Negro", value: "#000000" },
  { label: "Crema", value: "#f4efe7" },
  { label: "Rosa", value: "#f3c9d3" },
  { label: "Azul", value: "#bcd4ee" },
  { label: "Verde", value: "#cfe3c6" },
  { label: "Lila", value: "#d9cdea" },
];

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
// Ayuda: cómo colocar la foto
// ---------------------------------------------------------------------------
const AI_PROMPT =
  "Amplía esta foto añadiendo más fondo alrededor (arriba, abajo y a los lados) de forma natural, sin cambiar a las personas ni lo importante de la imagen. Hazla en formato vertical 9:16 y con la máxima calidad.";

function PhotoHelp() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(AI_PROMPT);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("No se pudo copiar el texto");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-espresso"
        aria-label="Ayuda para colocar la foto"
      >
        <HelpCircle className="h-3.5 w-3.5" strokeWidth={1.75} /> Ayuda
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl font-normal">Cómo colocar tu foto</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <div>
              <p className="font-medium text-espresso">La foto tiene que ocupar todo el espacio</p>
              <p className="mt-1">
                Tu funda se imprime también por los <strong className="font-medium text-espresso">bordes</strong>. Por
                eso la foto debe cubrir la funda y también la <strong className="font-medium text-espresso">zona más
                clara</strong> de alrededor, que es la que se dobla hacia los laterales.
              </p>
            </div>

            <div>
              <p className="font-medium text-espresso">Cómo moverla</p>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                <li>Arrástrala con el dedo o con el ratón.</li>
                <li>Amplíala pellizcando con dos dedos, con la rueda del ratón o con la barra de zoom.</li>
                <li>La cámara tapa esa parte de la foto: evita dejar caras o detalles importantes justo ahí.</li>
                <li>Usa la foto original de tu galería para que salga con la mejor calidad.</li>
              </ul>
            </div>

            <div className="rounded-md border border-border bg-secondary/40 p-4">
              <p className="font-medium text-espresso">¿Tu foto no se puede cuadrar como quieres?</p>
              <p className="mt-1">
                Si al colocarla se corta lo importante (por ejemplo, una foto muy apaisada o muy justa), puedes pedirle
                a una inteligencia artificial que genera imágenes, como <strong className="font-medium text-espresso">ChatGPT</strong>{" "}
                o <strong className="font-medium text-espresso">Gemini</strong>, que le añada más espacio alrededor.
                Sube tu foto y escríbele algo así:
              </p>
              <p className="mt-3 rounded bg-background p-3 text-[13px] italic text-espresso">“{AI_PROMPT}”</p>
              <button
                type="button"
                onClick={copyPrompt}
                className="mt-3 inline-flex h-9 items-center gap-2 rounded-md border border-border bg-background px-3 text-xs font-medium text-espresso hover:bg-secondary"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copiado" : "Copiar el mensaje"}
              </button>
              <p className="mt-3">Después, descarga la imagen nueva y súbela aquí.</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
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

  const [mode, setMode] = useState<"single" | "collage">("single");
  const [background, setBackground] = useState("#ffffff");
  const [layers, setLayers] = useState<Layer[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [history, setHistory] = useState<Layer[][]>([]);
  const [showHint, setShowHint] = useState(false);
  const [acceptLow, setAcceptLow] = useState(false);
  const [confirmLayout, setConfirmLayout] = useState(false);
  const [coarse, setCoarse] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const addRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; mid: { x: number; y: number } } | null>(null);
  const lastWheel = useRef(0);
  const allUrls = useRef<string[]>([]);
  // En el collage: mientras el cliente no mueva nada, al añadir fotos se recolocan todas solas
  const layoutTouched = useRef(false);

  const multi = mode === "collage";
  const selected: Layer | null = !multi
    ? (layers[0] ?? null)
    : (layers.find((l) => l.id === selectedId) ?? null);

  // Estado más reciente para los manejadores (rueda del ratón, etc.)
  const live = useRef({ layers, selectedId, stage, caseMm, mode });
  live.current = { layers, selectedId, stage, caseMm, mode };

  useEffect(() => {
    try {
      setCoarse(window.matchMedia("(pointer: coarse)").matches);
    } catch {
      /* sin matchMedia */
    }
  }, []);

  // Liberar las URLs temporales al salir de la página
  useEffect(() => {
    return () => allUrls.current.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  function clampLayer(l: Layer, isMulti: boolean, st = live.current.stage): Layer {
    return { ...l, t: isMulti ? clampFree(l.t, st) : clampTransform(l.t, l.w, l.h, st) };
  }

  // Al cambiar de modelo (puede cambiar la plantilla) se reajustan las fotos.
  useEffect(() => {
    setLayers((ls) => ls.map((l) => clampLayer(l, live.current.mode === "collage", stage)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model]);

  // Cualquier cambio en el diseño obliga a volver a confirmar
  useEffect(() => {
    setConfirmLayout(false);
  }, [layers, background, mode]);

  /** Colocación inicial cuando hay varias fotos: repartidas por la funda, evitando la cámara. */
  function defaultLayout(ls: Layer[]): Layer[] {
    const c = live.current.caseMm;
    const n = ls.length;
    const cols = n <= 2 ? 1 : 2;
    const rows = Math.ceil(n / cols);
    const slotW = (c.w * 0.92) / cols;
    const slotH = (c.h * 0.8) / rows;
    return ls.map((l, i) => {
      const row = Math.floor(i / cols);
      let col = i % cols;
      const isLastAlone = cols === 2 && n % 2 === 1 && i === n - 1;
      const x = isLastAlone ? 0 : (col - (cols - 1) / 2) * slotW;
      if (isLastAlone) col = 0;
      const y = (row - (rows - 1) / 2) * slotH + c.h * 0.06;
      const w = fitWidthInBox(l.w, l.h, 0, slotW * 0.94, slotH * 0.94);
      return clampLayer({ ...l, t: { cx: x, cy: y, w, rot: 0 } }, true);
    });
  }

  function pushHistory() {
    const cur = live.current.layers;
    if (cur.length) setHistory((h) => [...h.slice(-30), cur]);
  }

  function undo() {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory(history.slice(0, -1));
    setLayers(prev.map((l) => clampLayer(l, live.current.mode === "collage")));
  }

  function toMm(clientX: number, clientY: number) {
    const r = stageRef.current!.getBoundingClientRect();
    const k = r.width / stage.w;
    return { x: (clientX - r.left - r.width / 2) / k, y: (clientY - r.top - r.height / 2) / k, k };
  }

  function hitTest(p: { x: number; y: number }): string | null {
    const ls = live.current.layers;
    for (let i = ls.length - 1; i >= 0; i--) {
      const l = ls[i];
      const b = effectiveBox(l.t, l.w, l.h);
      if (Math.abs(p.x - l.t.cx) <= b.w / 2 && Math.abs(p.y - l.t.cy) <= b.h / 2) return l.id;
    }
    return null;
  }

  /** Aplica un cambio a la foto seleccionada (o a la única que haya). */
  function updateSelected(fn: (l: Layer, isMulti: boolean) => PhotoTransform) {
    layoutTouched.current = true;
    setLayers((ls) => {
      const isMulti = live.current.mode === "collage";
      const id = !isMulti ? ls[0]?.id : live.current.selectedId;
      if (!id) return ls;
      return ls.map((l) => (l.id === id ? clampLayer({ ...l, t: fn(l, isMulti) }, isMulti) : l));
    });
  }

  function zoomLayer(l: Layer, isMulti: boolean, factor: number, p: { x: number; y: number }): PhotoTransform {
    const st = live.current.stage;
    return isMulti ? zoomFreeAround(l.t, factor, p, st) : zoomAround(l.t, factor, p, l.w, l.h, st);
  }

  // ---- Arrastrar / pellizcar ----
  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (layers.length === 0) return;
    if (pointers.current.size === 0) {
      if (multi) {
        const hit = hitTest(toMm(e.clientX, e.clientY));
        setSelectedId(hit);
        live.current.selectedId = hit;
        if (!hit) return;
      }
      pushHistory();
    }
    e.currentTarget.setPointerCapture?.(e.pointerId);
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
    if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 1) {
      const { k } = toMm(e.clientX, e.clientY);
      const dx = (e.clientX - prev.x) / k;
      const dy = (e.clientY - prev.y) / k;
      updateSelected((l) => ({ ...l.t, cx: l.t.cx + dx, cy: l.t.cy + dy }));
    } else if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const factor = dist / Math.max(1, pinch.current.dist);
      const p = toMm(mid.x, mid.y);
      const pdx = (mid.x - pinch.current.mid.x) / p.k;
      const pdy = (mid.y - pinch.current.mid.y) / p.k;
      updateSelected((l, isMulti) =>
        zoomLayer({ ...l, t: { ...l.t, cx: l.t.cx + pdx, cy: l.t.cy + pdy } }, isMulti, factor, p),
      );
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
      const { layers: ls, stage: st } = live.current;
      if (ls.length === 0) return;
      const r = el.getBoundingClientRect();
      const k = r.width / st.w;
      const p = { x: (e.clientX - r.left - r.width / 2) / k, y: (e.clientY - r.top - r.height / 2) / k };
      if (live.current.mode === "collage" && !live.current.selectedId) {
        const hit = hitTest(p);
        if (!hit) return;
        setSelectedId(hit);
        live.current.selectedId = hit;
      }
      e.preventDefault();
      const now = Date.now();
      if (now - lastWheel.current > 400) pushHistory();
      lastWheel.current = now;
      setShowHint(false);
      const factor = Math.exp(-e.deltaY * 0.0015);
      updateSelected((l, isMulti) => zoomLayer(l, isMulti, factor, p));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Subir fotos ----
  async function readFiles(files: File[]): Promise<Array<Omit<Layer, "t">>> {
    const out: Array<Omit<Layer, "t">> = [];
    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        toast.error(`"${file.name}" no es una imagen.`);
        continue;
      }
      if (file.size > 40 * 1024 * 1024) {
        toast.error(`"${file.name}" es demasiado grande (máximo 40 MB).`);
        continue;
      }
      const url = URL.createObjectURL(file);
      try {
        const img = await loadImage(url);
        allUrls.current.push(url);
        out.push({ id: crypto.randomUUID(), url, w: img.naturalWidth, h: img.naturalHeight });
      } catch {
        URL.revokeObjectURL(url);
        toast.error("No hemos podido abrir una de las imágenes", {
          description: "Prueba con fotos en formato JPG o PNG.",
        });
      }
    }
    return out;
  }

  async function onAddFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;

    // Una foto: la nueva sustituye a la anterior y cubre toda la funda
    if (!multi) {
      const [l] = await readFiles(files.slice(0, 1));
      if (!l) return;
      pushHistory();
      setLayers([{ ...l, t: fitTransform(l.w, l.h, stage) }]);
      setAcceptLow(false);
      setShowHint(true);
      return;
    }

    const room = MAX_PHOTOS - layers.length;
    if (room <= 0) {
      toast.error(`Puedes poner como máximo ${MAX_PHOTOS} fotos.`);
      return;
    }
    if (files.length > room) toast(`Solo se han añadido ${room} foto(s): el máximo es ${MAX_PHOTOS}.`);
    const loaded = await readFiles(files.slice(0, room));
    if (!loaded.length) return;

    pushHistory();
    const prev = live.current.layers;
    const placeholder = { cx: 0, cy: 0, w: 1, rot: 0 as Rotation };
    let next: Layer[];
    if (prev.length === 0 || !layoutTouched.current) {
      next = defaultLayout([...prev, ...loaded.map((l) => ({ ...l, t: placeholder }))]);
      layoutTouched.current = false;
    } else {
      const c = caseMm;
      next = [
        ...prev,
        ...loaded.map((l, i) => {
          const off = (((prev.length + i) % 3) - 1) * 8;
          const w = fitWidthInBox(l.w, l.h, 0, c.w * 0.55, c.h * 0.35);
          return clampLayer({ ...l, t: { cx: off, cy: off + c.h * 0.05, w, rot: 0 } }, true);
        }),
      ];
    }
    setLayers(next);
    setSelectedId(next[next.length - 1].id);
    setAcceptLow(false);
    setShowHint(true);
  }

  function switchMode(m: "single" | "collage") {
    if (m === mode) return;
    if (m === "single" && layers.length > 1) {
      const ok = window.confirm(
        "Al pasar a «Una foto» solo se quedará la foto seleccionada (o la primera). ¿Quieres continuar?",
      );
      if (!ok) return;
    }
    setHistory([]);
    live.current.mode = m;
    setMode(m);
    if (m === "collage") {
      layoutTouched.current = false;
      setLayers((ls) => defaultLayout(ls));
      setSelectedId(layers[0]?.id ?? null);
    } else {
      const keep = selected ?? layers[0];
      setLayers(keep ? [{ ...keep, t: fitTransform(keep.w, keep.h, stage) }] : []);
      setSelectedId(null);
    }
  }

  async function onReplaceFile(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, 1);
    e.target.value = "";
    if (!files.length || !selected) return;
    const [l] = await readFiles(files);
    if (!l) return;
    pushHistory();
    const target = selected;
    setLayers((ls) => {
      const isMulti = live.current.mode === "collage";
      return ls.map((x) => {
        if (x.id !== target.id) return x;
        if (!isMulti) return { ...l, t: fitTransform(l.w, l.h, stage) };
        const b = effectiveBox(x.t, x.w, x.h);
        const w = fitWidthInBox(l.w, l.h, x.t.rot, b.w, b.h);
        return clampLayer({ ...l, t: { ...x.t, w } }, true);
      });
    });
    setSelectedId(null);
    setAcceptLow(false);
  }

  function removeSelected() {
    if (!selected) return;
    pushHistory();
    const rest = layers.filter((l) => l.id !== selected.id);
    setLayers(rest);
    setSelectedId(null);
    if (rest.length === 0) {
      setHistory([]);
      setAcceptLow(false);
    }
  }

  function removeAll() {
    setLayers([]);
    setSelectedId(null);
    setHistory([]);
    setAcceptLow(false);
  }

  function rotate(dir: 1 | -1) {
    if (!selected) return;
    pushHistory();
    updateSelected((l) => ({ ...l.t, rot: ((((l.t.rot + dir * 90) % 360) + 360) % 360) as Rotation }));
  }

  function moveLayer(where: "front" | "back") {
    if (!selected || !multi) return;
    pushHistory();
    layoutTouched.current = true;
    setLayers((ls) => {
      const rest = ls.filter((l) => l.id !== selected.id);
      const me = ls.find((l) => l.id === selected.id)!;
      return where === "front" ? [...rest, me] : [me, ...rest];
    });
  }

  function reset() {
    if (!layers.length) return;
    pushHistory();
    if (!multi) {
      const l = layers[0];
      setLayers([{ ...l, t: fitTransform(l.w, l.h, stage) }]);
    } else {
      setLayers(defaultLayout(layers.map((l) => ({ ...l }))));
      layoutTouched.current = false;
    }
  }

  // Zoom (barra)
  const minW = selected && !multi ? minPhotoWidth(selected.w, selected.h, selected.t.rot, stage) : 1;
  const freeMaxW = Math.max(stage.w, stage.h) * 1.4;
  const zoomValue = selected ? (multi ? selected.t.w : selected.t.w / minW) : 1;

  // Calidad: se mira la peor foto
  const dpis = layers.map((l) => effectiveDpi(l.w, l.t.w));
  const worstDpi = dpis.length ? Math.min(...dpis) : 999;
  const lowQuality = layers.length > 0 && worstDpi < LOW_DPI;

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
    if (!layers.length) {
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
      const imgs = await Promise.all(layers.map((l) => loadImage(l.url)));
      const previewDataUrl = renderCasePreviewLayers(
        imgs.map((img, i) => ({ img, t: layers[i].t })),
        model,
        { cover: !multi, background },
      );

      // Las fotos originales se suben una a una (pueden pesar bastante)
      const saved: DesignLayerV3[] = [];
      for (let i = 0; i < layers.length; i++) {
        const original = originalToJpeg(imgs[i], layers.length > 1 ? 3000 : 3600);
        const { url } = await upload({ data: { dataUrl: original.dataUrl } });
        const l = layers[i];
        saved.push({
          url,
          cx: l.t.cx,
          cy: l.t.cy,
          w: l.t.w,
          rot: l.t.rot,
          imgW: original.w,
          imgH: original.h,
          dpi: Math.round(effectiveDpi(l.w, l.t.w)),
        });
      }
      const { url: previewUrl } = await upload({ data: { dataUrl: previewDataUrl } });

      const custom = await fetchCustom({ data: { handle: CUSTOM_PRODUCT_HANDLE } });
      const node = custom?.node;
      const variant = node?.variants?.edges?.[0]?.node;
      if (!node || !variant) {
        toast.error("El producto de funda personalizada no está disponible", {
          description: "Crea en el panel un producto con el identificador «funda-personalizada».",
        });
        return;
      }

      const params: DesignParamsV3 = {
        v: 3,
        template: templateId,
        mode,
        background: multi ? background : "#ffffff",
        layers: saved,
        dpi: Math.round(worstDpi),
        lowQualityAccepted: lowQuality,
        layoutConfirmedAt: new Date().toISOString(),
      };

      const { id: designId } = await saveDesign({
        data: {
          model,
          imageUrl: saved[0].url,
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
          ...(saved.length > 1 ? [{ key: "Fotos", value: String(saved.length) }] : []),
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

  const hasPhotos = layers.length > 0;
  const btn =
    "inline-flex h-10 items-center gap-2 rounded-md border border-border px-4 text-sm hover:bg-secondary disabled:opacity-40";

  return (
    <div className="container-luxe py-12 md:py-20">
      <p className="eyebrow mb-3">Diseña la tuya</p>
      <h1 className="font-display text-4xl leading-tight md:text-6xl">Personaliza tu funda</h1>
      <p className="mt-4 max-w-2xl text-muted-foreground">
        Elige tu modelo de iPhone, sube una o varias fotos de tu galería y colócalas como más te guste.
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
                hasPhotos ? "cursor-grab active:cursor-grabbing" : ""
              }`}
              style={{
                aspectRatio: `${stage.w} / ${stage.h}`,
                touchAction: hasPhotos ? "none" : "auto",
                background: multi ? background : undefined,
              }}
            >
              {layers.map((l) => (
                <img
                  key={l.id}
                  src={l.url}
                  alt="Tu foto"
                  draggable={false}
                  className="pointer-events-none absolute max-w-none select-none"
                  style={{
                    left: `${50 + (l.t.cx / stage.w) * 100}%`,
                    top: `${50 + (l.t.cy / stage.h) * 100}%`,
                    width: `${(l.t.w / stage.w) * 100}%`,
                    height: "auto",
                    transform: `translate(-50%, -50%) rotate(${l.t.rot}deg)`,
                  }}
                />
              ))}

              <CaseOverlay model={model} hasImage={hasPhotos} />

              {/* Marco de la foto seleccionada (solo con varias fotos) */}
              {multi &&
                selected &&
                (() => {
                  const b = effectiveBox(selected.t, selected.w, selected.h);
                  return (
                    <div
                      className="pointer-events-none absolute border-2 border-dashed border-espresso/80 shadow-[0_0_0_1px_rgba(255,255,255,0.8)]"
                      style={{
                        left: `${50 + ((selected.t.cx - b.w / 2) / stage.w) * 100}%`,
                        top: `${50 + ((selected.t.cy - b.h / 2) / stage.h) * 100}%`,
                        width: `${(b.w / stage.w) * 100}%`,
                        height: `${(b.h / stage.h) * 100}%`,
                      }}
                    />
                  );
                })()}

              <span className="pointer-events-none absolute left-1/2 top-[1.6%] -translate-x-1/2 whitespace-nowrap text-[9px] uppercase tracking-[0.18em] text-espresso/60">
                Zona lateral
              </span>

              {!hasPhotos && (
                <button
                  type="button"
                  onClick={() => addRef.current?.click()}
                  className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2 text-espresso"
                >
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-espresso text-ivory shadow-lg transition-transform hover:scale-105">
                    <ImagePlus className="h-6 w-6" strokeWidth={1.5} />
                  </span>
                  <span className="text-xs font-medium uppercase tracking-[0.14em]">Sube tu foto</span>
                </button>
              )}

              {hasPhotos && showHint && (
                <div className="pointer-events-none absolute inset-x-0 bottom-[14%] flex justify-center px-2">
                  <span className="rounded-full bg-espresso/85 px-3 py-1.5 text-center text-[11px] text-ivory shadow">
                    {multi
                      ? layers.length > 1
                        ? "Toca una foto para moverla o ampliarla"
                        : "Arrastra para mover · Añade más fotos abajo"
                      : coarse
                        ? "Arrastra para mover · Pellizca para ampliar"
                        : "Arrastra para mover · Rueda para ampliar"}
                  </span>
                </div>
              )}
            </div>

            <p className="mt-4 text-center text-xs uppercase tracking-wider text-muted-foreground">{model}</p>
            <p className="mt-1 text-center text-[11px] text-muted-foreground">
              {multi
                ? "Collage: el fondo también se imprime en los laterales (zona más clara)."
                : "La zona más clara va en los laterales de la funda."}
            </p>
          </div>
        </div>

        {/* ---------- Controles ---------- */}
        <div className="space-y-8">
          <div>
            <label className="mb-2 block text-sm font-medium">¿Qué quieres hacer?</label>
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  { v: "single", title: "Una foto", text: "Tu foto cubre toda la funda" },
                  { v: "collage", title: "Collage", text: `Hasta ${MAX_PHOTOS} fotos con fondo de color` },
                ] as const
              ).map((o) => (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => switchMode(o.v)}
                  className={`rounded-lg border p-4 text-left transition-colors ${
                    mode === o.v ? "border-espresso bg-secondary/50" : "border-border hover:bg-secondary/20"
                  }`}
                >
                  <span className="flex items-center gap-2 font-medium">
                    {o.v === "single" ? (
                      <ImageIcon className="h-4 w-4" strokeWidth={1.5} />
                    ) : (
                      <LayoutGrid className="h-4 w-4" strokeWidth={1.5} />
                    )}
                    {o.title}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">{o.text}</span>
                </button>
              ))}
            </div>
          </div>

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
            <div className="mb-2 flex items-center justify-between gap-3">
              <label className="text-sm font-medium">{multi ? `Tus fotos (${layers.length}/${MAX_PHOTOS})` : "Tu foto"}</label>
              <PhotoHelp />
            </div>
            <input
              ref={addRef}
              type="file"
              accept="image/*"
              multiple={multi}
              className="hidden"
              onChange={onAddFiles}
            />
            <input ref={replaceRef} type="file" accept="image/*" className="hidden" onChange={onReplaceFile} />
            <div className="flex flex-wrap gap-3">
              {!hasPhotos || !multi ? (
                <>
                  <button
                    onClick={() => addRef.current?.click()}
                    className="inline-flex h-12 items-center gap-2 rounded-md border border-border px-5 text-sm transition-colors hover:bg-secondary"
                  >
                    <Upload className="h-4 w-4" strokeWidth={1.5} />
                    {!hasPhotos ? (multi ? "Subir fotos" : "Subir desde la galería") : "Cambiar foto"}
                  </button>
                  {hasPhotos && (
                    <button
                      onClick={removeAll}
                      className="inline-flex h-12 items-center gap-2 rounded-md border border-border px-5 text-sm text-destructive transition-colors hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" strokeWidth={1.5} /> Quitar
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button
                    onClick={() => addRef.current?.click()}
                    disabled={layers.length >= MAX_PHOTOS}
                    className="inline-flex h-12 items-center gap-2 rounded-md border border-border px-5 text-sm transition-colors hover:bg-secondary disabled:opacity-40"
                  >
                    <ImagePlus className="h-4 w-4" strokeWidth={1.5} /> Añadir otra foto
                  </button>
                  <button
                    onClick={removeAll}
                    className="inline-flex h-12 items-center gap-2 rounded-md border border-border px-5 text-sm text-destructive transition-colors hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" strokeWidth={1.5} /> Quitar todo
                  </button>
                </>
              )}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {!multi
                ? "La foto cubre toda la funda, también los laterales. Usa la foto original de tu galería."
                : !hasPhotos
                  ? `Puedes seleccionar varias fotos a la vez (hasta ${MAX_PHOTOS}).`
                  : "Toca una foto en la funda para seleccionarla y moverla, ampliarla o girarla."}
            </p>
          </div>

          {multi && (
            <div>
              <label className="mb-2 block text-sm font-medium">Color de fondo</label>
              <div className="flex flex-wrap items-center gap-2">
                {BACKGROUNDS.map((b) => (
                  <button
                    key={b.value}
                    type="button"
                    onClick={() => setBackground(b.value)}
                    aria-label={`Fondo ${b.label}`}
                    title={b.label}
                    className={`h-9 w-9 rounded-full border border-border transition-transform ${
                      background.toLowerCase() === b.value ? "scale-110 ring-2 ring-espresso ring-offset-2" : ""
                    }`}
                    style={{ backgroundColor: b.value }}
                  />
                ))}
                <label
                  className="relative inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border border-border px-3 text-xs text-muted-foreground hover:bg-secondary"
                  title="Elegir otro color"
                >
                  <Palette className="h-4 w-4" strokeWidth={1.5} /> Otro
                  <input
                    type="color"
                    value={background}
                    onChange={(e) => setBackground(e.target.value)}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  />
                </label>
              </div>
            </div>
          )}

          {hasPhotos && (
            <div className="space-y-5 rounded-lg border border-border p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  {multi ? (selected ? "Foto seleccionada" : "Selecciona una foto") : "Ajusta tu foto"}
                </p>
                <div className="flex items-center gap-3">
                  <PhotoHelp />
                  <button
                    onClick={reset}
                    className="text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
                  >
                    {multi ? "Recolocar todas" : "Restablecer"}
                  </button>
                </div>
              </div>

              {multi && (
                <div className="flex flex-wrap gap-2">
                  {layers.map((l, i) => (
                    <button
                      key={l.id}
                      onClick={() => setSelectedId(l.id)}
                      className={`h-14 w-14 overflow-hidden rounded-md border-2 ${
                        selected?.id === l.id ? "border-espresso" : "border-transparent opacity-80 hover:opacity-100"
                      }`}
                      aria-label={`Seleccionar foto ${i + 1}`}
                    >
                      <img src={l.url} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}

              {selected ? (
                <>
                  <p className="text-xs text-muted-foreground">
                    Mueve la foto directamente sobre la funda.{" "}
                    {coarse ? "Pellizca con dos dedos para ampliarla." : "Usa la rueda del ratón o la barra para ampliarla."}
                  </p>

                  <div onPointerDown={pushHistory}>
                    <label className="mb-3 flex items-center gap-2 text-sm">
                      <ZoomIn className="h-4 w-4" strokeWidth={1.5} /> Tamaño
                    </label>
                    <Slider
                      value={[zoomValue]}
                      min={multi ? MIN_FREE_WIDTH : 1}
                      max={multi ? freeMaxW : MAX_ZOOM}
                      step={0.01}
                      onValueChange={(v) => {
                        setShowHint(false);
                        updateSelected((l, isMulti) =>
                          isMulti
                            ? zoomFreeAround(l.t, v[0] / l.t.w, { x: l.t.cx, y: l.t.cy }, stage)
                            : zoomAround(
                                l.t,
                                v[0] / (l.t.w / minPhotoWidth(l.w, l.h, l.t.rot, stage)),
                                { x: 0, y: 0 },
                                l.w,
                                l.h,
                                stage,
                              ),
                        );
                      }}
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => rotate(-1)} className={btn}>
                      <RotateCcw className="h-4 w-4" strokeWidth={1.5} /> Girar
                    </button>
                    <button onClick={() => rotate(1)} className={btn}>
                      <RotateCw className="h-4 w-4" strokeWidth={1.5} /> Girar
                    </button>
                    {multi && (
                      <>
                        <button onClick={() => moveLayer("front")} className={btn}>
                          <BringToFront className="h-4 w-4" strokeWidth={1.5} /> Delante
                        </button>
                        <button onClick={() => moveLayer("back")} className={btn}>
                          <SendToBack className="h-4 w-4" strokeWidth={1.5} /> Detrás
                        </button>
                      </>
                    )}
                    <button onClick={() => replaceRef.current?.click()} className={btn}>
                      <Replace className="h-4 w-4" strokeWidth={1.5} /> Cambiar
                    </button>
                    {multi && (
                      <button onClick={removeSelected} className={`${btn} text-destructive`}>
                        <Trash2 className="h-4 w-4" strokeWidth={1.5} /> Quitar
                      </button>
                    )}
                    <button onClick={undo} disabled={history.length === 0} className={btn}>
                      <Undo2 className="h-4 w-4" strokeWidth={1.5} /> Deshacer
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <button onClick={undo} disabled={history.length === 0} className={btn}>
                    <Undo2 className="h-4 w-4" strokeWidth={1.5} /> Deshacer
                  </button>
                </div>
              )}

              {lowQuality && (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                  <p className="flex items-start gap-2 font-medium">
                    <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" strokeWidth={1.75} />
                    {multi ? "Alguna de tus fotos tiene poca resolución" : "Tu foto tiene poca resolución"}
                  </p>
                  <p className="mt-1 text-amber-900/90">
                    Puede que al imprimirla se vea borrosa o pixelada y que los colores no salgan exactamente como en
                    tu pantalla. Para un mejor resultado, sube la foto original de tu galería (no una captura ni una
                    imagen descargada de WhatsApp o redes sociales) o hazla un poco más pequeña.
                  </p>
                  <label className="mt-3 flex cursor-pointer items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-1 accent-espresso"
                      checked={acceptLow}
                      onChange={(e) => setAcceptLow(e.target.checked)}
                    />
                    <span>Entiendo que la calidad final depende de las fotos que he subido.</span>
                  </label>
                </div>
              )}
            </div>
          )}

          <div className="border-t border-border pt-8">
            {hasPhotos && (
              <label className="mb-5 flex cursor-pointer items-start gap-3 rounded-md border border-border bg-secondary/30 p-4 text-sm">
                <input
                  type="checkbox"
                  className="mt-1 accent-espresso"
                  checked={confirmLayout}
                  onChange={(e) => setConfirmLayout(e.target.checked)}
                />
                <span>
                  He revisado mi diseño y acepto que la funda se fabricará{" "}
                  <strong className="font-medium">exactamente como la he dejado</strong> (posición, tamaño y giro de
                  {multi ? " las fotos" : " la foto"}). Una vez hecho el pedido, el diseño no se podrá modificar.
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
              disabled={adding || !hasPhotos || !confirmLayout || (lowQuality && !acceptLow)}
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
