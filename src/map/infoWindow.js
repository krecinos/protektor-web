import { batteryClass, coverageLabel, reportLabel, STATES } from "./fleet";

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

async function copyCoordinates(value) {
  try {
    if (navigator.clipboard) { await navigator.clipboard.writeText(value); return; }
  } catch { /* Algunos navegadores deniegan el portapapeles incluso en HTTPS. */ }
  const previous = document.activeElement;
  const input = element("textarea");
  input.value = value;
  input.style.cssText = "position:fixed;left:-9999px;top:0";
  document.body.appendChild(input);
  input.select();
  try {
    if (!document.execCommand("copy")) throw new Error("No se pudo copiar");
  } finally {
    input.remove();
    previous?.focus();
  }
}

export function infoContent(vehicle, now) {
  const content = element("div", "", "live-map-info");
  const state = STATES[vehicle.state];
  const badge = element("span", state.label, "map-status map-badge");
  badge.style.setProperty("--vehicle-color", state.color);
  content.append(badge);
  if (vehicle.description) content.append(element("p", vehicle.description));
  if (vehicle.battery != null) content.append(element("p", `Batería ${vehicle.battery}%`, batteryClass(vehicle.battery)));
  const coverage = coverageLabel(vehicle, now);
  if (coverage) content.append(element("p", coverage));
  for (const [label, value] of [["Velocidad", vehicle.speed], ["Último reporte", reportLabel(vehicle.time, now)], ["Ubicación", vehicle.location], ["Coordenadas", `${vehicle.point.lat}, ${vehicle.point.lng}`]]) {
    const row = element("p");
    row.append(element("strong", `${label}: `), document.createTextNode(value));
    content.append(row);
  }
  const actions = element("div", "", "map-info-actions");
  const coords = `${vehicle.point.lat},${vehicle.point.lng}`;
  for (const [label, url] of [["Waze", `https://waze.com/ul?ll=${coords}&navigate=yes`], ["Google Maps", `https://www.google.com/maps/search/?api=1&query=${coords}`]]) {
    const link = element("a", label);
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener";
    actions.append(link);
  }
  const copy = element("button", "Copiar coordenadas");
  copy.type = "button";
  const feedback = element("span", "", "map-copy-feedback");
  feedback.setAttribute("role", "status");
  copy.onclick = async () => {
    try { await copyCoordinates(coords); feedback.textContent = "Coordenadas copiadas"; }
    catch { feedback.textContent = "No se pudo copiar. Selecciona las coordenadas para copiarlas."; }
  };
  const routes = element("a", "Ver rutas");
  routes.href = `/gui/monitor/routes/${encodeURIComponent(vehicle.id)}`;
  actions.append(copy, routes);
  content.append(actions, feedback);
  return content;
}
