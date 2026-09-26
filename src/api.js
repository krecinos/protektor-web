// Cliente de la API de Protektor.
//
// Todo va contra el MISMO origen (/api/v2/...): el bundle se sirve desde
// app.protektor.com.gt/v2/, así que el navegador manda la cookie PHPSESSID de
// la sesión que el GUI legacy ya creó. Por eso NO hay ninguna clave aquí: un
// SPA no puede guardar un secreto, se lo entregamos al usuario junto con el JS.

const BASE = "/api/v2";

export class ApiError extends Error {
  constructor(status, detail) {
    super(detail || `Error ${status}`);
    this.status = status;
    this.detail = detail;
  }
}

async function request(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    credentials: "include", // manda la cookie de sesión
    headers: {
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let detail = null;
    try {
      detail = (await res.json())?.detail;
    } catch {
      /* respuesta sin cuerpo JSON */
    }
    throw new ApiError(res.status, detail);
  }
  return res.json();
}

const get = (path) => request("GET", path);
const patch = (path, body) => request("PATCH", path, body);

export const api = {
  // Gestión de citas y leads del bot (solo administradores).
  appointments: (params = "") => get(`/chat/appointments?limit=500${params}`),
  updateAppointment: (id, body) => patch(`/chat/appointments/${id}`, body),
  appointmentHistory: (id) => get(`/chat/appointments/${id}/followups`),
  leads: (params = "") => get(`/chat/leads?limit=500${params}`),
  updateLead: (id, body) => patch(`/chat/leads/${id}`, body),
  leadHistory: (id) => get(`/chat/leads/${id}/followups`),

  whoami: () => get("/auth/whoami"),
  devices: (limit = 500) => get(`/fleet/devices?limit=${limit}`),
  positions: () => get("/fleet/positions"),
  maintenanceStatus: () => get("/maintenance/status"),
  distance: (deviceId, start, end) =>
    get(
      `/fleet/devices/${deviceId}/distance` +
        `?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
    ),
};

const isoDay = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;

/** Rango [inicio, fin] en el formato que espera la API (naive, hora local). */
export function dateRange(days) {
  const end = new Date();
  const start = new Date(end.getTime() - days * 86400000);
  return [`${isoDay(start)}T00:00:00`, `${isoDay(end)}T23:59:59`];
}

/**
 * Completa con 0 los días sin recorrido.
 *
 * La API agrupa por fecha, así que un día sin movimiento simplemente no viene.
 * Si se grafican tal cual, los puntos quedan equiespaciados por índice y una
 * semana sin actividad se ve igual que un día: el eje temporal miente. Rellenar
 * es lo que hace que la distancia horizontal signifique tiempo real.
 */
export function fillMissingDays(rows, days) {
  const byDay = new Map(rows.map((r) => [r.day, r.km]));
  const out = [];
  let cumulative = 0;
  const today = new Date();
  for (let i = days; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400000);
    const key = isoDay(d);
    const km = byDay.get(key) ?? 0;
    cumulative += km;
    out.push({ day: key, km, cumulative_km: Math.round(cumulative * 100) / 100 });
  }
  return out;
}
