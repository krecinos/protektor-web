import { useState } from "react";
import Icon from "../components/Icon";
import { ageLabel, batteryClass, coverageLabel, STATES } from "./fleet";
import { vehicleActions } from "./vehicleActions";
import { copyCoordinates } from "./infoWindow";

export default function VehicleCard({ vehicle, now, capabilities, selected, onSelect, onClose }) {
  const [feedback, setFeedback] = useState("");
  const details = vehicleActions(vehicle, capabilities);
  const coords = vehicle.point && `${vehicle.point.lat},${vehicle.point.lng}`;
  const coverage = coverageLabel(vehicle, now);
  const location = [vehicle.description, vehicle.location, !vehicle.point && "Sin posición válida"].filter(Boolean).join(" · ");
  const actions = [...details.actions.filter((a) => !["pencil", "crosshair"].includes(a.icon)),
    ...(coords ? [
      { label: "Waze", icon: "navigation", href: `https://waze.com/ul?ll=${coords}&navigate=yes`, target: "_blank" },
      { label: "Google Maps", icon: "map", href: `https://www.google.com/maps/search/?api=1&query=${coords}`, target: "_blank" },
    ] : []),
    { label: "Ver rutas", icon: "route", href: `/gui/monitor/routes/${encodeURIComponent(vehicle.id)}` },
    ...(coords ? [{ label: "Copiar coordenadas", icon: "copy" }] : []),
    ...details.actions.filter((a) => ["pencil", "crosshair"].includes(a.icon))];
  return <article className={`vehicle-card${selected ? " is-selected" : ""}`} style={{ "--vehicle-color": STATES[vehicle.state].color }} onClick={onSelect}>
    <div className="vehicle-card-heading">
      <span className="map-dot" title={STATES[vehicle.state].label} role="img" aria-label={STATES[vehicle.state].label} />
      <button type="button" className="vehicle-card-name" onClick={(e) => { e.stopPropagation(); onSelect?.(); }} title={`${vehicle.name} · ${vehicle.plate}`} aria-label={`Centrar ${vehicle.name}, ${vehicle.plate}`}><strong>{vehicle.name}</strong> <span>{vehicle.plate}</span></button>
      <span className="vehicle-card-time">{ageLabel(vehicle.time, now)}<br />{vehicle.speed}</span>
      {onClose && <button className="vehicle-card-close" aria-label="Cerrar vehículo" onClick={(e) => { e.stopPropagation(); onClose(); }}><Icon name="x" size={18} /></button>}
    </div>
    <p className="vehicle-card-location" title={location}>{location}</p>
    <div className="vehicle-card-tags">
      {details.mode && <span>{details.mode.replace("Modo actual:", "Modo")}</span>}
      {vehicle.ignition != null && <span>Motor {vehicle.ignition === 1 ? "encendido" : "apagado"}</span>}
      {vehicle.battery != null && <span className={batteryClass(vehicle.battery)}>Batería {vehicle.battery}%</span>}
      {coverage && <span title={coverage}>Sin cobertura {Math.floor((now - vehicle.time) / 3600000)} h</span>}
    </div>
    <div className="vehicle-card-actions" onClick={(e) => e.stopPropagation()}>
      {actions.map((action) => {
        const props = { title: action.label, "aria-label": action.label, className: action.warning ? "is-warning" : action.icon === "play" ? "is-success" : undefined };
        return action.href ? <a key={action.label} {...props} href={action.href} target={action.target} rel={action.target ? "noopener" : undefined}><Icon name={action.icon} size={18} /></a> : <button key={action.label} {...props} type="button" onClick={async () => {
          try { await copyCoordinates(coords); setFeedback("Coordenadas copiadas"); }
          catch { setFeedback(`No se pudo copiar: ${coords}`); }
        }}><Icon name={action.icon} size={18} /></button>;
      })}
    </div>
    {details.technical && <p className="vehicle-card-technical" title={details.technical}>{details.technical}</p>}
    <span className="vehicle-card-feedback" role="status">{feedback}</span>
  </article>;
}
