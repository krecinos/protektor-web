import { useEffect, useMemo, useRef, useState } from "react";
import VehicleSheet from "./VehicleSheet";
import AppShell from "../components/AppShell";
import { api } from "../api";
import { loadGoogleMaps } from "../lib/googleMaps";
import { ageLabel, batteryClass, coverageLabel, joinFleet, STATES } from "./fleet";
import { infoContent } from "./infoWindow";
import { clusterIcon, markerIcon } from "./markerIcon";

function Highlight({ text, query }) {
  const index = text.toLocaleLowerCase("es").indexOf(query.toLocaleLowerCase("es"));
  if (!query || index < 0) return text;
  return <>{text.slice(0, index)}<mark>{text.slice(index, index + query.length)}</mark>{text.slice(index + query.length)}</>;
}

export default function LiveMap() {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia("(max-width: 767px)").matches);
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
  const clusters = useRef([]);
  const recluster = useRef(null);
  const info = useRef(null);
  const infoVehicle = useRef(null);
  const fitted = useRef(false);
  const selectRef = useRef(null);
  const panelToggle = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const change = () => setIsMobile(media.matches);
    change();
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);

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

  function showMarker(vehicle, isSelected) {
    let marker = markers.current.get(vehicle.id);
    if (!marker) {
      marker = new maps.Marker();
      marker.addListener("click", () => selectRef.current(vehicle.id));
      markers.current.set(vehicle.id, marker);
    }
    marker.setOptions({
      map: mapRef.current,
      position: vehicle.point,
      title: `${vehicle.name} · ${vehicle.plate}`,
      zIndex: isSelected ? 1000000 : 0,
      icon: { url: markerIcon(STATES[vehicle.state].color, isSelected), scaledSize: new maps.Size(34, 42), anchor: new maps.Point(17, 39) },
    });
    return marker;
  }

  function select(id) {
    const vehicle = fleet.find((v) => v.id === id);
    setSelectedId(id);
    setPanelOpen(false);
    if (panelOpen) panelToggle.current?.focus();
    if (!vehicle?.point || !mapRef.current || !info.current) return;
    // El vehículo puede no tener pin todavía si estaba agrupado o fuera de pantalla.
    const anchor = showMarker(vehicle, true);
    mapRef.current.panTo(vehicle.point);
    if (mapRef.current.getZoom() < 16) mapRef.current.setZoom(16);
    if (isMobile) {
      info.current.close();
      infoVehicle.current = null;
      return;
    }
    info.current.setOptions({ headerContent: document.createTextNode(vehicle.name), content: infoContent(vehicle, Date.now()) });
    infoVehicle.current = vehicle;
    info.current.setOptions({ disableAutoPan: false });
    info.current.open({ map: mapRef.current, anchor, shouldFocus: false });
  }
  selectRef.current = select;

  useEffect(() => {
    if (!maps || loading || unauthorized || !host.current) return;
    const map = new maps.Map(host.current, { center: { lat: 14.6349, lng: -90.5069 }, zoom: 8, mapTypeControl: false, streetViewControl: false, fullscreenControl: false });
    mapRef.current = map;
    info.current = new maps.InfoWindow({ disableAutoPan: true, maxWidth: 280 });
    const close = info.current.addListener("closeclick", () => setSelectedId(null));
    const idle = map.addListener("idle", () => recluster.current?.());
    const projectionChanged = map.addListener("projection_changed", () => recluster.current?.());
    return () => {
      idle.remove();
      projectionChanged.remove();
      recluster.current = null;
      close.remove();
      info.current.close();
      info.current = null;
      infoVehicle.current = null;
      for (const marker of markers.current.values()) { maps.event.clearInstanceListeners(marker); marker.setMap(null); }
      markers.current.clear();
      for (const marker of clusters.current) { maps.event.clearInstanceListeners(marker); marker.setMap(null); }
      clusters.current = [];
      maps.event.clearInstanceListeners(map);
      mapRef.current = null;
      fitted.current = false;
    };
  }, [maps, loading, unauthorized]);

  useEffect(() => {
    if (!maps || !mapRef.current) return;
    const map = mapRef.current;
    const bounds = new maps.LatLngBounds();
    const positioned = fleet.filter((vehicle) => vehicle.point);
    for (const vehicle of positioned) bounds.extend(vehicle.point);
    // Solo el primer conjunto de posiciones ajusta la vista del usuario.
    if (!fitted.current && positioned.length) { map.fitBounds(bounds, 48); fitted.current = true; }

    function updateClusters() {
      const projection = map.getProjection();
      const center = map.getCenter();
      const zoom = map.getZoom();
      // La proyección no está disponible hasta que Google Maps termina de inicializar.
      if (!projection || !center || zoom == null) return;
      const scale = 2 ** zoom;
      const worldCenter = projection.fromLatLngToPoint(center);
      const width = map.getDiv().clientWidth;
      const height = map.getDiv().clientHeight;
      const cells = new Map();
      const individuals = new Map();
      for (const vehicle of positioned) {
        if (vehicle.id === selectedId) { individuals.set(vehicle.id, vehicle); continue; }
        const world = projection.fromLatLngToPoint(new maps.LatLng(vehicle.point));
        // Elegimos la copia del mundo más cercana al centro al cruzar el antimeridiano.
        const dx = ((world.x - worldCenter.x + 128) % 256 + 256) % 256 - 128;
        const x = dx * scale + width / 2;
        const y = (world.y - worldCenter.y) * scale + height / 2;
        if (x < -64 || x > width + 64 || y < -64 || y > height + 64) continue;
        const key = `${Math.floor(x / 64)}:${Math.floor(y / 64)}`;
        if (!cells.has(key)) cells.set(key, []);
        cells.get(key).push({ vehicle, x, y });
      }
      for (const marker of clusters.current) { maps.event.clearInstanceListeners(marker); marker.setMap(null); }
      clusters.current = [];
      const theme = getComputedStyle(map.getDiv());
      const fill = theme.getPropertyValue("--action-primary").trim() || "#1f6feb";
      const foreground = theme.getPropertyValue("--on-primary").trim() || "#ffffff";
      for (const members of cells.values()) {
        if (members.length === 1) {
          const vehicle = members[0].vehicle;
          individuals.set(vehicle.id, vehicle);
          continue;
        }
        const x = members.reduce((sum, member) => sum + member.x, 0) / members.length;
        const y = members.reduce((sum, member) => sum + member.y, 0) / members.length;
        const position = projection.fromPointToLatLng(new maps.Point(worldCenter.x + (x - width / 2) / scale, worldCenter.y + (y - height / 2) / scale));
        const { url, size } = clusterIcon(members.length, fill, foreground);
        const marker = new maps.Marker({
          map, position, title: `${members.length} vehículos`, zIndex: 100000,
          icon: { url, scaledSize: new maps.Size(size, size), anchor: new maps.Point(size / 2, size / 2) },
        });
        marker.addListener("click", () => {
          const memberBounds = new maps.LatLngBounds();
          for (const { vehicle } of members) memberBounds.extend(vehicle.point);
          // Los puntos casi coincidentes necesitan un acercamiento limitado, no un ajuste extremo.
          const spreadX = Math.max(...members.map((m) => m.x)) - Math.min(...members.map((m) => m.x));
          const spreadY = Math.max(...members.map((m) => m.y)) - Math.min(...members.map((m) => m.y));
          if (Math.max(spreadX, spreadY) < 8) {
            map.panTo(position);
            map.setZoom(Math.max(map.getZoom(), Math.min(18, map.getZoom() + 3)));
          } else map.fitBounds(memberBounds, 64);
        });
        clusters.current.push(marker);
      }
      for (const vehicle of individuals.values()) showMarker(vehicle, vehicle.id === selectedId);
      // Reutilizamos los pines que siguen visibles; liberamos los demás para acotar la memoria.
      for (const [id, marker] of markers.current) {
        if (!individuals.has(id)) { maps.event.clearInstanceListeners(marker); marker.setMap(null); markers.current.delete(id); }
      }
    }
    recluster.current = updateClusters;
    updateClusters();
    if (!isMobile && selected?.point) {
      // La apertura ajusta la tarjeta; solo los nuevos datos se refrescan sin mover la vista.
      if (infoVehicle.current !== selected) {
        info.current.setOptions({ disableAutoPan: true, headerContent: document.createTextNode(selected.name), content: infoContent(selected, now) });
        infoVehicle.current = selected;
      }
    } else { info.current.close(); infoVehicle.current = null; }
  }, [fleet, maps, loading, unauthorized, selectedId, selected, now, isMobile]);

  useEffect(() => {
    if (selectedId != null && !selected) setSelectedId(null);
  }, [selectedId, selected]);

  useEffect(() => {
    if (isMobile) {
      info.current?.close();
      infoVehicle.current = null;
      if (selectedId != null) setPanelOpen(false);
    } else if (selected?.point && info.current && mapRef.current) {
      info.current.setOptions({ disableAutoPan: true, headerContent: document.createTextNode(selected.name), content: infoContent(selected, now) });
      infoVehicle.current = selected;
      info.current.open({ map: mapRef.current, anchor: markers.current.get(selected.id), shouldFocus: false });
    }
    // Solo el cambio de formato reabre la tarjeta; los refrescos conservan la vista.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile]);

  useEffect(() => {
    if (panelOpen) searchRef.current?.focus();
  }, [panelOpen]);

  return <AppShell me={me} active="map">
    {unauthorized ? <div className="app"><div className="error">Inicia sesión en <a href="/gui/login">el sistema</a></div></div> : loading ? <div className="app"><p className="skeleton">Cargando mapa…</p></div> :
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
            <div className="toolbar map-filters">{[["all", "Todos"], ["online", "En línea"], ["offline", "Fuera de línea"]].map(([key, label]) => <button key={key} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}</button>)}</div>
          </div>
          <div className="map-list">
            {!fleet.some((v) => v.point) && <p className="map-empty">No hay vehículos con posición</p>}
            {fleet.length > 0 && !filtered.length && <p className="map-empty">No hay vehículos que coincidan con tu búsqueda.</p>}
            {filtered.map((vehicle) => <button key={vehicle.id} className="map-vehicle" aria-pressed={selectedId === vehicle.id} onClick={() => select(vehicle.id)} style={{ "--vehicle-color": STATES[vehicle.state].color }}>
              <span className="map-vehicle-name"><span className="map-dot" aria-hidden="true" /><strong><Highlight text={vehicle.name} query={search} /></strong></span>
              <span className="map-vehicle-plate"><Highlight text={vehicle.plate} query={search} /></span>
              {vehicle.description && <span>{vehicle.description}</span>}
              <span className="map-status map-badge">{STATES[vehicle.state].label}</span>
              {vehicle.battery != null && <span className={batteryClass(vehicle.battery)}>Batería {vehicle.battery}%</span>}
              {coverageLabel(vehicle, now) && <span>{coverageLabel(vehicle, now)}</span>}
              <span>{ageLabel(vehicle.time, now)} · {vehicle.speed}</span>
              <span className="map-location" title={vehicle.location}>{vehicle.location}</span>
              {!vehicle.point && <span>Sin posición válida</span>}
            </button>)}
          </div>
        </aside>
      </div>}
    {isMobile && selected && !unauthorized && <VehicleSheet key={selected.id} vehicle={selected} now={now} onClose={() => { setSelectedId(null); panelToggle.current?.focus(); }} />}
  </AppShell>;
}
