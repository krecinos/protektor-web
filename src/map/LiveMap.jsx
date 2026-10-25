import { useNavigation } from "../components/navigation";
import { BalanceBanner, MapKpis } from "./MapNotices";
import Icon from "../components/Icon";
import { useEffect, useMemo, useRef, useState } from "react";
import VehicleCard from "./VehicleCard";
import { createPortal } from "react-dom";
import AppShell from "../components/AppShell";
import { api } from "../api";
import { loadGoogleMaps } from "../lib/googleMaps";
import { joinFleet, STATES } from "./fleet";
import { clusterIcon, markerIcon } from "./markerIcon";
import { DARK_MAP_STYLE } from "./darkMapStyle";
import { getTheme } from "../lib/theme";

export default function LiveMap() {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia("(max-width: 767px)").matches);
  const [me, setMe] = useState(null);
  const navigation = useNavigation(me);
  const capabilities = navigation?.capabilities;
  const [summary, setSummary] = useState(null);
  const [balance, setBalance] = useState(null);
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
  const [infoNode] = useState(() => document.createElement("div"));
  const cardRefs = useRef(new Map());
  const infoVehicle = useRef(null);
  const infoCapabilities = useRef(null);
  const balanceRequest = useRef(null);
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
    async function refresh(key, fetcher, setter, optional = false) {
      if (pending.has(key)) return;
      pending.add(key);
      try {
        const result = await fetcher();
        if (alive) { setter(result); setFailures((prev) => ({ ...prev, [key]: false })); }
      } catch (error) {
        if (alive) {
          if (error.status === 401) setUnauthorized(true);
          if (optional && error.status === 404) { setter(null); return; }
          if (!optional) setFailures((prev) => ({ ...prev, [key]: true }));
        }
      } finally { pending.delete(key); }
    }
    const getDevices = () => refresh("devices", () => api.devices(500, 1), (value) => setDevices(value.items ?? []));
    const getPositions = () => refresh("positions", api.positions, (value) => setPositions(value ?? []));
    const getMe = () => refresh("me", api.whoami, setMe);
    const getSummary = () => refresh("summary", api.fleetSummary, setSummary, true);
    refresh("balance", () => {
      balanceRequest.current ??= api.accountBalance();
      return balanceRequest.current;
    }, setBalance, true);
    getSummary();
    Promise.all([getMe(), getDevices(), getPositions()]).finally(() => { if (alive) setLoading(false); });
    const positionsTimer = setInterval(() => { getPositions(); getSummary(); setNow(Date.now()); }, 60000);
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
      marker.addListener("click", () => selectRef.current(vehicle.id, true));
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

  function select(id, fromPin = false) {
    if (fromPin) { setQuery(""); setFilter("all"); }
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
    info.current.setOptions({ headerDisabled: true, content: infoNode });
    infoVehicle.current = vehicle;
    infoCapabilities.current = capabilities;
    info.current.setOptions({ disableAutoPan: false });
    info.current.open({ map: mapRef.current, anchor, shouldFocus: false });
  }
  selectRef.current = select;

  useEffect(() => {
    if (!maps || loading || unauthorized || !host.current) return;
    const map = new maps.Map(host.current, { center: { lat: 14.6349, lng: -90.5069 }, zoom: 8, mapTypeControl: false, streetViewControl: false, fullscreenControl: false, styles: getTheme() === "dark" ? DARK_MAP_STYLE : null });
    const onTheme = (event) => map.setOptions({ styles: event.detail === "dark" ? DARK_MAP_STYLE : null });
    window.addEventListener("protektor:theme", onTheme);
    mapRef.current = map;
    info.current = new maps.InfoWindow({ disableAutoPan: true, maxWidth: 440 });
    const close = info.current.addListener("closeclick", () => setSelectedId(null));
    const idle = map.addListener("idle", () => recluster.current?.());
    const projectionChanged = map.addListener("projection_changed", () => recluster.current?.());
    return () => {
      window.removeEventListener("protektor:theme", onTheme);
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
      if (infoVehicle.current !== selected || infoCapabilities.current !== capabilities) {
        info.current.setOptions({ disableAutoPan: true, headerDisabled: true, content: infoNode });
        infoVehicle.current = selected;
        infoCapabilities.current = capabilities;
      }
    } else { info.current.close(); infoVehicle.current = null; }
  }, [fleet, maps, loading, unauthorized, selectedId, selected, now, isMobile, capabilities]);

  useEffect(() => {
    if (selectedId != null && !selected) setSelectedId(null);
  }, [selectedId, selected]);

  useEffect(() => {
    if (isMobile) {
      info.current?.close();
      infoVehicle.current = null;
      if (selectedId != null) setPanelOpen(false);
    } else if (selected?.point && info.current && mapRef.current) {
      info.current.setOptions({ disableAutoPan: true, headerDisabled: true, content: infoNode });
      infoVehicle.current = selected;
      infoCapabilities.current = capabilities;
      info.current.open({ map: mapRef.current, anchor: markers.current.get(selected.id), shouldFocus: false });
    }
    // Solo el cambio de formato reabre la tarjeta; los refrescos conservan la vista.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile]);

  useEffect(() => {
    if (panelOpen) searchRef.current?.focus();
  }, [panelOpen]);

  useEffect(() => {
    if (!isMobile && selectedId) cardRefs.current.get(selectedId)?.scrollIntoView({ block: "nearest" });
  }, [selectedId, query, filter, isMobile]);

  const controls = <div className="map-list-header">
    <div className="map-search-row">
      <label className="map-search"><Icon name="search" size={18} /><input ref={searchRef} aria-label="Buscar por nombre o placa" type="search" value={query} onChange={(event) => { setQuery(event.target.value); if (isMobile) setPanelOpen(true); }} placeholder="Nombre o placa" /></label>
      {isMobile && <button ref={panelToggle} className="map-view-toggle" aria-controls="map-vehicles" aria-expanded={panelOpen} onClick={() => setPanelOpen(!panelOpen)}>{panelOpen ? "Mapa" : "Lista"}</button>}
    </div>
    <div className="toolbar map-filters">{[["all", "Todos"], ["online", "En línea"], ["offline", "Fuera de línea"]].map(([key, label]) => <button key={key} aria-pressed={filter === key} onClick={() => { setFilter(key); if (isMobile) setPanelOpen(true); }}>{label}</button>)}</div>
    <small>{fleet.length - offline} en línea · {offline} fuera de línea</small>
  </div>;

  return <AppShell me={me} active="map">
    {unauthorized ? <div className="app"><div className="error">Inicia sesión en <a href="/gui/login">el sistema</a></div></div> : loading ? <div className="app"><p className="skeleton">Cargando mapa…</p></div> :
      <div className="live-map-layout">
        {isMobile && <>{controls}<MapKpis summary={summary} /><BalanceBanner balance={balance} /></>}
        <div className="live-map-page">
          <section className="live-map-canvas" aria-label="Mapa en vivo" aria-hidden={isMobile && panelOpen}>
            <div ref={host} className="live-map-host" />
            {(!maps || mapError) && <p className="map-notice" role="status">{mapError || "Cargando mapa…"}</p>}
            {Object.values(failures).some(Boolean) && <p className="map-notice map-offline" role="status">Sin conexión, reintentando…</p>}
            {isMobile && selected && !panelOpen && <div className="map-floating-card" onKeyDown={(e) => { if (e.key === "Escape") setSelectedId(null); }}><VehicleCard key={selected.id} vehicle={selected} now={now} capabilities={capabilities} onSelect={() => select(selected.id)} onClose={() => { setSelectedId(null); panelToggle.current?.focus(); }} /></div>}
          </section>
          <aside id="map-vehicles" className={`map-vehicles${panelOpen ? " is-open" : ""}`} aria-label="Vehículos" onKeyDown={(e) => { if (e.key === "Escape") { setPanelOpen(false); panelToggle.current?.focus(); } }}>
            {!isMobile && <>{controls}<MapKpis summary={summary} /><BalanceBanner balance={balance} /></>}
            <div className="map-list">
              {!fleet.some((v) => v.point) && <p className="map-empty">No hay vehículos con posición</p>}
              {fleet.length > 0 && !filtered.length && <p className="map-empty">No hay vehículos que coincidan con tu búsqueda.</p>}
              {filtered.map((vehicle) => <div key={vehicle.id} ref={(node) => { if (node) cardRefs.current.set(vehicle.id, node); else cardRefs.current.delete(vehicle.id); }}><VehicleCard vehicle={vehicle} now={now} capabilities={capabilities} selected={selectedId === vehicle.id} onSelect={() => select(vehicle.id)} /></div>)}
            </div>
          </aside>
        </div>
      </div>}
    {!isMobile && selected && createPortal(<VehicleCard key={selected.id} vehicle={selected} now={now} capabilities={capabilities} onSelect={() => select(selected.id)} onClose={() => { info.current?.close(); setSelectedId(null); }} />, infoNode)}
  </AppShell>;
}
