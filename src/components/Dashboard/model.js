export const STATES = { moving: 'En movimiento', idle: 'Detenidas encendidas', off: 'Apagadas', stale: 'Sin reportar', unknown: 'Estado desconocido' };
// Etiqueta por unidad (singular) para la fila de la tabla; STATES es la del KPI/filtro.
export const STATE_LABEL = { moving: 'En movimiento', idle: 'Detenida encendida', off: 'Apagada', stale: 'Sin reportar', unknown: 'Estado desconocido' };
export const MAINT = { overdue: 'Vencido', soon: 'Próximo', ok: 'Al día', unknown: 'Sin datos' };
export function reportTime(value) {
  if (!value) return NaN;
  const text = String(value).replace(' ', 'T');
  return Date.parse(/[zZ]|[+-]\d\d:\d\d$/.test(text) ? text : `${text}-06:00`);
}
export function relative(time, now) {
  if (!Number.isFinite(time)) return 'Sin reporte válido';
  if (time > now + 60000) return 'Fecha futura';
  const mins = Math.max(0, Math.floor((now - time) / 60000));
  if (mins < 60) return `hace ${mins} min`;
  if (mins < 1440) return `hace ${Math.floor(mins / 60)} h`;
  const days = Math.floor(mins / 1440);
  return `hace ${days} ${days === 1 ? "día" : "días"}`;
}
export const exact = (time) => Number.isFinite(time) ? `${new Intl.DateTimeFormat('es-GT', { timeZone: 'America/Guatemala', dateStyle: 'medium', timeStyle: 'medium' }).format(time)} · Guatemala (UTC−6)` : 'Sin fecha válida';
const numeric = (v) => v != null && String(v).trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null;
export function joinFleet(devices, positions, maintenance, now) {
  const pos = new Map(positions.map(p => [String(p.device_id), p]));
  const maint = new Map((maintenance ?? []).map(m => [String(m.device_id), m.services ?? []]));
  return devices.filter(d => d.status === 1).map(d => {
    const p = pos.get(String(d.id));
    const time = reportTime(p?.date), speed = numeric(p?.speed), battery = numeric(d.battery);
    const validReport = Number.isFinite(time) && now - time <= 86400000 && time <= now + 60000;
    const ignition = validReport && (d.ignition === 0 || d.ignition === 1) ? d.ignition : null;
    const state = !Number.isFinite(time) || now - time > 86400000 ? 'stale' : time > now + 60000 ? 'unknown' : speed > 0 ? 'moving' : speed === 0 && ignition === 1 ? 'idle' : ignition === 0 ? 'off' : 'unknown';
    const services = maint.get(String(d.id)) ?? [];
    const maintenanceState = ['overdue', 'soon'].find(s => services.some(v => v.status === s)) ?? (services.length && services.every(s => s.status === 'ok') ? 'ok' : 'unknown');
    return { id: d.id, name: d.friendly_name?.trim() || d.name?.trim() || `Unidad ${d.id}`, plate: d.v_plate?.trim() || 'Sin placa', time, speed: speed >= 0 ? speed : null, ignition, battery: battery >= 0 && battery <= 100 ? battery : null, state, maintenance: maintenanceState, overdue: services.some(s => s.status === 'overdue'), soon: services.some(s => s.status === 'soon') };
  });
}
export const matches = (unit, filter) => filter === 'all' || (filter === 'overdue' || filter === 'soon' ? unit[filter] : unit.state === filter);
