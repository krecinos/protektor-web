import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError } from "../api";
import DetailPanel from "./DetailPanel";
import { APPT_STATUS, ContactLine, LEAD_STATUS, StatusBadge, fmtDate } from "./shared";

// Administración > Leads y Citas: gestión de lo que agenda y captura el bot.
// Solo administradores (la API responde 403 a cualquier otro rol).

const APPT_FILTERS = [
  { key: "open", label: "Pendientes", params: "&open=true" },
  { key: "all", label: "Todas", params: "" },
  { key: "done", label: "Atendidas", params: "&status=done" },
  { key: "cancelled", label: "Canceladas", params: "&status=cancelled" },
];
const LEAD_FILTERS = [
  { key: "all", label: "Todos", params: "" },
  { key: "new", label: "Nuevos", params: "&status=new" },
  { key: "contacted", label: "Contactados", params: "&status=contacted" },
  { key: "won", label: "Ganados", params: "&status=won" },
  { key: "lost", label: "Perdidos", params: "&status=lost" },
];

function Tile({ label, value, foot }) {
  return (
    <div className="card tile">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {foot ? <div className="foot">{foot}</div> : null}
    </div>
  );
}

function LastNote({ count, note }) {
  if (!count) return <span className="muted">—</span>;
  return (
    <span title={note || ""}>
      <span className="pill">{count}</span> {note ? <span className="clip">{note}</span> : null}
    </span>
  );
}

