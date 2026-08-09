import { useEffect, useMemo, useState } from "react";
import { api, ApiError, dateRange, fillMissingDays } from "./api";
import DistanceChart from "./components/DistanceChart";
import FleetTable from "./components/FleetTable";

const RANGES = [
  { days: 7, label: "7 días" },
  { days: 14, label: "14 días" },
  { days: 30, label: "30 días" },
];

// Indicador: número solo, sin gráfico. Es la forma correcta cuando el dato es
// un titular, no una distribución.
function Tile({ label, value, unit, foot }) {
  return (
    <div className="card tile">
      <div className="label">{label}</div>
      <div className="value">
        {value}
        {unit ? <span className="unit">{unit}</span> : null}
      </div>
      {foot ? <div className="foot">{foot}</div> : null}
    </div>
  );
}

export default function App() {
  const [me, setMe] = useState(null);
  const [devices, setDevices] = useState([]);
  const [positions, setPositions] = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const [selectedId, setSelectedId] = useState(null);
  const [days, setDays] = useState(7);
  const [distance, setDistance] = useState([]);
  const [distLoading, setDistLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [who, devs, pos, maint] = await Promise.all([
          api.whoami(),
          api.devices(),
          api.positions(),
          api.maintenanceStatus(),
        ]);
        if (!alive) return;
        setMe(who);
        setDevices(devs.items ?? []);
        setPositions(pos ?? []);
        setMaintenance(maint ?? []);
        setSelectedId((devs.items ?? [])[0]?.id ?? null);
      } catch (e) {
        if (alive) setError(e);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (selectedId == null) return;
    let alive = true;
    setDistLoading(true);
    const [start, end] = dateRange(days);
    api
      .distance(selectedId, start, end)
      .then((d) => alive && setDistance(fillMissingDays(d ?? [], days)))
      .catch(() => alive && setDistance([]))
      .finally(() => alive && setDistLoading(false));
    return () => {
      alive = false;
    };
  }, [selectedId, days]);

  const kpis = useMemo(() => {
    const active = devices.filter((d) => d.status === 1).length;
    const cutoff = Date.now() - 24 * 3600 * 1000;
    const reporting = positions.filter((p) => p.date && new Date(p.date).getTime() > cutoff).length;
    const overdue = maintenance.filter((m) =>
      (m.services ?? []).some((s) => s.status === "overdue"),
    ).length;
    const totalKm = distance.reduce((sum, d) => sum + d.km, 0);
    return { active, reporting, overdue, totalKm };
  }, [devices, positions, maintenance, distance]);

  if (loading) {
    return (
      <div className="app">
        <p className="skeleton">Cargando tablero…</p>
      </div>
    );
  }

  if (error) {
    const noSession = error instanceof ApiError && error.status === 401;
    return (
      <div className="app">
        <div className="error">
          <strong>{noSession ? "Sesión no válida" : "No se pudo cargar el tablero"}</strong>
          <p style={{ marginBottom: 0, color: "var(--text-secondary)", fontSize: 14 }}>
            {noSession ? (
              <>
                Iniciá sesión en <a href="/gui/login">el sistema</a> y volvé a esta página.
              </>
            ) : (
              error.detail || error.message
            )}
          </p>
        </div>
      </div>
    );
  }

  const selected = devices.find((d) => d.id === selectedId);
  const selectedName = selected?.friendly_name?.trim() || selected?.name?.trim() || "vehículo";

  return (
    <div className="app">
      <header className="topbar">
        <h1>Tablero de flota</h1>
        <div className="who">
          {me?.company_name ?? "—"}
          {me?.role_name ? ` · ${me.role_name}` : ""}
        </div>
      </header>

      <div className="grid-tiles">
        <Tile label="Vehículos activos" value={kpis.active} foot={`${devices.length} en total`} />
        <Tile
          label="Reportando (24 h)"
          value={kpis.reporting}
          foot={
            kpis.active - kpis.reporting > 0
              ? `${kpis.active - kpis.reporting} sin reportar`
              : "toda la flota al día"
          }
        />
        <Tile label="Mantenimientos vencidos" value={kpis.overdue} foot="vehículos con servicio pendiente" />
        <Tile
          label={`Kilometraje (${days} d)`}
          value={Math.round(kpis.totalKm).toLocaleString("es-GT")}
          unit="km"
          foot={selected ? selectedName : "—"}
        />
      </div>

      {/* Filtros en una fila, arriba de los gráficos. */}
      <div className="toolbar">
        {RANGES.map((r) => (
          <button
            key={r.days}
            aria-pressed={days === r.days}
            onClick={() => setDays(r.days)}
          >
            {r.label}
          </button>
        ))}
        {distLoading ? <span className="muted" style={{ fontSize: 12 }}>actualizando…</span> : null}
      </div>

      <DistanceChart
        data={distance}
        title="Kilometraje diario"
        subtitle={selected ? selectedName : undefined}
      />

      <FleetTable
        devices={devices}
        positions={positions}
        maintenance={maintenance}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />
    </div>
  );
}
