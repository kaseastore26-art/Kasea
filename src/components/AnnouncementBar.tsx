import { useSiteContent } from "@/hooks/useSiteContent";

export function AnnouncementBar() {
  const content = useSiteContent();
  const message = content.announcement_text || "Envío gratis en todas las fundas";
  // Repetimos el mensaje para que la cinta (marquee) no deje huecos.
  const loop = [message, message, message];
  return (
    <div className="bg-espresso text-ivory overflow-hidden">
      <div className="flex animate-[marquee_20s_linear_infinite] whitespace-nowrap py-2.5">
        {loop.map((m, i) => (
          <span key={i} className="mx-8 text-[11px] tracking-[0.2em] uppercase">
            {m} <span className="mx-8 opacity-40">◆</span>
          </span>
        ))}
      </div>
    </div>
  );
}
