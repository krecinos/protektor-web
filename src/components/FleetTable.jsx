import { useEffect, useMemo, useState } from 'react';
import { STATES, STATE_LABEL, MAINT, relative, exact, matches } from './Dashboard/model';
export default function FleetTable({ units, filter, setFilter, now, selectedId, onSelect }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState({ key: 'name', direction: 1 });
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [filter]);
  const rows = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('es');
    return units.filter(u => matches(u, filter) && `${u.name} ${u.plate}`.toLocaleLowerCase('es').includes(term)).sort((a, b) => {
      const x = a[sort.key], y = b[sort.key];
      if (x == null || Number.isNaN(x)) return y == null || Number.isNaN(y) ? a.id - b.id : 1;
      if (y == null || Number.isNaN(y)) return -1;
      return (typeof x === 'number' ? x - y : String(x).localeCompare(String(y), 'es', { numeric: true })) * sort.direction || a.id - b.id;
    });
  }, [units, filter, query, sort]);
  const pages = Math.max(1, Math.ceil(rows.length / 25)), current = Math.min(page, pages - 1);
  const order = key => { setSort(s => ({ key, direction: s.key === key ? -s.direction : 1 })); setPage(0); };
  const columns = [['name', 'Unidad'], ['state', 'Estado'], ['time', 'Último reporte'], ['speed', 'Velocidad'], ['ignition', 'Ignición'], ['battery', 'Batería'], ['maintenance', 'Servicio']];
  return <section className="card fleet-list" aria-labelledby="fleet-title">
    <div className="fleet-heading"><h2 id="fleet-title">Unidades <span className="muted">({units.length})</span></h2><span role="status" data-testid="results">{rows.length} resultados</span></div>
    <div className="fleet-controls">
      <label>Buscar unidad<input type="search" placeholder="Nombre o placa" value={query} onChange={e => { setQuery(e.target.value); setPage(0); }} /></label>
      <label>Filtrar<select value={filter} onChange={e => { setFilter(e.target.value); setPage(0); }}><option value="all">Todas las unidades</option>{Object.entries(STATES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}<option value="overdue">Mantenimiento vencido</option><option value="soon">Mantenimiento próximo</option></select></label>
      <label className="fleet-mobile-sort">Ordenar<select value={`${sort.key}:${sort.direction}`} onChange={e => { const [key, direction] = e.target.value.split(':'); setSort({ key, direction: Number(direction) }); setPage(0); }}>{columns.flatMap(([key, label]) => [1, -1].map(direction => <option key={`${key}:${direction}`} value={`${key}:${direction}`}>{label} {direction === 1 ? '↑' : '↓'}</option>))}</select></label>
      <button onClick={() => { setFilter('all'); setQuery(''); setPage(0); }}>Limpiar filtros</button>
    </div>
    <p className="fleet-hint">Estado según el último reporte; sin reportar: más de 24 h o sin fecha válida. Horas de Guatemala.</p>
    {rows.length ? <><table className="fleet-table"><thead><tr>{columns.map(([key, label]) => <th key={key} scope="col" aria-sort={sort.key === key ? sort.direction === 1 ? 'ascending' : 'descending' : 'none'}><button onClick={() => order(key)}>{label}{sort.key === key ? sort.direction === 1 ? ' ↑' : ' ↓' : ''}</button></th>)}<th scope="col">Acciones</th></tr></thead>
    <tbody>{rows.slice(current * 25, current * 25 + 25).map(u => <tr key={u.id} className={selectedId === u.id ? 'sel' : ''}>
      <td data-label="Unidad"><strong>{u.name}</strong><small>{u.plate}</small></td>
      <td data-label="Estado"><span className={`fleet-status ${u.state}`}>{STATE_LABEL[u.state]}</span></td>
      <td data-label="Último reporte"><time title={exact(u.time)} dateTime={Number.isFinite(u.time) ? new Date(u.time).toISOString() : undefined}>{relative(u.time, now)}</time></td>
      <td data-label="Velocidad">{u.speed == null ? '—' : `${Math.round(u.speed)} km/h`}</td>
      <td data-label="Ignición">{u.ignition == null ? '—' : u.ignition ? 'Encendida' : 'Apagada'}</td>
      <td data-label="Batería">{u.battery == null ? '—' : `${u.battery}%`}</td>
      <td data-label="Servicio"><span className={`fleet-status ${u.maintenance}`}>{MAINT[u.maintenance]}</span>{u.overdue && u.soon && <small>También próximo</small>}</td>
      <td className="fleet-actions"><a href={`/v2/mapa?device=${encodeURIComponent(u.id)}`} aria-label={`Ver ${u.name} en mapa`}>Mapa</a><a href={`/gui/monitor/routes/${encodeURIComponent(u.id)}`} aria-label={`Ver rutas de ${u.name} en sistema clásico`}>Rutas ↗</a><button aria-pressed={selectedId === u.id} aria-label={`Ver distancia de ${u.name}`} onClick={() => onSelect(u.id)}>Km</button></td>
    </tr>)}</tbody></table><div className="fleet-pagination"><span>{current * 25 + 1}–{Math.min(rows.length, current * 25 + 25)} de {rows.length}</span><button disabled={current === 0} onClick={() => setPage(current - 1)}>Anterior</button><span>{current + 1} / {pages}</span><button disabled={current + 1 === pages} onClick={() => setPage(current + 1)}>Siguiente</button></div></> : <div className="fleet-empty"><h3>{units.length ? 'Sin coincidencias' : 'No hay unidades activas'}</h3><p>{units.length ? 'Prueba otro nombre, placa o estado.' : 'Las unidades activas aparecerán aquí cuando estén disponibles.'}</p></div>}
  </section>;
}