export default function LeadsApp() {
  const [tab, setTab] = useState("appointments");
  const [apptFilter, setApptFilter] = useState("open");
  const [leadFilter, setLeadFilter] = useState("all");
  const [appts, setAppts] = useState([]);
  const [leads, setLeads] = useState([]);
  const [summary, setSummary] = useState({ open: [], leadsNew: 0 });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  // {kind, id, snapshot}: el snapshot mantiene abierto el panel aunque el
  // registro salga del filtro actual (p. ej. al marcar atendida en "Pendientes").
  const [selected, setSelected] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      const af = APPT_FILTERS.find((f) => f.key === apptFilter);
      const lf = LEAD_FILTERS.find((f) => f.key === leadFilter);
      const [a, l, open, newLeads] = await Promise.all([
        api.appointments(af.params),
        api.leads(lf.params),
        api.appointments("&open=true"),
        api.leads("&status=new"),
      ]);
      setAppts(a);
      setLeads(l);
      setSummary({ open, leadsNew: newLeads.length });
      setError(null);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [apptFilter, leadFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const kpis = useMemo(() => {
    const now = Date.now();
    const porConfirmar = summary.open.filter((a) => a.status === "requested").length;
    const proximas = summary.open.filter(
      (a) => a.status === "confirmed" && a.requested_at && new Date(a.requested_at).getTime() >= now,
    ).length;
    const vencidas = summary.open.filter(
      (a) => a.requested_at && new Date(a.requested_at).getTime() < now,
    ).length;
    return { porConfirmar, proximas, vencidas };
  }, [summary]);

  // Casilla "Atendida": marcar = done; desmarcar = vuelve a confirmada.
  async function toggleDone(appt) {
    setBusyId(appt.id);
    try {
      const updated = await api.updateAppointment(appt.id, {
        status: appt.status === "done" ? "confirmed" : "done",
      });
      // Si esa cita está abierta en el panel, que refleje el nuevo estado.
      setSelected((cur) =>
        cur && cur.kind === "appointment" && cur.id === appt.id
          ? { ...cur, snapshot: { ...cur.snapshot, ...updated } }
          : cur,
      );
      await load();
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <div className="app">
        <p className="skeleton">Cargando…</p>
      </div>
    );
  }

  if (error) {
    const status = error instanceof ApiError ? error.status : 0;
    return (
      <div className="app">
        <div className="error">
          <strong>
            {status === 401
              ? "Sesión no válida"
              : status === 403
                ? "Sección solo para administradores"
                : "No se pudo cargar la información"}
          </strong>
          <p style={{ marginBottom: 0, color: "var(--text-secondary)", fontSize: 14 }}>
            {status === 401 ? (
              <>
                Inicia sesión en <a href="/gui/login">el sistema</a> y vuelve a esta página.
              </>
            ) : status === 403 ? (
              "Tu usuario no tiene permiso para gestionar leads y citas."
            ) : (
              error.detail || error.message
            )}
          </p>
        </div>
      </div>
    );
  }

  const rows = tab === "appointments" ? appts : leads;
  const selectedItem = selected
    ? ((selected.kind === "appointment" ? appts : leads).find((x) => x.id === selected.id) ??
      selected.snapshot)
    : null;

  return (
    <div className="app leads">
      <a className="back" href="/gui/home/index">
        ← Volver al sistema
      </a>
      <header className="topbar">
        <h1>Leads y Citas</h1>
        <div className="who">Lo que agenda y captura el asistente del sitio</div>
      </header>

      <div className="grid-tiles">
        <Tile label="Citas por confirmar" value={kpis.porConfirmar} foot="solicitadas por el bot" />
        <Tile label="Confirmadas próximas" value={kpis.proximas} foot="con fecha por venir" />
        <Tile
          label="Pendientes con fecha pasada"
          value={kpis.vencidas}
          foot={kpis.vencidas ? "márcalas como atendidas o reagéndalas" : "todo al día"}
        />
        <Tile label="Leads nuevos" value={summary.leadsNew} foot="sin contactar todavía" />
      </div>

      <div className="tabs" role="tablist">
        <button
          role="tab"
          aria-selected={tab === "appointments"}
          onClick={() => {
            setTab("appointments");
            setSelected(null);
          }}
        >
          Citas
        </button>
        <button
          role="tab"
          aria-selected={tab === "leads"}
          onClick={() => {
            setTab("leads");
            setSelected(null);
          }}
        >
          Leads
        </button>
      </div>

      <div className="toolbar">
        {(tab === "appointments" ? APPT_FILTERS : LEAD_FILTERS).map((f) => (
          <button
            key={f.key}
            aria-pressed={(tab === "appointments" ? apptFilter : leadFilter) === f.key}
            onClick={() => {
              (tab === "appointments" ? setApptFilter : setLeadFilter)(f.key);
              setSelected(null);
            }}
          >
            {f.label}
          </button>
        ))}
        <span className="muted small">{rows.length} registro{rows.length === 1 ? "" : "s"}</span>
      </div>

      <div className={`split ${selectedItem ? "with-panel" : ""}`}>
        <div className="card table-card">
          {rows.length === 0 ? (
            <p className="muted small" style={{ margin: 0 }}>
              No hay registros con este filtro.
            </p>
          ) : tab === "appointments" ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th className="check">Atendida</th>
                    <th>Fecha</th>
                    <th>Cliente</th>
                    <th>Contacto</th>
                    <th>Detalle</th>
                    <th>Estado</th>
                    <th>Seguimiento</th>
                  </tr>
                </thead>
                <tbody>
                  {appts.map((a) => (
                    <tr
                      key={a.id}
                      className={`clickable ${selected?.id === a.id && selected.kind === "appointment" ? "sel" : ""}`}
                      onClick={() => setSelected({ kind: "appointment", id: a.id, snapshot: a })}
                    >
                      <td className="check" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          aria-label={`Marcar la cita de ${a.name} como atendida`}
                          checked={a.status === "done"}
                          disabled={busyId === a.id || a.status === "cancelled"}
                          onChange={() => toggleDone(a)}
                        />
                      </td>
                      <td className="strong nowrap">
                        {fmtDate(a.requested_at) ?? <span className="muted">Por definir</span>}
                      </td>
                      <td>
                        <div className="strong-inline">{a.name}</div>
                        <div className="muted small">
                          {a.kind === "cliente" ? "Cliente" : "Prospecto"}
                          {a.company ? ` · ${a.company}` : ""}
                        </div>
                      </td>
                      <td>
                        <ContactLine phone={a.phone} email={a.email} />
                      </td>
                      <td className="clip-cell" data-label="Detalle">{a.topic || "—"}</td>
                      <td className="nowrap">
                        <StatusBadge status={a.status} map={APPT_STATUS} />
                      </td>
                      <td className="clip-cell" data-label="Seguimiento">
                        <LastNote count={a.followups} note={a.last_note} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Recibido</th>
                    <th>Nombre</th>
                    <th>Contacto</th>
                    <th>Flota</th>
                    <th>Estado</th>
                    <th>Seguimiento</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((l) => (
                    <tr
                      key={l.id}
                      className={`clickable ${selected?.id === l.id && selected.kind === "lead" ? "sel" : ""}`}
                      onClick={() => setSelected({ kind: "lead", id: l.id, snapshot: l })}
                    >
                      <td className="nowrap">{fmtDate(l.created_at, { withDay: false })}</td>
                      <td>
                        <div className="strong-inline">{l.name}</div>
                        <div className="muted small">{l.company || ""}</div>
                      </td>
                      <td>
                        <ContactLine phone={l.phone} email={l.email} />
                      </td>
                      <td data-label="Flota">{l.fleet_size || "—"}</td>
                      <td className="nowrap">
                        <StatusBadge status={l.status} map={LEAD_STATUS} />
                      </td>
                      <td className="clip-cell" data-label="Seguimiento">
                        <LastNote count={l.followups} note={l.last_note} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {selectedItem ? (
          <DetailPanel
            kind={selected.kind}
            item={selectedItem}
            onClose={() => setSelected(null)}
            onChanged={(updated) => {
              setSelected((cur) => cur && { ...cur, snapshot: { ...cur.snapshot, ...updated } });
              load();
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
