// TABLERO_MOCK_ONLY_150: este módulo jamás debe aparecer en dist.
const stamp = (ms) => new Date(ms - 21600000).toISOString().slice(0, 19);
export async function mockRequest(path, signal) {
  await new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); };
    const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, 180);
    if (signal?.aborted) abort(); else signal?.addEventListener('abort', abort, { once: true });
  });
  const scenario = new URLSearchParams(location.search).get('scenario');
  if (scenario === 'session' || scenario === 'error' || (scenario === 'maintenance' && path.includes('/maintenance/')) || (scenario === 'distance' && path.includes('/distance'))) {
    const error = new Error('Fallo simulado de desarrollo'); error.status = scenario === 'session' ? 401 : 503; throw error;
  }
  const devices = Array.from({ length: scenario === 'empty' ? 0 : 150 }, (_, i) => ({ id: i + 1, status: 1, name: `Unidad ${String(i + 1).padStart(3, '0')}`, friendly_name: `${['Camión', 'Panel', 'Pickup', 'Reparto', 'Cabezal'][i % 5]} ${String(i + 1).padStart(3, '0')}`, v_plate: `C-${100 + i}BXT`, ignition: i % 6 === 2 ? 0 : i % 6 === 5 ? null : 1, battery: i % 7 === 0 ? null : i % 101 }));
  if (path.includes('/auth/whoami')) return { user_id: 99999, company_id: 99999, company_name: 'Flota demostración', role_name: 'Operador' };
  if (path.includes('/auth/navigation')) return { classic_href: '/gui/home/index', sections: [{ key: 'fleet', label: 'Tablero de flota', items: [{ key: 'fleet', label: 'Tablero de flota', href: '/v2/', v2: true }] }, { key: 'map', label: 'Mapa en vivo', items: [{ key: 'map', label: 'Mapa en vivo', href: '/v2/mapa', v2: true }] }] };
  if (path.includes('/fleet/devices?')) { const q = new URL(path, location.origin).searchParams; const offset = Number(q.get('offset')); return { items: devices.slice(offset, offset + Number(q.get('limit'))), total: devices.length }; }
  if (path === '/fleet/positions') return devices.filter((_, i) => i % 6 !== 4).map((d, i) => ({ device_id: d.id, date: stamp(Date.now() - (d.id % 6 === 4 ? 30 * 3600000 : (i % 45 + 1) * 60000)), speed: (d.id - 1) % 6 === 0 ? String(30 + i % 55) : '0' }));
  if (path === '/maintenance/status') return devices.map((d, i) => ({ device_id: d.id, services: i % 5 === 0 ? [] : [{ status: i % 7 === 0 ? 'overdue' : i % 3 === 0 ? 'soon' : 'ok' }, ...(i % 21 === 0 ? [{ status: 'soon' }] : [])] }));
  if (path.includes('/distance')) { const q = new URL(path, location.origin).searchParams; const start = Date.parse(`${q.get('start')}-06:00`), end = Date.parse(`${q.get('end')}-06:00`); return Array.from({ length: Math.round((end - start) / 86400000) }, (_, i) => ({ day: stamp(start + i * 86400000).slice(0, 10), km: Math.round((Math.sin(i + 1) + 1) * 65) })); }
  throw new Error(`Ruta mock no implementada: ${path}`);
}
