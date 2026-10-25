import { useState } from "react";
import Icon from "../components/Icon";

export function MapKpis({ summary }) {
  if (!summary) return null;
  const count = (value) => Number.isFinite(value) && value >= 0 ? value : null;
  const overdue = count(summary.maint_overdue);
  const soon = count(summary.maint_soon);
  const maintenance = overdue != null && soon != null ? overdue + soon : "—";
  const tone = overdue > 0 ? "is-critical" : soon > 0 ? "is-warning" : "";
  return <div className="map-kpis" aria-label="Indicadores de flota">
    <span><Icon name="radio" size={16} />{count(summary.online) ?? "—"}/{count(summary.total) ?? "—"} en línea</span>
    <a href="/gui/maintenance/index" className={tone} title={tone ? `${overdue ?? "—"} vencidos · ${soon ?? "—"} próximos` : undefined}><Icon name="wrench" size={16} />{maintenance} mantenimiento</a>
    <span className={summary.sos_today > 0 ? "is-critical" : ""}><Icon name="bell" size={16} />{count(summary.sos_today) ?? "—"} SOS hoy</span>
  </div>;
}

const DISMISSED = "protektor-balance-dismissed";
export function BalanceBanner({ balance }) {
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem(DISMISSED) === "1"; } catch { return false; }
  });
  const items = Array.isArray(balance?.items) ? balance.items.filter(Boolean) : [];
  if (dismissed || !items.length) return null;
  const amount = (value) => value != null && Number.isFinite(Number(value)) ? Number(value).toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—";
  return <aside className="balance-banner" aria-label="Saldo vencido">
    <p>Tu pago está vencido: {items.map((item) => `${item.description || "Saldo pendiente"}: Q. ${amount(item.amount)}`).join("; ")}</p>
    <div className="balance-links">
      <a href="https://pay.paggoapp.com/PayWithLinkV2/PXVDUFMILV" target="_blank" rel="noopener">Pagar con tarjeta</a>
      <a href="https://api.whatsapp.com/send?phone=50252156656">Reportar pago por WhatsApp</a>
    </div>
    <button type="button" aria-label="Ocultar aviso de saldo por esta sesión" onClick={() => {
      setDismissed(true);
      try { sessionStorage.setItem(DISMISSED, "1"); } catch { /* El aviso aún se oculta en esta vista. */ }
    }}><Icon name="x" /></button>
  </aside>;
}
