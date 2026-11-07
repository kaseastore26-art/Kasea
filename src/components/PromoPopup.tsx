// ============================================================================
// Popup de la promoción de fundas.
//   - Al entrar en la web: "Envío gratis en todas las fundas" (una vez por visita).
//   - En /checkout, si el pedido no lleva ninguna funda: "añade una funda y el
//     envío es gratis". Si la promo de la 2.ª funda está encendida y lleva UNA
//     funda, le recuerda el descuento de la segunda.
// ============================================================================
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { X } from "lucide-react";
import { isCaseItem, useCartStore } from "@/lib/cart";
import { MULTI_CASE_DISCOUNT_PERCENT, MULTI_CASE_PROMO_ON } from "@/lib/pricing";

type Kind = "entrada" | "segunda" | "sin-funda";

const STORAGE_KEY: Record<Kind, string> = {
  entrada: "kasea_popup_entrada_v3",
  segunda: "kasea_popup_segunda",
  "sin-funda": "kasea_popup_sin_funda",
};

const DELAY_MS: Record<Kind, number> = { entrada: 1800, segunda: 900, "sin-funda": 900 };

// Páginas donde nunca debe salir.
const EXCLUDED = /^\/(admin|auth|nueva-contrasena|checkout\/exito)/;


function alreadySeen(kind: Kind): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY[kind]) === "1";
  } catch {
    return false;
  }
}
function markSeen(kind: Kind) {
  try {
    sessionStorage.setItem(STORAGE_KEY[kind], "1");
  } catch {
    /* sin almacenamiento: no pasa nada */
  }
}

export function PromoPopup() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const itemCount = useCartStore((s) => s.items.reduce((n, i) => n + i.quantity, 0));
  const caseCount = useCartStore((s) => s.items.reduce((n, i) => n + (isCaseItem(i) ? i.quantity : 0), 0));
  const [open, setOpen] = useState<Kind | null>(null);
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Decide si toca mostrar algo en la página actual.
  useEffect(() => {
    let kind: Kind | null = null;
    if (!open && !EXCLUDED.test(pathname)) {
      if (pathname.startsWith("/checkout")) {
        if (MULTI_CASE_PROMO_ON && caseCount === 1) kind = "segunda";
        else if (itemCount > 0 && caseCount === 0) kind = "sin-funda";
      } else {
        kind = "entrada";
      }
      if (kind && alreadySeen(kind)) kind = null;
    }

    if (kind) {
      const k = kind;
      timer.current = setTimeout(() => {
        setOpen(k);
        requestAnimationFrame(() => setVisible(true));
      }, DELAY_MS[k]);
    }

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [pathname, itemCount, caseCount, open]);

  const close = () => {
    if (!open) return;
    markSeen(open);
    setVisible(false);
    setTimeout(() => setOpen(null), 350);
  };

  // Cerrar con Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const pct = `${MULTI_CASE_DISCOUNT_PERCENT} %`;
  const content: {
    eyebrow: string;
    big: string;
    title: string;
    text?: ReactNode;
    cta: string;
    dismiss: string;
  } =
    open === "entrada"
      ? {
          eyebrow: "Kasea Store",
          big: "Envío gratis",
          title: "en todas las fundas",
          cta: "Ver fundas",
          dismiss: "Ahora no",
        }
      : open === "segunda"
        ? {
            eyebrow: "Antes de pagar",
            big: `−${pct}`,
            title: "en tu segunda funda",
            text: <>Añade otra funda y el descuento se aplica solo.</>,
            cta: "Elegir otra funda",
            dismiss: "Continuar con mi pedido",
          }
        : {
            eyebrow: "Antes de pagar",
            big: "Envío gratis",
            title: "añadiendo una funda",
            text: <>Si tu pedido lleva una funda, no pagas el envío.</>,
            cta: "Ver fundas",
            dismiss: "Continuar con mi pedido",
          };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="kasea-promo-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm transition-opacity duration-300 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      <div
        className={`relative w-full max-w-[22rem] overflow-hidden bg-espresso text-ivory shadow-2xl transition-all duration-500 sm:max-w-md ${
          visible ? "translate-y-0 scale-100 opacity-100" : "translate-y-6 scale-[0.98] opacity-0"
        }`}
      >
        <button
          type="button"
          onClick={close}
          aria-label="Cerrar"
          className="absolute right-5 top-5 z-20 rounded-full p-1.5 text-ivory/70 transition hover:rotate-90 hover:text-ivory"
        >
          <X className="h-5 w-5" strokeWidth={1.5} />
        </button>

        {/* Texto */}
        <div className="relative px-8 pb-9 pt-11 text-center sm:px-12 sm:pb-11 sm:pt-14">
          {/* marco fino dorado */}
          <div className="pointer-events-none absolute inset-3 border border-gold/35" />

          <p className="flex items-center justify-center gap-3 text-[0.65rem] uppercase tracking-[0.35em] text-gold">
            <span className="h-px w-6 bg-gold/60" />
            {content.eyebrow}
            <span className="h-px w-6 bg-gold/60" />
          </p>

          <h2 id="kasea-promo-title" className="mt-4 font-display leading-none">
            <span
              className={`block italic text-gold ${open === "segunda" ? "text-7xl sm:text-8xl" : "text-5xl sm:text-6xl"}`}
            >
              {content.big}
            </span>
            <span className="mt-2 block text-2xl uppercase tracking-[0.12em] text-ivory sm:text-3xl">
              {content.title}
            </span>
          </h2>

          <p className="mt-5 text-xs tracking-[0.5em] text-gold/70">◆ ◆ ◆</p>

          {content.text && (
            <p className="mx-auto mt-4 max-w-xs text-sm leading-relaxed text-ivory/70">{content.text}</p>
          )}

          <Link
            to="/fundas-sublimacion"
            onClick={close}
            className="mt-7 inline-flex h-12 w-full items-center justify-center bg-ivory px-6 text-xs font-medium uppercase tracking-[0.22em] text-espresso transition hover:bg-gold hover:text-espresso"
          >
            {content.cta}
          </Link>

          <button
            type="button"
            onClick={close}
            className="mt-4 text-xs text-ivory/55 underline underline-offset-4 hover:text-ivory"
          >
            {content.dismiss}
          </button>
        </div>
      </div>
    </div>
  );
}
