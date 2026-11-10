// "No quiero más avisos": deja de mandar recordatorios de pedido a medias.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { optOutCartReminders } from "@/lib/catalog.functions";

export const Route = createFileRoute("/recuperar/baja")({
  validateSearch: (s: Record<string, unknown>): { e?: string; k?: string } => ({
    e: typeof s.e === "string" ? s.e : undefined,
    k: typeof s.k === "string" ? s.k : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Avisos de pedido — Kasea Store" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OptOutPage,
});

function OptOutPage() {
  const { e, k } = Route.useSearch();
  const optOut = useServerFn(optOutCartReminders);
  const [state, setState] = useState<"idle" | "busy" | "ok" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function confirm() {
    if (!e || !k) return;
    setState("busy");
    try {
      const res = await optOut({ data: { e, k } });
      if ("error" in res) {
        setMsg(res.error);
        setState("error");
      } else setState("ok");
    } catch {
      setMsg("No se pudo guardar. Inténtalo más tarde.");
      setState("error");
    }
  }

  return (
    <div className="container mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      {!e || !k ? (
        <p className="text-muted-foreground">El enlace no es válido.</p>
      ) : state === "ok" ? (
        <>
          <h1 className="font-display text-3xl">Hecho</h1>
          <p className="text-muted-foreground">
            No te enviaremos más avisos de pedidos a medias a <strong>{e}</strong>. Los correos de tus pedidos sí te
            seguirán llegando.
          </p>
          <Link to="/" className="mt-2 border border-foreground px-6 py-3 text-xs uppercase tracking-[0.2em]">
            Volver a la tienda
          </Link>
        </>
      ) : (
        <>
          <h1 className="font-display text-3xl">¿Dejar de recibir avisos?</h1>
          <p className="text-muted-foreground">
            Dejaremos de avisarte a <strong>{e}</strong> cuando un pedido se quede a medias.
          </p>
          {state === "error" && <p className="text-sm text-destructive">{msg}</p>}
          <button
            type="button"
            onClick={confirm}
            disabled={state === "busy"}
            className="mt-2 bg-foreground px-6 py-3 text-xs uppercase tracking-[0.2em] text-background disabled:opacity-50"
          >
            {state === "busy" ? "Guardando…" : "Sí, no quiero más avisos"}
          </button>
        </>
      )}
    </div>
  );
}
