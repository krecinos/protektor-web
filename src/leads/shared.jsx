// Piezas comunes de la gestión de citas y leads.

export const APPT_STATUS = {
  requested: { label: "Por confirmar", tone: "soon" },
  confirmed: { label: "Confirmada", tone: "info" },
  done: { label: "Atendida", tone: "good" },
  cancelled: { label: "Cancelada", tone: "overdue" },
};

export const LEAD_STATUS = {
  new: { label: "Nuevo", tone: "soon" },
  contacted: { label: "Contactado", tone: "info" },
  won: { label: "Ganado", tone: "good" },
  lost: { label: "Perdido", tone: "unknown" },
};

// Estado = punto de color + texto. Nunca color solo.
export function StatusBadge({ status, map }) {
  const s = map[status] ?? { label: status, tone: "unknown" };
  return (
    <span className={`status ${s.tone}`}>
      <span className="dot" aria-hidden="true" />
      {s.label}
    </span>
  );
}

const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

// La API entrega fechas sin zona (hora de Guatemala); `new Date("YYYY-MM-DDTHH:MM")`
// las interpreta como hora local, que es lo que queremos mostrar.
export function fmtDate(iso, { withDay = true } = {}) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${withDay ? DIAS[d.getDay()] + " " : ""}${dd}/${mm}/${d.getFullYear()} ${hh}:${mi}`;
}

/** Valor para <input type="datetime-local"> a partir de la fecha de la API. */
export function toInputValue(iso) {
  if (!iso) return "";
  return iso.slice(0, 16);
}

/** Link directo a WhatsApp; números de 8 dígitos se asumen de Guatemala. */
export function waLink(phone) {
  const digits = (phone || "").replace(/\D/g, "");
  if (digits.length < 8) return null;
  return `https://wa.me/${digits.length === 8 ? "502" + digits : digits}`;
}

export function ContactLine({ phone, email }) {
  const wa = waLink(phone);
  // Los links no deben abrir el detalle de la fila en la que están.
  return (
    <span className="contact" onClick={(e) => e.target.closest("a") && e.stopPropagation()}>
      {phone ? <a href={`tel:${phone}`}>{phone}</a> : null}
      {wa ? (
        <a className="wa" href={wa} target="_blank" rel="noopener noreferrer">
          WhatsApp
        </a>
      ) : null}
      {email ? <a href={`mailto:${email}`}>{email}</a> : null}
      {!phone && !email ? <span className="muted">sin contacto</span> : null}
    </span>
  );
}

const KIND_ICON = { note: "💬", status: "🔄", reschedule: "📅" };

export function History({ items, loading }) {
  if (loading) return <p className="skeleton">Cargando historial…</p>;
  if (!items?.length) return <p className="muted small">Sin movimientos todavía.</p>;
  return (
    <ol className="history">
      {items.map((h) => (
        <li key={h.id}>
          <span className="h-icon" aria-hidden="true">
            {KIND_ICON[h.kind] ?? "•"}
          </span>
          <div>
            <div className="h-body">{h.body}</div>
            <div className="h-meta">
              {h.author ?? "—"} · {fmtDate(h.created_at, { withDay: false }) ?? ""}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
