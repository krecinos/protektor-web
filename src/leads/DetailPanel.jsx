import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import {
  APPT_STATUS,
  ContactLine,
  History,
  LEAD_STATUS,
  StatusBadge,
  fmtDate,
  toInputValue,
} from "./shared";

// Panel de gestión de UNA cita o UN lead: estado, reagendar, comentar e
// historial. Cada acción es un PATCH que la API registra en chat_followup.
export default function DetailPanel({ kind, item, onClose, onChanged }) {
  const isAppt = kind === "appointment";
  const statusMap = isAppt ? APPT_STATUS : LEAD_STATUS;

  const [history, setHistory] = useState([]);
  const [histLoading, setHistLoading] = useState(true);
  const [note, setNote] = useState("");
  const [when, setWhen] = useState(toInputValue(item.requested_at));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const ref = useRef(null);

  const loadHistory = () => {
    setHistLoading(true);
    (isAppt ? api.appointmentHistory(item.id) : api.leadHistory(item.id))
      .then(setHistory)
      .catch(() => setHistory([]))
      .finally(() => setHistLoading(false));
  };

  useEffect(() => {
    setWhen(toInputValue(item.requested_at));
    setNote("");
    setMsg(null);
    loadHistory();
    // En pantallas angostas el panel queda debajo de la lista: llevarlo a la vista.
    if (window.innerWidth < 900) ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [item.id]);

  async function save(body, okText) {
    setBusy(true);
    setMsg(null);
    try {
      const updated = await (isAppt
        ? api.updateAppointment(item.id, body)
        : api.updateLead(item.id, body));
      setNote("");
      setMsg({ ok: true, text: okText });
      loadHistory();
      onChanged(updated);
    } catch (e) {
      setMsg({ ok: false, text: e.detail?.[0]?.msg || e.detail || e.message });
    } finally {
      setBusy(false);
    }
  }

  const reschedule = () => {
    if (!when) return;
    save(
      { requested_at: when, ...(note.trim() ? { note: note.trim() } : {}) },
      "Fecha actualizada",
    );
  };

  return (
    <aside className="card panel" aria-label="Detalle" ref={ref}>
      <div className="panel-head">
        <div>
          <h2>{item.name}</h2>
          <div className="muted small">
            {item.company || "Sin empresa"}
            {isAppt ? ` · ${item.kind === "cliente" ? "Cliente" : "Prospecto"}` : ""}
          </div>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Cerrar detalle">
          ×
        </button>
      </div>

      <ContactLine phone={item.phone} email={item.email} />

      <dl className="facts">
        {isAppt ? (
          <>
            <dt>Fecha</dt>
            <dd>
              {fmtDate(item.requested_at) ?? (
                <span className="muted">Por definir{item.requested_text ? ` — “${item.requested_text}”` : ""}</span>
              )}
            </dd>
            <dt>Detalle</dt>
            <dd>{item.topic || "—"}</dd>
          </>
        ) : (
          <>
            <dt>Flota</dt>
            <dd>{item.fleet_size || "—"}</dd>
            <dt>Necesita</dt>
            <dd>{item.notes || "—"}</dd>
          </>
        )}
        <dt>Estado</dt>
        <dd>
          <StatusBadge status={item.status} map={statusMap} />
        </dd>
      </dl>

      <div className="panel-section">
        <div className="label">Cambiar estado</div>
        <div className="seg">
          {Object.entries(statusMap).map(([key, s]) => (
            <button
              key={key}
              disabled={busy}
              aria-pressed={item.status === key}
              onClick={() => item.status !== key && save({ status: key }, `Marcada como ${s.label.toLowerCase()}`)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {isAppt ? (
        <div className="panel-section">
          <label className="label" htmlFor="pk-when">
            Reagendar
          </label>
          <div className="row">
            <input
              id="pk-when"
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
            />
            <button
              className="primary"
              disabled={busy || !when || when === toInputValue(item.requested_at)}
              onClick={reschedule}
            >
              Guardar fecha
            </button>
          </div>
          <div className="muted small">Si escribes un comentario abajo, se guarda junto con la nueva fecha.</div>
        </div>
      ) : null}

      <div className="panel-section">
        <label className="label" htmlFor="pk-note">
          Comentario
        </label>
        <textarea
          id="pk-note"
          rows={3}
          maxLength={1000}
          placeholder="Ej.: Llamé al cliente, confirma que el vehículo estará en la bodega."
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="row end">
          <button
            className="primary"
            disabled={busy || !note.trim()}
            onClick={() => save({ note: note.trim() }, "Comentario agregado")}
          >
            Agregar comentario
          </button>
        </div>
        {msg ? (
          <div className={`flash ${msg.ok ? "ok" : "bad"}`} role="status">
            {msg.text}
          </div>
        ) : null}
      </div>

      <div className="panel-section">
        <div className="label">Historial</div>
        <History items={history} loading={histLoading} />
      </div>
    </aside>
  );
}
