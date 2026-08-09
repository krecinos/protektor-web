// Tabla de flota: además de ser útil por sí sola, es la "vista de tabla" que
// el gráfico necesita para que la información no dependa solo del color.

const STATUS_LABEL = {
  good: "Al día",
  soon: "Próximo",
  overdue: "Vencido",
  unknown: "Sin datos",
};

// El estado se comunica con punto de color + texto. Nunca color solo.
function StatusBadge({ state }) {
  return (
    <span className={`status ${state}`}>
      <span className="dot" aria-hidden="true" />
      {STATUS_LABEL[state] ?? state}
    </span>
  );
}

function worstStatus(services) {
  if (!services?.length) return "unknown";
  if (services.some((s) => s.status === "overdue")) return "overdue";
  if (services.some((s) => s.status === "soon")) return "soon";
  if (services.some((s) => s.status === "ok")) return "good";
  return "unknown";
}

const fmtWhen = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `hace ${hrs} h`;
  return `hace ${Math.round(hrs / 24)} d`;
};

export default function FleetTable({ devices, positions, maintenance, onSelect, selectedId }) {
  const posById = new Map(positions.map((p) => [p.device_id, p]));
  const maintById = new Map(maintenance.map((m) => [m.device_id, worstStatus(m.services)]));

  return (
    <div className="card section">
      <h2>
        Flota
        <span className="sub">{devices.length} vehículos</span>
      </h2>
      <div style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>Vehículo</th>
              <th>Placa</th>
              <th>Último reporte</th>
              <th className="num">Velocidad</th>
              <th>Mantenimiento</th>
            </tr>
          </thead>
          <tbody>
            {devices.map((d) => {
              const p = posById.get(d.id);
              const isSel = d.id === selectedId;
              return (
                <tr
                  key={d.id}
                  onClick={() => onSelect(d.id)}
                  style={{
                    cursor: "pointer",
                    background: isSel ? "var(--series-1-soft)" : undefined,
                  }}
                >
                  <td className="strong">{d.friendly_name?.trim() || d.name?.trim() || `#${d.id}`}</td>
                  <td>{d.v_plate?.trim() || "—"}</td>
                  <td>{fmtWhen(p?.date)}</td>
                  <td className="num">{p?.speed != null ? `${Math.round(Number(p.speed))} km/h` : "—"}</td>
                  <td>
                    <StatusBadge state={maintById.get(d.id) ?? "unknown"} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>
        Tocá una fila para ver su kilometraje diario.
      </p>
    </div>
  );
}
