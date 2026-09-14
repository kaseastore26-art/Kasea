import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Upload, Trash2, ArrowRight, Loader2, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { renderDesign } from "@/lib/design-render";
import { uploadCustomDesign, saveCustomDesign } from "@/lib/custom-design.functions";
import { useCartStore } from "@/lib/cart";
import { type ShopifyProduct } from "@/lib/shopify";
import { getProductByHandlePublic } from "@/lib/catalog.functions";
import { seo } from "@/lib/seo";

// Producto del catálogo usado para las fundas personalizadas
const CUSTOM_PRODUCT_HANDLE = "funda-personalizada";


type Spec = {
  ratio: string; // aspect-ratio css
  radius: number; // % of width
  cam: "square" | "vertical" | "wide";
  camW: number; // % ancho de la funda
  camRatio: string;
  camLeft?: number;
  camTop?: number;
};

// Medidas aproximadas reales (relación de aspecto y módulo de cámara) por modelo
const MODEL_SPECS: Record<string, Spec> = {
  "iPhone 18 Pro Max": { ratio: "77.6 / 163.4", radius: 13, cam: "wide", camW: 90, camRatio: "2.28 / 1", camTop: 2.8 },
  "iPhone 18 Pro": { ratio: "71.9 / 150", radius: 13, cam: "wide", camW: 90, camRatio: "2.2 / 1", camTop: 2.8 },
  "iPhone 17 Pro Max": { ratio: "77.6 / 163.4", radius: 13, cam: "wide", camW: 90, camRatio: "2.28 / 1", camTop: 2.8 },
  "iPhone 17 Pro": { ratio: "71.9 / 150", radius: 13, cam: "wide", camW: 90, camRatio: "2.2 / 1", camTop: 2.8 },
  "iPhone 17 Air": { ratio: "74.7 / 156.2", radius: 13, cam: "wide", camW: 88, camRatio: "2.55 / 1", camTop: 3 },
  "iPhone 17": { ratio: "71.9 / 149.6", radius: 13, cam: "vertical", camW: 28, camRatio: "0.55 / 1", camLeft: 5, camTop: 3.2 },
  "iPhone 16 Pro Max": { ratio: "77.6 / 163", radius: 12.5, cam: "square", camW: 49, camRatio: "1 / 1" },
  "iPhone 16 Pro": { ratio: "71.5 / 149.6", radius: 12.5, cam: "square", camW: 51, camRatio: "1 / 1" },
  "iPhone 16 Plus": { ratio: "77.8 / 160.9", radius: 12.5, cam: "vertical", camW: 25, camRatio: "0.55 / 1" },
  "iPhone 16": { ratio: "71.6 / 147.6", radius: 12.5, cam: "vertical", camW: 27, camRatio: "0.55 / 1" },
  "iPhone 15 Pro Max": { ratio: "76.7 / 159.9", radius: 12.5, cam: "square", camW: 50, camRatio: "1 / 1" },
  "iPhone 15 Pro": { ratio: "70.6 / 146.6", radius: 12.5, cam: "square", camW: 52, camRatio: "1 / 1" },
  "iPhone 15 Plus": { ratio: "77.8 / 160.9", radius: 12.5, cam: "square", camW: 38, camRatio: "1 / 1" },
  "iPhone 15": { ratio: "71.6 / 147.6", radius: 12.5, cam: "square", camW: 40, camRatio: "1 / 1" },
  "iPhone 14 Pro Max": { ratio: "77.6 / 160.7", radius: 12, cam: "square", camW: 49, camRatio: "1 / 1" },
  "iPhone 14 Pro": { ratio: "71.5 / 147.5", radius: 12, cam: "square", camW: 52, camRatio: "1 / 1" },
  "iPhone 14 Plus": { ratio: "78.1 / 160.8", radius: 12, cam: "square", camW: 37, camRatio: "1 / 1" },
  "iPhone 14": { ratio: "71.5 / 146.7", radius: 12, cam: "square", camW: 39, camRatio: "1 / 1" },
  "iPhone 13 Pro Max": { ratio: "78.1 / 160.8", radius: 11.5, cam: "square", camW: 47, camRatio: "1 / 1" },
  "iPhone 13 Pro": { ratio: "71.5 / 146.7", radius: 11.5, cam: "square", camW: 49, camRatio: "1 / 1" },
  "iPhone 13": { ratio: "71.5 / 146.7", radius: 11.5, cam: "square", camW: 38, camRatio: "1 / 1" },
  "iPhone 13 mini": { ratio: "64.2 / 131.5", radius: 11.5, cam: "square", camW: 41, camRatio: "1 / 1" },
  "iPhone 12 Pro Max": { ratio: "78.1 / 160.8", radius: 11, cam: "square", camW: 43, camRatio: "1 / 1" },
  "iPhone 12 Pro": { ratio: "71.5 / 146.7", radius: 11, cam: "square", camW: 43, camRatio: "1 / 1" },
  "iPhone 12": { ratio: "71.5 / 146.7", radius: 11, cam: "square", camW: 36, camRatio: "1 / 1" },
  "iPhone 12 mini": { ratio: "64.2 / 131.5", radius: 11, cam: "square", camW: 39, camRatio: "1 / 1" },
};

