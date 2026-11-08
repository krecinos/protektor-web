import { useCallback, useMemo, useState } from 'react';
import AppShell from './components/AppShell';
import FleetTable from './components/FleetTable';
import DistanceChart from './components/DistanceChart';
import useFleet from './components/Dashboard/useFleet';
import { joinFleet, matches, STATES, exact } from './components/Dashboard/model';
export default function App() {
  const { data, loading, refreshing, error, now, updated, refresh } = useFleet();
  const [filter, setFilter] = useState('all'), [selectedId, setSelectedId] = useState(null), [expired, setExpired] = useState(false);
  const expire = useCallback(() => setExpired(true), []);
  const units = useMemo(() => joinFleet(data?.devices ?? [], data?.positions ?? [], data?.maintenance, now), [data, now]);
  const selected = units.find(u => u.id === selectedId);
  const session = expired || error?.status === 401;
  const kpis = [['all', 'Total de unidades', 'Activas en el catálogo'], ...Object.entries(STATES).filter(([key]) => key !== 'unknown' || units.some(u => u.state === key)).map(([key, label]) => [key, label, key === 'stale' ? '>24 h o sin fecha válida' : key === 'unknown' ? 'Telemetría insuficiente' : 'Según último reporte']), ['overdue', 'Mant. vencido', 'Unidades con servicio vencido'], ['soon', 'Mant. próximo', 'Próximo según API (≤15 días)']];
  return <AppShell me={session ? null : data?.me} active="fleet"><div className="app fleet-dashboard">
    <header className="fleet-heading"><div><p className="fleet-eyebrow">OPERACIÓN / RESUMEN</p><h1>Tablero de flota</h1><p className="muted">Estado de tus unidades y prioridades de atención.</p></div><div className="fleet-refresh"><button disabled={refreshing} onClick={refresh}>{refreshing ? 'Actualizando…' : 'Actualizar'}</button><small title={exact(updated)}>{updated ? `Actualizado ${new Intl.DateTimeFormat('es-GT', { timeZone: 'America/Guatemala', timeStyle: 'short' }).format(updated)} · GT` : 'Refresco cada 60 s'}<br />Se pausa al ocultar la pestaña</small></div></header>
    {session ? <div className="error" role="alert"><h2>Tu sesión ha expirado</h2><p>Inicia sesión para volver a consultar tu flota.</p><a href="/gui/login">Iniciar sesión</a></div> : loading ? <div aria-label="Cargando tablero" role="status"><div className="fleet-kpis">{Array.from({ length: 7 }, (_, i) => <div key={i} className="card sk" />)}</div><div className="card sk tall" /></div> : <>
      {error && <div className="error" role="alert"><strong>{data ? 'No se pudo actualizar. Se muestran los últimos datos recibidos.' : 'No se pudo cargar el tablero.'}</strong><p>Revisa la conexión e intenta nuevamente.</p><button onClick={refresh}>Reintentar</button></div>}
      {data && <>{data.maintenance === null && <div className="error" role="alert">Mantenimiento no disponible; sus indicadores no representan cero. <button onClick={refresh}>Reintentar</button></div>}
      <div className="fleet-kpis">{kpis.map(([key, label, description]) => <button key={key} className={`card fleet-kpi ${key}`} data-testid={`kpi-${key}`} aria-pressed={filter === key} title={description} onClick={() => { setFilter(key); }}><span>{label}</span><strong>{['overdue', 'soon'].includes(key) && data.maintenance === null ? '—' : units.filter(u => matches(u, key)).length}</strong><small>{description}</small></button>)}</div>
      <FleetTable units={units} filter={filter} setFilter={setFilter} now={now} selectedId={selectedId} onSelect={setSelectedId} />
      {selected ? <DistanceChart key={selected.id} unit={selected} onSessionExpired={expire} /> : units.length > 0 && <p className="fleet-hint">Selecciona «Km» en una unidad para consultar su distancia diaria.</p>}
      <p className="fleet-hint">Los estados operativos suman el total. Mantenimiento cuenta unidades, puede coincidir con cualquier estado y una unidad puede tener servicios vencidos y próximos.</p></>}
    </>}
  </div></AppShell>;
}
