import { useEffect, useMemo, useRef, useState } from "react";

// Kilometraje diario de un vehículo.
//
// Forma: el dato es cambio-en-el-tiempo con una sola serie → línea.
// Una serie no lleva caja de leyenda: el título la nombra.
// Capa de hover por defecto (crosshair + tooltip), como cualquier gráfico HTML.
// Marcas finas: línea de 2px, punto activo de 9px con anillo de superficie.

const PAD = { top: 16, right: 16, bottom: 26, left: 44 };
const H = 220;

// Pasos 1/2/5/10 a propósito: con 2.5 los ticks salen redondeados a 3, 5, 8 y
// parecen arbitrarios. Estos siempre caen en números que se leen de un vistazo.
function niceTicks(max, count = 4) {
  if (max <= 0) return [0, 1];
  const raw = max / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? mag * 10;
  // El tope se REDONDEA HACIA ARRIBA al siguiente paso: si el último tick
  // quedara por debajo del máximo, la línea se dibujaría fuera del área del
  // gráfico y el pico aparecería recortado.
  const top = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = 0; v <= top + step * 1e-6; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return ticks;
}

const fmtDay = (iso) => {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
};

export default function DistanceChart({ data, title, subtitle }) {
  const wrapRef = useRef(null);
  const [width, setWidth] = useState(720);
  const [hover, setHover] = useState(null);

  // Ancho responsivo sin dependencias externas.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { pts, ticks, maxY, innerW, innerH } = useMemo(() => {
    const innerW = Math.max(240, width - PAD.left - PAD.right);
    const innerH = H - PAD.top - PAD.bottom;
    const maxRaw = Math.max(1, ...data.map((d) => d.km));
    const ticks = niceTicks(maxRaw);
    const maxY = ticks[ticks.length - 1] || 1;
    const stepX = data.length > 1 ? innerW / (data.length - 1) : 0;
    const pts = data.map((d, i) => ({
      ...d,
      x: PAD.left + i * stepX,
      y: PAD.top + innerH - (d.km / maxY) * innerH,
    }));
    return { pts, ticks, maxY, innerW, innerH };
  }, [data, width]);

  if (!data.length) {
    return (
      <div className="card section">
        <h2>{title}</h2>
        <p className="skeleton">Sin recorridos registrados en este período.</p>
      </div>
    );
  }

  const line = pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area =
    `${line} L${pts[pts.length - 1].x.toFixed(1)},${(PAD.top + innerH).toFixed(1)}` +
    ` L${pts[0].x.toFixed(1)},${(PAD.top + innerH).toFixed(1)} Z`;

  // El pico se etiqueta directo; el resto vive en el hover. Nunca un número
  // sobre cada punto.
  const peak = pts.reduce((a, b) => (b.km > a.km ? b : a), pts[0]);

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    let best = pts[0];
    for (const p of pts) if (Math.abs(p.x - x) < Math.abs(best.x - x)) best = p;
    setHover(best);
  };

  return (
    <div className="card section" ref={wrapRef}>
      <h2>
        {title}
        {subtitle ? <span className="sub">{subtitle}</span> : null}
      </h2>
      <svg
        width="100%"
        height={H}
        viewBox={`0 0 ${width} ${H}`}
        role="img"
        aria-label={`${title}. Máximo ${Math.round(peak.km)} kilómetros el ${fmtDay(peak.day)}.`}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        style={{ display: "block", touchAction: "none" }}
      >
        {/* Rejilla recesiva */}
        {ticks.map((t) => {
          const y = PAD.top + innerH - (t / maxY) * innerH;
          return (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={PAD.left + innerW}
                y1={y}
                y2={y}
                stroke="var(--grid)"
                strokeWidth="1"
              />
              <text x={PAD.left - 8} y={y + 4} textAnchor="end" fontSize="10" fill="var(--text-muted)">
                {t >= 1000 ? `${(t / 1000).toFixed(1)}k` : Math.round(t)}
              </text>
            </g>
          );
        })}

        <line
          x1={PAD.left}
          x2={PAD.left + innerW}
          y1={PAD.top + innerH}
          y2={PAD.top + innerH}
          stroke="var(--axis)"
          strokeWidth="1"
        />

        <path d={area} fill="var(--series-1-soft)" opacity="0.35" />
        <path d={line} fill="none" stroke="var(--series-1)" strokeWidth="2" strokeLinejoin="round" />

        {/* Etiqueta directa solo del pico */}
        <text
          x={Math.min(peak.x, PAD.left + innerW - 28)}
          y={Math.max(peak.y - 9, 12)}
          textAnchor="middle"
          fontSize="11"
          fontWeight="600"
          fill="var(--text-primary)"
        >
          {Math.round(peak.km)}
        </text>

        {/* Fechas: primera, última y el pico; no todas, para no amontonar */}
        {[pts[0], peak, pts[pts.length - 1]].map((p, i) => (
          <text
            key={`${p.day}-${i}`}
            x={p.x}
            y={H - 8}
            textAnchor={i === 0 ? "start" : i === 2 ? "end" : "middle"}
            fontSize="10"
            fill="var(--text-muted)"
          >
            {fmtDay(p.day)}
          </text>
        ))}

        {hover ? (
          <g pointerEvents="none">
            <line
              x1={hover.x}
              x2={hover.x}
              y1={PAD.top}
              y2={PAD.top + innerH}
              stroke="var(--axis)"
              strokeWidth="1"
            />
            {/* Anillo de superficie: separa la marca del fondo */}
            <circle cx={hover.x} cy={hover.y} r="5.5" fill="var(--series-1)" stroke="var(--surface-1)" strokeWidth="2" />
          </g>
        ) : null}
      </svg>

      <div className="muted" style={{ fontSize: 12, minHeight: 18, marginTop: 4 }}>
        {hover
          ? `${fmtDay(hover.day)} · ${Math.round(hover.km)} km · acumulado ${Math.round(hover.cumulative_km)} km`
          : "Pasa el cursor sobre la línea para ver el detalle diario."}
      </div>
    </div>
  );
}