const MODELS = Object.keys(MODEL_SPECS);

const FONTS = [
  { label: "Serif elegante", value: "'Instrument Serif', Georgia, serif" },
  { label: "Sans moderna", value: "'Inter', system-ui, sans-serif" },
  { label: "Manuscrita", value: "'Brush Script MT', cursive" },
  { label: "Máquina de escribir", value: "'Courier New', monospace" },
  { label: "Impacto", value: "Impact, 'Arial Black', sans-serif" },
];

const COLORS = ["#000000", "#ffffff", "#d4af37", "#e0457b", "#2f6fed", "#1f7a52", "#ff5722"];

function CameraModule({ spec }: { spec: Spec }) {
  const isWide = spec.cam === "wide";

  return (
    <div
      aria-label="Hueco de cámara del modelo"
      className={`absolute z-20 bg-background shadow-[inset_0_0_0_3px_color-mix(in_oklab,var(--border)_80%,transparent),0_2px_7px_color-mix(in_oklab,var(--foreground)_16%,transparent)] ${
        isWide
          ? "-translate-x-1/2 rounded-[16%/38%]"
          : spec.cam === "vertical"
            ? "rounded-[45%/24%]"
            : "rounded-[24%]"
      }`}
      style={{
        width: `${spec.camW}%`,
        aspectRatio: spec.camRatio,
        top: `${spec.camTop ?? 3.2}%`,
        left: isWide ? "50%" : `${spec.camLeft ?? 5}%`,
      }}
    />
  );
}



export const Route = createFileRoute("/personalizar")({
  head: () =>
    seo({
      title: "Personaliza tu funda — Kasea Store",
      description:
        "Diseña tu funda de iPhone: elige modelo, sube tu foto, añade tu nombre o frase y escoge tipografía y color.",
      path: "/personalizar",
    }),
  component: PersonalizarPage,
});

