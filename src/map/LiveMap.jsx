import { useEffect, useMemo, useRef, useState } from "react";
import AppShell from "../components/AppShell";
import { api } from "../api";
import { loadGoogleMaps } from "../lib/googleMaps";
import { ageLabel, joinFleet, STATES } from "./fleet";
import { infoContent } from "./infoWindow";

function Highlight({ text, query }) {
  const index = text.toLocaleLowerCase("es").indexOf(query.toLocaleLowerCase("es"));
  if (!query || index < 0) return text;
  return <>{text.slice(0, index)}<mark>{text.slice(index, index + query.length)}</mark>{text.slice(index + query.length)}</>;
}

export default function LiveMap() {
  const [me, setMe] = useState(null);
  const [devices, setDevices] = useState([]);
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [failures, setFailures] = useState({});
  const [now, setNow] = useState(Date.now);
  const [maps, setMaps] = useState(null);
  const [mapError, setMapError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [selectedId, setSelectedId] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const host = useRef(null);
  const mapRef = useRef(null);
  const markers = useRef(new Map());
  const info = useRef(null);
  const fitted = useRef(false);
  const selectRef = useRef(null);
  const panelToggle = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    let alive = true;
    const pending = new Set();
    async function refresh(key, fetcher, setter) {
      if (pending.has(key)) return;
      pending.add(key);
      try {
        const result = await fetcher();
        if (alive) { setter(result); setFailures((prev) => ({ ...prev, [key]: false })); }
      } catch (error) {
        if (alive) {
          if (error.status === 401) setUnauthorized(true);
          setFailures((prev) => ({ ...prev, [key]: true }));
        }
      } finally { pending.delete(key); }
    }
    const getDevices = () => refresh("devices", api.devices, (value) => setDevices(value.items ?? []));
    const getPositions = () => refresh("positions", api.positions, (value) => setPositions(value ?? []));
    const getMe = () => refresh("me", api.whoami, setMe);
    Promise.all([getMe(), getDevices(), getPositions()]).finally(() => { if (alive) setLoading(false); });
    const positionsTimer = setInterval(() => { getPositions(); setNow(Date.now()); }, 60000);
    const devicesTimer = setInterval(() => { getDevices(); getMe(); }, 300000);
    const clockTimer = setInterval(() => setNow(Date.now()), 15000);
    return () => { alive = false; clearInterval(positionsTimer); clearInterval(devicesTimer); clearInterval(clockTimer); };
  }, []);

  useEffect(() => {
    let alive = true;
    loadGoogleMaps().then((value) => { if (alive) setMaps(value); }).catch((error) => { if (alive) setMapError(error.message); });
    return () => { alive = false; };
  }, []);

  const fleet = useMemo(() => joinFleet(devices, positions, now), [devices, positions, now]);
  const search = query.trim();
  const filtered = fleet.filter((v) => (filter === "all" || v.state === filter) && `${v.name} ${v.plate}`.toLocaleLowerCase("es").includes(search.toLocaleLowerCase("es")));
  const offline = fleet.filter((v) => v.state === "offline").length;
  const selected = fleet.find((v) => v.id === selectedId);

  function select(id) {
    const vehicle = fleet.find((v) => v.id === id);
    setSelectedId(id);
    setPanelOpen(false);
    if (panelOpen) panelToggle.current?.focus();
    if (!vehicle?.point || !mapRef.current || !info.current) return;
    mapRef.current.panTo(vehicle.point);
    if (mapRef.current.getZoom() < 15) mapRef.current.setZoom(15);
    info.current.setOptions({ headerContent: document.createTextNode(vehicle.name), content: infoContent(vehicle, Date.now()) });
    info.current.open({ map: mapRef.current, anchor: markers.current.get(id), shouldFocus: false });
  }
  selectRef.current = select;

  useEffect(() => {
    if (!maps || loading || unauthorized || !host.current) return;
    const map = new maps.Map(host.current, { center: { lat: 14.6349, lng: -90.5069 }, zoom: 8, mapTypeControl: false, streetViewControl: false, fullscreenControl: false });
    mapRef.current = map;
    info.current = new maps.InfoWindow({ disableAutoPan: true, maxWidth: 320 });
    const close = info.current.addListener("closeclick", () => setSelectedId(null));
    return () => {
      close.remove();
      info.current.close();
      info.current = null;
      for (const marker of markers.current.values()) { maps.event.clearInstanceListeners(marker); marker.setMap(null); }
      markers.current.clear();
      maps.event.clearInstanceListeners(map);
      mapRef.current = null;
      fitted.current = false;
    };
  }, [maps, loading, unauthorized]);

  useEffect(() => {
    if (!maps || !mapRef.current) return;
    const validIds = new Set();
    const bounds = new maps.LatLngBounds();
    for (const vehicle of fleet) {
      if (!vehicle.point) continue;
      validIds.add(vehicle.id);
      let marker = markers.current.get(vehicle.id);
      if (!marker) {
        marker = new maps.Marker({ map: mapRef.current });
        marker.addListener("click", () => selectRef.current(vehicle.id));
        markers.current.set(vehicle.id, marker);
      }
      marker.setOptions({ position: vehicle.point, title: `${vehicle.name} · ${vehicle.plate}`, icon: { path: maps.SymbolPath.CIRCLE, scale: 7, fillColor: STATES[vehicle.state].color, fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2 } });
      bounds.extend(vehicle.point);
    }
    for (const [id, marker] of markers.current) {
      if (!validIds.has(id)) { maps.event.clearInstanceListeners(marker); marker.setMap(null); markers.current.delete(id); }
    }
    // Solo el primer conjunto de posiciones ajusta la vista del usuario.
    if (!fitted.current && validIds.size) { mapRef.current.fitBounds(bounds, 48); fitted.current = true; }
    if (selected?.point) {
      info.current.setOptions({ headerContent: document.createTextNode(selected.name), content: infoContent(selected, now) });
    } else { info.current.close(); }
  }, [fleet, maps, loading, selected, now]);

  useEffect(() => {
    if (panelOpen) searchRef.current?.focus();
  }, [panelOpen]);

  return <AppShell me={me} active="map">
    {unauthorized ? <div className="app"><div className="error">Inicia sesión en <a href="/gui/login">el sistema</a></div></div> : loading ? <div className="app"><p>Cargando mapa…</p></div> :
      <div className="live-map-page">
        <section className="live-map-canvas" aria-label="Mapa en vivo">
          <div ref={host} className="live-map-host" />
          {(!maps || mapError) && <p className="map-notice" role="status">{mapError || "Cargando mapa…"}</p>}
          {Object.values(failures).some(Boolean) && <p className="map-notice map-offline" role="status">Sin conexión, reintentando…</p>}
          <button ref={panelToggle} className="map-panel-toggle" aria-expanded={panelOpen} aria-controls="map-vehicles" onClick={() => setPanelOpen(!panelOpen)}>Vehículos ({fleet.length})</button>
        </section>
        <aside id="map-vehicles" className={`map-vehicles${panelOpen ? " is-open" : ""}`} aria-label="Vehículos" onKeyDown={(event) => { if (event.key === "Escape") { setPanelOpen(false); panelToggle.current?.focus(); } }}>
          <div className="map-list-header">
            <div className="map-list-title"><h1>Mapa en vivo</h1><button className="map-panel-close" onClick={() => { setPanelOpen(false); panelToggle.current?.focus(); }} aria-label="Cerrar lista de vehículos">Cerrar</button></div>
            <p>{fleet.length - offline} en línea · {offline} fuera de línea</p>
            <label htmlFor="vehicle-search">Buscar por nombre o placa</label>
            <input ref={searchRef} id="vehicle-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nombre o placa" />
            <div className="toolbar map-filters">{[["all", "Todos"], ["on", "Encendidos"], ["off", "Apagados"], ["offline", "Fuera de línea"]].map(([key, label]) => <button key={key} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}</button>)}</div>
          </div>
          <div className="map-list">
            {!fleet.some((v) => v.point) && <p className="map-empty">No hay vehículos con posición</p>}
            {fleet.length > 0 && !filtered.length && <p className="map-empty">No hay vehículos que coincidan con tu búsqueda.</p>}
            {filtered.map((vehicle) => <button key={vehicle.id} className="map-vehicle" aria-pressed={selectedId === vehicle.id} onClick={() => select(vehicle.id)} style={{ "--vehicle-color": STATES[vehicle.state].color }}>
              <span className="map-vehicle-name"><span className="map-dot" /><strong><Highlight text={vehicle.name} query={search} /></strong></span>
              <span className="map-vehicle-plate"><Highlight text={vehicle.plate} query={search} /></span>
              <span className="map-status">{STATES[vehicle.state].label}</span>
              <span>{ageLabel(vehicle.time, now)} · {vehicle.speed}</span>
              <span className="map-location" title={vehicle.location}>{vehicle.location}</span>
              {!vehicle.point && <span>Sin posición válida</span>}
            </button>)}
          </div>
        </aside>
      </div>}
  </AppShell>;
}
