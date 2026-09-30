import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ageLabel, batteryClass, coverageLabel, reportLabel, STATES } from "./fleet";
import { copyCoordinates } from "./infoWindow";

export default function VehicleSheet({ vehicle, now, onClose }) {
  const sheet = useRef(null);
  const grabber = useRef(null);
  const drag = useRef(null);
  const suppressClick = useRef(false);
  const [expanded, setExpanded] = useState(false);
  const [offset, setOffset] = useState(null);
  const [peek, setPeek] = useState(0);
  const [feedback, setFeedback] = useState("");
  const state = STATES[vehicle.state];
  const coverage = coverageLabel(vehicle, now);
  const coords = vehicle.point ? `${vehicle.point.lat},${vehicle.point.lng}` : null;

  useLayoutEffect(() => {
    const measure = () => {
      const node = sheet.current;
      const safe = parseFloat(getComputedStyle(node).paddingBottom) || 0;
      setPeek(Math.max(0, node.offsetHeight - 150 - safe));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(sheet.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => { grabber.current?.focus({ preventScroll: true }); }, []);

  function start(event) {
    if (!event.isPrimary || event.button !== 0 || event.target.closest(".sheet-close")) return;
    const current = new DOMMatrixReadOnly(getComputedStyle(sheet.current).transform).m42;
    drag.current = { id: event.pointerId, startY: event.clientY, startOffset: current, y: event.clientY, time: event.timeStamp, velocity: 0, moved: false };
    suppressClick.current = false;
    (event.target.closest(".sheet-grabber") || event.currentTarget).setPointerCapture(event.pointerId);
    setOffset(current);
  }

  function move(event) {
    const gesture = drag.current;
    if (!gesture || gesture.id !== event.pointerId) return;
    const elapsed = event.timeStamp - gesture.time;
    if (elapsed > 0) gesture.velocity = (event.clientY - gesture.y) / elapsed;
    gesture.y = event.clientY;
    gesture.time = event.timeStamp;
    gesture.moved ||= Math.abs(event.clientY - gesture.startY) > 5;
    setOffset(Math.max(0, Math.min(sheet.current.offsetHeight, gesture.startOffset + event.clientY - gesture.startY)));
  }

  function finish(event, cancelled = false) {
    const gesture = drag.current;
    if (!gesture || gesture.id !== event.pointerId) return;
    drag.current = null;
    suppressClick.current = gesture.moved;
    setOffset(null);
    if (cancelled || !gesture.moved) return;
    const position = Math.max(0, gesture.startOffset + event.clientY - gesture.startY);
    // Proyectamos brevemente la velocidad para que un gesto rápido alcance el anclaje esperado.
    const velocity = event.timeStamp - gesture.time < 100 ? gesture.velocity : 0;
    const projected = position + velocity * 160;
    if (position > peek + 45 || (position > peek + 12 && velocity > 0.5)) { onClose(); return; }
    setExpanded(projected < peek / 2);
  }

  async function copy() {
    try { await copyCoordinates(coords); setFeedback("Copiado"); }
    catch { setFeedback("No se pudo copiar. Selecciona las coordenadas para copiarlas."); }
  }

  return <section ref={sheet} className={`sheet-root${offset != null ? " sheet-dragging" : ""}`} role="dialog" aria-label={`Vehículo: ${vehicle.name}`}
    style={{ transform: `translateY(${offset ?? (expanded ? 0 : peek)}px)`, "--vehicle-color": state.color }}
    onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); onClose(); } }}>
    <header className="sheet-header" onPointerDown={start} onPointerMove={move} onPointerUp={finish} onPointerCancel={(event) => finish(event, true)} onLostPointerCapture={(event) => finish(event, true)}>
      <button ref={grabber} type="button" className="sheet-grabber" aria-label="Arrastrar" aria-expanded={expanded} onClick={(event) => {
        if (event.detail !== 0 && suppressClick.current) { suppressClick.current = false; return; }
        setExpanded((value) => !value);
      }}><span /></button>
      <button type="button" className="sheet-close" aria-label="Cerrar datos del vehículo" onClick={onClose}>×</button>
      <div className="sheet-title"><h2 title={vehicle.name}>{vehicle.name}</h2><span className="map-status map-badge">{state.label}</span></div>
      <p className="sheet-summary">{ageLabel(vehicle.time, now)} · {vehicle.speed}</p>
      <p className="sheet-location" title={vehicle.location}>{vehicle.location}</p>
    </header>
    <div className="sheet-body" hidden={!expanded && offset == null}>
      <p>Velocidad: {vehicle.speed}</p>
      {(vehicle.ignition === 1 || vehicle.ignition === 0) && <p>Motor: {vehicle.ignition === 1 ? "Encendido" : "Apagado"}</p>}
      <p>Último reporte: {reportLabel(vehicle.time, now)}</p>
      <p>{vehicle.location}</p>
      <p className="sheet-secondary">{coords || "Sin posición válida"}</p>
      {vehicle.battery != null && <p className={batteryClass(vehicle.battery)}>Batería {vehicle.battery}%</p>}
      {vehicle.description && <p className="sheet-secondary">{vehicle.description}</p>}
      {coverage && <p className="sheet-secondary">{coverage}</p>}
      <div className="sheet-actions">
        {coords && <><a href={`https://waze.com/ul?ll=${coords}&navigate=yes`} target="_blank" rel="noopener">Waze</a>
          <a href={`https://www.google.com/maps/search/?api=1&query=${coords}`} target="_blank" rel="noopener">Google Maps</a>
          <button type="button" onClick={copy}>Copiar coordenadas</button></>}
        <a href={`/gui/monitor/routes/${encodeURIComponent(vehicle.id)}`}>Ver rutas</a>
      </div>
      <p role="status">{feedback}</p>
    </div>
  </section>;
}