function PersonalizarPage() {
  const [model, setModel] = useState(MODELS[3]);
  const spec = MODEL_SPECS[model] ?? MODEL_SPECS["iPhone 17"];
  const [specW, specH] = spec.ratio.split("/").map((n) => Number(n.trim()));


  const [image, setImage] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [font, setFont] = useState(FONTS[0].value);
  const [color, setColor] = useState("#000000");
  const [size, setSize] = useState(28);
  const [posY, setPosY] = useState(72);
  const [posX, setPosX] = useState(50);
  const [textRot, setTextRot] = useState(0);
  const [textW, setTextW] = useState(86);
  const caseRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  function startDrag(e: React.PointerEvent) {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setDragging(true);
  }
  function onDragMove(e: React.PointerEvent) {
    if (!dragging || !caseRef.current) return;
    const r = caseRef.current.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    setPosX(Math.min(95, Math.max(5, x)));
    setPosY(Math.min(95, Math.max(5, y)));
  }

  const [fit, setFit] = useState<"cover" | "contain">("cover");
  const [zoom, setZoom] = useState(1);
  const [imgX, setImgX] = useState(50);
  const [imgY, setImgY] = useState(50);
  const [rotation, setRotation] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImage(String(reader.result));
    reader.readAsDataURL(file);
    setZoom(1);
    setImgX(50);
    setImgY(50);
    setRotation(0);
    setFit("cover");
  }

  const addItem = useCartStore((s) => s.addItem);
  const upload = useServerFn(uploadCustomDesign);
  const saveDesign = useServerFn(saveCustomDesign);
  const fetchCustom = useServerFn(getProductByHandlePublic);
  const [adding, setAdding] = useState(false);

  async function addDesignToCart() {
    if (!image && !text.trim()) {
      toast.error("Añade una imagen o un texto antes de continuar.");
      return;
    }
    setAdding(true);
    try {
      const previewWidth = caseRef.current?.getBoundingClientRect().width ?? 320;
      const dataUrl = await renderDesign({
        specW,
        specH,
        image,
        fit,
        zoom,
        imgX,
        imgY,
        rotation,
        text,
        font,
        color,
        fontSize: size,
        previewWidth,
        posX,
        posY,
        textW,
        textRot,
      });

      const { url } = await upload({ data: { dataUrl } });

      const custom = await fetchCustom({ data: { handle: CUSTOM_PRODUCT_HANDLE } });
      const node = custom?.node;
      const variant = node?.variants?.edges?.[0]?.node;
      if (!node || !variant) {
        toast.error("El producto de funda personalizada no está disponible", {
          description: "Crea en el panel un producto con el identificador «funda-personalizada».",
        });
        return;
      }

      // Guarda TODOS los datos del diseño (para producción, visible en el admin).
      const { id: designId } = await saveDesign({
        data: {
          model,
          imageUrl: url,
          previewUrl: url,
          text: text.trim(),
          font,
          color,
          fontSize: size,
          posX,
          posY,
          rotation: textRot,
          params: { specW, specH, fit, zoom, imgX, imgY, imgRotation: rotation, textW, textRot },
        },
      });

      await addItem({
        product: {
          node: {
            ...node,
            images: { edges: [{ node: { url, altText: "Tu diseño personalizado" } }] },
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
          { key: "Texto", value: text.trim() || "Sin texto" },
          { key: "Diseño", value: url },
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
        Elige tu modelo de iPhone, sube una imagen de tu galería y añade tu nombre o una frase con
        la tipografía y el color que más te gusten.
      </p>

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
        {/* Preview — en móvil queda fijo (sticky) bajo el header y más pequeño,
            para poder ver la funda mientras se ajustan los controles de abajo. */}
        <div className="sticky top-[104px] z-20 self-start bg-background/95 pb-3 backdrop-blur lg:top-24 lg:z-auto lg:bg-transparent lg:pb-0 lg:backdrop-blur-none">
          <div className="mx-auto w-full max-w-[150px] lg:max-w-[320px]">
            <div
              className="mx-auto transition-all duration-300"
              style={{ width: `${(specW / 78.1) * 100}%` }}
            >
              <div
                ref={caseRef}
                onPointerMove={onDragMove}
                onPointerUp={() => setDragging(false)}
                onPointerLeave={() => setDragging(false)}
                className="relative overflow-hidden border border-border bg-white shadow-xl transition-all duration-300"
                style={{
                  aspectRatio: spec.ratio,
                  borderRadius: `${spec.radius}% / ${(spec.radius * specW) / specH}%`,
                  touchAction: dragging ? "none" : undefined,
                }}
              >
                {image && (
                  <img
                    src={image}
                    alt="Tu diseño personalizado"
                    className="absolute inset-0 h-full w-full"
                    style={{
                      objectFit: fit,
                      objectPosition: `${imgX}% ${imgY}%`,
                      transform: `scale(${zoom}) rotate(${rotation}deg)`,
                    }}
                  />
                )}
                {/* Módulo de cámara real del modelo */}
                <CameraModule spec={spec} />

                {text && (
                  <span
                    onPointerDown={startDrag}
                    className={`absolute text-center leading-tight break-words select-none ${
                      dragging ? "cursor-grabbing ring-1 ring-foreground/30" : "cursor-grab"
                    }`}
                    style={{
                      top: `${posY}%`,
                      left: `${posX}%`,
                      width: `${textW}%`,
                      transform: `translate(-50%, -50%) rotate(${textRot}deg)`,
                      fontFamily: font,
                      color,
                      fontSize: `${size}px`,
                      touchAction: "none",
                    }}
                  >
                    {text}
                  </span>
                )}
              </div>

            </div>
            <p className="mt-4 text-center text-xs tracking-wider text-muted-foreground uppercase">
              {model}
            </p>
            <p className="mt-1 text-center text-[11px] text-muted-foreground">
              {specW} × {specH} mm — tamaño real del modelo
            </p>

          </div>
        </div>

        {/* Controls */}
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
          </div>


          <div>
            <label className="mb-2 block text-sm font-medium">Tu imagen</label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onFile}
            />
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => fileRef.current?.click()}
                className="inline-flex h-12 items-center gap-2 rounded-md border border-border px-5 text-sm transition-colors hover:bg-secondary"
              >
                <Upload className="h-4 w-4" strokeWidth={1.5} />
                {image ? "Cambiar imagen" : "Subir desde la galería"}
              </button>
              {image && (
                <button
                  onClick={() => setImage(null)}
                  className="inline-flex h-12 items-center gap-2 rounded-md border border-border px-5 text-sm text-destructive transition-colors hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" strokeWidth={1.5} /> Quitar
                </button>
              )}
            </div>
          </div>

          {image && (
            <div className="space-y-6 rounded-lg border border-border p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Ajustar la imagen a la funda</p>
                <button
                  onClick={() => {
                    setZoom(1);
                    setImgX(50);
                    setImgY(50);
                    setRotation(0);
                    setFit("cover");
                  }}
                  className="text-xs tracking-wider text-muted-foreground uppercase hover:text-foreground"
                >
                  Restablecer
                </button>
              </div>

              <div className="flex gap-2">
                {(
                  [
                    { v: "cover", label: "Rellenar funda" },
                    { v: "contain", label: "Imagen completa" },
                  ] as const
                ).map((o) => (
                  <button
                    key={o.v}
                    onClick={() => setFit(o.v)}
                    className={`h-10 flex-1 rounded-md border text-sm transition-colors ${
                      fit === o.v ? "bg-foreground text-background" : "hover:bg-secondary"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>

              <div>
                <label className="mb-3 block text-sm">Zoom</label>
                <Slider
                  value={[zoom]}
                  min={0.5}
                  max={3}
                  step={0.01}
                  onValueChange={(v) => setZoom(v[0])}
                />
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <label className="mb-3 block text-sm">Mover horizontal</label>
                  <Slider
                    value={[imgX]}
                    min={0}
                    max={100}
                    step={1}
                    onValueChange={(v) => setImgX(v[0])}
                  />
                </div>
                <div>
                  <label className="mb-3 block text-sm">Mover vertical</label>
                  <Slider
                    value={[imgY]}
                    min={0}
                    max={100}
                    step={1}
                    onValueChange={(v) => setImgY(v[0])}
                  />
                </div>
              </div>

              <div>
                <label className="mb-3 block text-sm">Girar</label>
                <Slider
                  value={[rotation]}
                  min={-180}
                  max={180}
                  step={1}
                  onValueChange={(v) => setRotation(v[0])}
                />
              </div>
            </div>
          )}



          <div>
            <label className="mb-2 block text-sm font-medium">Texto (nombre o frase)</label>
            <Input
              value={text}
              maxLength={40}
              placeholder="Escribe aquí tu nombre o una frase"
              onChange={(e) => setText(e.target.value)}
              className="h-12"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Estilo de letra</label>
            <Select value={font} onValueChange={setFont}>
              <SelectTrigger className="h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FONTS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    <span style={{ fontFamily: f.value }}>{f.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Color del texto</label>
            <div className="flex flex-wrap items-center gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  aria-label={`Color ${c}`}
                  className={`h-9 w-9 rounded-full border transition-transform ${
                    color === c ? "scale-110 ring-2 ring-foreground ring-offset-2" : ""
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                aria-label="Color personalizado"
                className="h-9 w-12 cursor-pointer rounded-md border border-border bg-transparent p-1"
              />
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label className="mb-3 block text-sm font-medium">Tamaño del texto</label>
              <Slider
                value={[size]}
                min={12}
                max={72}
                step={1}
                onValueChange={(v) => setSize(v[0])}
              />
            </div>
            <div>
              <label className="mb-3 block text-sm font-medium">Ancho del texto</label>
              <Slider
                value={[textW]}
                min={30}
                max={96}
                step={1}
                onValueChange={(v) => setTextW(v[0])}
              />
            </div>
            <div>
              <label className="mb-3 block text-sm font-medium">Mover horizontal</label>
              <Slider
                value={[posX]}
                min={5}
                max={95}
                step={1}
                onValueChange={(v) => setPosX(v[0])}
              />
            </div>
            <div>
              <label className="mb-3 block text-sm font-medium">Mover vertical</label>
              <Slider
                value={[posY]}
                min={5}
                max={95}
                step={1}
                onValueChange={(v) => setPosY(v[0])}
              />
            </div>
            <div>
              <label className="mb-3 block text-sm font-medium">Girar texto</label>
              <Slider
                value={[textRot]}
                min={-90}
                max={90}
                step={1}
                onValueChange={(v) => setTextRot(v[0])}
              />
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => {
                  setPosX(50);
                  setPosY(72);
                  setTextRot(0);
                  setTextW(86);
                  setSize(28);
                }}
                className="text-xs tracking-wider text-muted-foreground uppercase hover:text-foreground"
              >
                Restablecer texto
              </button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Consejo: también puedes arrastrar el texto directamente sobre la funda.
          </p>


          <div className="border-t border-border pt-8">
            <p className="mb-4 text-sm text-muted-foreground">
              Cuando tengas tu diseño listo, añádelo a la bolsa y finaliza la compra. Nos llega tu
              diseño con el modelo elegido y lo producimos para ti.
            </p>
            <button
              type="button"
              onClick={addDesignToCart}
              disabled={adding}
              className="inline-flex h-14 items-center gap-2 rounded-md bg-black px-9 text-base font-medium tracking-[0.14em] text-white uppercase transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-100"
            >
              {adding ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" strokeWidth={1.5} /> Generando diseño…
                </>
              ) : (
                <>
                  <ShoppingBag className="h-5 w-5" strokeWidth={1.5} /> Añadir a la bolsa
                </>
              )}
            </button>


            <div className="mt-8 rounded-lg border border-border p-6">
              <p className="mb-4 text-sm text-muted-foreground">
                ¿Prefieres que la diseñemos nosotros por ti? Cuéntanos tu idea y creamos la funda a
                tu medida.
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
