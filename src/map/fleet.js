const HOUR = 3600000;
export const STATES = {
  on: { label: "Encendido", color: "#0ca30c", order: 0 },
  off: { label: "Apagado", color: "#8a8f94", order: 1 },
  offline: { label: "Fuera de línea", color: "#ff5b57", order: 2 },
};

export function reportTime(value) {
  // La fecha sin zona pertenece siempre a Guatemala, independientemente del navegador.
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(value)) return NaN;
  return Date.parse(`${value.replace(" ", "T")}-06:00`);
}

export function ageLabel(time, now) {
  if (!Number.isFinite(time)) return "Sin reporte";
  const minutes = Math.max(0, Math.floor((now - time) / 60000));
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `hace ${days} ${days === 1 ? "día" : "días"}`;
}

export function reportLabel(time, now) {
  if (!Number.isFinite(time)) return "Sin reporte";
  const date = new Date(time - 6 * HOUR);
  const pad = (n) => String(n).padStart(2, "0");
  return `${ageLabel(time, now)} · ${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}/${date.getUTCFullYear()} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

export function joinFleet(devices, positions, now) {
  const byId = new Map(positions.map((p) => [String(p.device_id), p]));
  return devices.map((device) => {
    const position = byId.get(String(device.id));
    const time = reportTime(position?.date);
    const state = !Number.isFinite(time) || now - time > HOUR ? "offline" : Number(device.ignition) === 1 ? "on" : "off";
    const lat = Number(position?.latitude);
    const lng = Number(position?.longitude);
    const valid = position && [position.latitude, position.longitude].every((v) => v != null && String(v).trim() !== "") && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
    return {
      id: String(device.id), name: device.friendly_name?.trim() || device.name || "Vehículo",
      plate: device.v_plate || position?.v_plate || "Sin placa", state, time,
      point: valid ? { lat, lng } : null,
      speed: position?.speed != null && Number.isFinite(Number(position.speed)) ? `${Math.round(Number(position.speed))} km/h` : "Sin velocidad",
      location: position?.location || "Sin ubicación",
    };
  }).sort((a, b) => STATES[a.state].order - STATES[b.state].order || a.name.localeCompare(b.name, "es"));
}
