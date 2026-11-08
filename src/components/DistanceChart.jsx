import { useEffect, useState } from 'react';
import { api, dateRange, fillMissingDays } from '../api';
export default function DistanceChart({ unit, onSessionExpired }) {
  const [days, setDays] = useState(7), [retry, setRetry] = useState(0);
  const [result, setResult] = useState({ loading: true, data: [] });
  useEffect(() => {
    const controller = new AbortController();
    let alive = true;
    const timeout = setTimeout(() => controller.abort(), 30000);
    const now = new Date(), range = dateRange(days, now);
    setResult({ loading: true, data: [] });
    api.distance(unit.id, ...range, controller.signal).then(rows => { if (alive) setResult({ data: fillMissingDays(rows, days, now), range }); }).catch(error => { if (alive) { setResult({ data: [], error }); if (error.status === 401) onSessionExpired(); } }).finally(() => clearTimeout(timeout));
    return () => { alive = false; clearTimeout(timeout); controller.abort(); };
  }, [unit.id, days, retry, onSessionExpired]);
  const max = Math.max(1, ...result.data.map(d => d.km));
  return <section className="card fleet-distance" aria-label="Distancia de la unidad seleccionada"><div className="fleet-heading"><h2>Distancia · {unit.name}</h2><label>Período <select value={days} onChange={e => setDays(Number(e.target.value))}>{[7, 14, 30].map(d => <option key={d} value={d}>{d} días</option>)}</select></label></div>
    {result.loading ? <div className="sk" role="status">Cargando distancia…</div> : result.error ? <p role="alert">No se pudo consultar la distancia. <button onClick={() => setRetry(v => v + 1)}>Reintentar</button></p> : <><p><strong>{result.data.reduce((sum, d) => sum + d.km, 0).toLocaleString('es-GT', { maximumFractionDigits: 1 })} km</strong> · {result.range[0].slice(0, 10)} al {result.range[1].slice(0, 10)} · Guatemala · hoy parcial</p><small>Escala: 0–{max.toLocaleString('es-GT')} km por día</small><div className="distance-bars" role="img" aria-label={`Distancia diaria en kilómetros de ${unit.name}; detalle disponible debajo.`}>{result.data.map(d => <div key={d.day} title={`${d.day}: ${d.km} km`}><span style={{ height: `${d.km / max * 100}%` }} /></div>)}</div><details><summary>Ver kilómetros por día</summary><ul className="distance-values">{result.data.map(d => <li key={d.day}>{d.day}: <strong>{d.km.toLocaleString('es-GT')} km</strong></li>)}</ul></details><small>Días sin recorrido devuelto por la API: 0 km.</small></>}
  </section>;
}
