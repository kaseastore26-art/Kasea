// Enlace del correo "tu pedido se quedó a medias": vuelve a llenar la bolsa
// (en cualquier dispositivo) y lleva al cliente a terminar el pedido.
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { useCartStore } from "@/lib/cart";
import { getAbandonedCartPublic } from "@/lib/catalog.functions";

const PREFILL_KEY = "kasea_checkout_prefill";

export const Route = createFileRoute("/recuperar/$session")({
  head: () => ({
    meta: [
      { title: "Tu pedido — Kasea Store" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RecoverPage,
});

function RecoverPage() {
  const { session } = Route.useParams();
  const navigate = useNavigate();
  const fetchCart = useServerFn(getAbandonedCartPublic);
  const [error, setError] = useState<string | null>(null);
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    (async () => {
      try {
        const res = await fetchCart({ data: { sessionId: session } });
        if ("error" in res) {
          setError(res.error);
          return;
        }
        const store = useCartStore.getState();
        store.clearCart();
        for (const it of res.items) store.addItem(it);
        store.setOpen(false);
        try {
          sessionStorage.setItem(PREFILL_KEY, JSON.stringify(res.customer));
        } catch {
          /* sin almacenamiento: el cliente rellena a mano */
        }
        navigate({ to: "/checkout" });
      } catch {
        setError("No hemos podido recuperar tu pedido.");
      }
    })();
  }, [fetchCart, navigate, session]);

  return (
    <div className="container mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      {error ? (
        <>
          <h1 className="font-display text-3xl">Vaya…</h1>
          <p className="text-muted-foreground">{error}</p>
          <Link to="/fundas-sublimacion" className="mt-2 border border-foreground px-6 py-3 text-xs uppercase tracking-[0.2em]">
            Ver fundas
          </Link>
        </>
      ) : (
        <>
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">Recuperando tu pedido…</p>
        </>
      )}
    </div>
  );
}
