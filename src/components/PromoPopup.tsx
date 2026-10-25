// ============================================================================
// Popup de envío gratis.
//   - Al entrar en la web: anuncia la promoción (una vez por visita).
//   - En /checkout: si el cliente solo lleva 1 producto, le recuerda que con
//     otro más el envío es gratis (una vez por visita).
// ============================================================================
import { useEffect, useRef, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useCartStore } from "@/lib/cart";
import { FREE_SHIPPING_MIN_ITEMS } from "@/lib/pricing";

type Kind = "entrada" | "carrito";

const STORAGE_KEY: Record<Kind, string> = {
  entrada: "kasea_popup_entrada",
  carrito: "kasea_popup_carrito",
};

const DELAY_MS: Record<Kind, number> = { entrada: 1800, carrito: 900 };

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
  const [open, setOpen] = useState<Kind | null>(null);
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Decide si toca mostrar algo en la página actual.
  useEffect(() => {
    let kind: Kind | null = null;
    if (!open && !EXCLUDED.test(pathname)) {
      if (pathname.startsWith("/checkout")) {
        if (itemCount > 0 && itemCount < FREE_SHIPPING_MIN_ITEMS) kind = "carrito";
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
  }, [pathname, itemCount, open]);

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

  const content =
    open === "entrada"
      ? {
          eyebrow: "Kasea Store",
          title: "Con la compra de tu segundo producto",
          accent: "el envío es gratis",
          text: (
            <>
              Fundas, cuerdas, protectores, cargadores…{" "}
              <strong className="font-medium text-espresso">cualquier producto de la web</strong> cuenta. Combina
              lo que quieras y disfruta del <strong className="font-medium text-espresso">envío gratis</strong>.
            </>
          ),
          cta: "Descubrir la colección",
          dismiss: "Ahora no, gracias",
        }
      : {
          eyebrow: "Antes de pagar",
          title: "¿Y si te ahorras",
          accent: "el envío?",
          text: (
            <>
              Con <strong className="font-medium text-espresso">un producto más</strong> en tu pedido, el{" "}
              <strong className="font-medium text-espresso">envío es gratis</strong>. Una funda de repuesto, una
              cuerda o un protector… y lo que pagarías de envío se queda en tu bolsillo.
            </>
          ),
          cta: "Añadir otro producto",
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
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-espresso/45 p-4 backdrop-blur-sm transition-opacity duration-300 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      <div
        className={`relative w-full max-w-md bg-background px-7 pb-8 pt-12 text-center shadow-2xl transition-all duration-500 sm:px-9 ${
          visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
        }`}
      >
        {/* marco fino interior */}
        <div className="pointer-events-none absolute inset-2.5 border border-espresso/20" />

        <button
          type="button"
          onClick={close}
          aria-label="Cerrar"
          className="absolute right-4 top-4 z-10 rounded-full p-1.5 text-muted-foreground transition hover:rotate-90 hover:text-espresso"
        >
          <X className="h-5 w-5" strokeWidth={1.5} />
        </button>

        <p className="eyebrow flex items-center justify-center gap-3">
          <span className="h-px w-7 bg-espresso/40" />
          {content.eyebrow}
          <span className="h-px w-7 bg-espresso/40" />
        </p>

        <h2 id="kasea-promo-title" className="mt-5 font-display text-3xl uppercase leading-[1.05] sm:text-4xl">
          {content.title}
          <em className="mt-1 block normal-case italic text-espresso/80">{content.accent}</em>
        </h2>

        <p className="mt-4 text-xs tracking-[0.5em] text-espresso/50">◆ ◆ ◆</p>

        <p className="mx-auto mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">{content.text}</p>

        <Link
          to="/tienda"
          onClick={close}
          className="mt-7 inline-flex h-12 w-full items-center justify-center bg-espresso px-6 text-xs font-medium uppercase tracking-[0.2em] text-ivory transition hover:bg-espresso/90"
        >
          {content.cta}
        </Link>

        <button
          type="button"
          onClick={close}
          className="mt-4 text-xs text-muted-foreground underline underline-offset-4 hover:text-espresso"
        >
          {content.dismiss}
        </button>
      </div>
    </div>
  );
}
