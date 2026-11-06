// Dibujo sencillo (SVG) de la funda de un modelo con su hueco de cámara real.
// Se usa en las páginas por modelo; funciona igual en el servidor y en el navegador.
import { useId } from "react";
import { cameraShape, caseSizeMm, specFor } from "@/lib/case-design";

export function CaseMockup({ model, className }: { model: string; className?: string }) {
  const spec = specFor(model);
  const c = caseSizeMm(spec);
  const cam = cameraShape(model, spec);
  const pad = 2;
  const gid = `kasea-mock-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  return (
    <svg
      viewBox={`${-pad} ${-pad} ${c.w + pad * 2} ${c.h + pad * 2}`}
      className={className}
      role="img"
      aria-label={`Funda personalizada para ${model}`}
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f3c9d3" />
          <stop offset="55%" stopColor="#f4efe7" />
          <stop offset="100%" stopColor="#bcd4ee" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width={c.w} height={c.h} rx={c.r} ry={c.r} fill={`url(#${gid})`} />
      <rect
        x="0"
        y="0"
        width={c.w}
        height={c.h}
        rx={c.r}
        ry={c.r}
        fill="none"
        stroke="rgba(0,0,0,0.15)"
        strokeWidth="0.5"
      />
      {(cam.extras ?? []).map((e, i) => (
        <rect key={`e${i}`} x={e.x} y={e.y} width={e.w} height={e.h} rx={e.r} ry={e.r} fill="#1f1f22" />
      ))}
      <rect x={cam.x} y={cam.y} width={cam.w} height={cam.h} rx={cam.rx} ry={cam.ry} fill="#1f1f22" />
      {cam.circles.map((p, i) =>
        p.kind === "lens" ? (
          <g key={i}>
            <circle cx={p.cx} cy={p.cy} r={p.r} fill="#3a3a3d" />
            <circle cx={p.cx} cy={p.cy} r={p.r * 0.72} fill="#08080c" />
            <circle cx={p.cx} cy={p.cy} r={p.r * 0.32} fill="#1b2440" />
          </g>
        ) : (
          <circle key={i} cx={p.cx} cy={p.cy} r={p.r} fill={p.kind === "flash" ? "#efe9d8" : "#2b2b2e"} />
        ),
      )}
    </svg>
  );
}
