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

async function request(method, path, body, signal) {
  if (import.meta.env.DEV && import.meta.env.VITE_MOCK === "1") {
    const { mockRequest } = await import("./dev/fixtures");
    return mockRequest(path, signal);
  }
  const res = await fetch(`${BASE}${path}`, {
    method,
    signal,
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

const get = (path, signal) => request("GET", path, undefined, signal);
const patch = (path, body) => request("PATCH", path, body);

export const api = {
  mcp: () => get("/admin/mcp"),
  updateMcp: (enabled) => patch("/admin/mcp", { enabled }),
  updateMcpTools: (names, enabled) => patch("/admin/mcp/tools", { names, enabled }),
  revealMcpToken: () => get("/admin/mcp/token"),
  rotateMcpToken: () => request("POST", "/admin/mcp/token"),
  mcpAudit: (tool = "") => get(`/admin/mcp/audit?limit=50${tool ? `&tool=${encodeURIComponent(tool)}` : ""}`),

  // Gestión de citas y leads del bot (solo administradores).
  appointments: (params = "") => get(`/chat/appointments?limit=500${params}`),
  updateAppointment: (id, body) => patch(`/chat/appointments/${id}`, body),
  appointmentHistory: (id) => get(`/chat/appointments/${id}/followups`),
  leads: (params = "") => get(`/chat/leads?limit=500${params}`),
  updateLead: (id, body) => patch(`/chat/leads/${id}`, body),
  leadHistory: (id) => get(`/chat/leads/${id}/followups`),

  whoami: (signal) => get("/auth/whoami", signal),
  navigation: () => get("/auth/navigation"),
  // `status`: 1 = solo activos (el mapa no debe mostrar vehiculos dados de baja).
  devices: (limit = 500, status) =>
    get(`/fleet/devices?limit=${limit}${status != null ? `&status=${status}` : ""}`),
  allActiveDevices: async (signal) => {
    const items = [];
    let total = Infinity;
    while (items.length < total) {
      const page = await get(`/fleet/devices?limit=500&status=1&offset=${items.length}`, signal);
      total = page.total;
      if (!page.items.length && items.length < total) throw new Error("Catálogo incompleto; vuelve a intentar.");
      items.push(...page.items);
    }
    return [...new Map(items.map(d => [d.id, d])).values()];
  },
  fleetSummary: () => get("/fleet/summary"),
  accountBalance: () => get("/account/balance"),
  positions: (signal) => get("/fleet/positions", signal),
  maintenanceStatus: (signal) => get("/maintenance/status", signal),
  distance: (deviceId, start, end, signal) =>
    get(
      `/fleet/devices/${deviceId}/distance` +
        `?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`, signal,
    ),
};

const isoDay = (d) => new Date(d.getTime() - 6 * 3600000).toISOString().slice(0, 10);

/** Días calendario de Guatemala, incluyendo hoy. */
export function dateRange(days, now = new Date()) {
  return [`${isoDay(new Date(now.getTime() - (days - 1) * 86400000))}T00:00:00`, `${isoDay(now)}T23:59:59`];
}
export function fillMissingDays(rows, days, now = new Date()) {
  const byDay = new Map(rows.map(r => [r.day, Number(r.km)]));
  return Array.from({ length: days }, (_, i) => {
    const day = isoDay(new Date(now.getTime() - (days - 1 - i) * 86400000));
    return { day, km: byDay.get(day) ?? 0 };
  });
}
