import Icon from "./Icon";

export default function AppShell({ me, active, children }) {
  const identity = [me?.company_name, me?.role_name].filter(Boolean).join(" · ");
  return (
    <div className="shell-root">
      <header className="shell-header">
        <a className="shell-brand" href="/v2/" aria-label="Protektor: tablero de flota">
          <img src={`${import.meta.env.BASE_URL}img/logo-frase.png`} alt="Protektor" />
        </a>
        <div className="shell-account">
          {identity && <span className="shell-identity shell-desktop-identity" title={identity}>{identity}</span>}
          {me?.company_name && <span className="shell-identity shell-mobile-identity" title={me.company_name}>{me.company_name}</span>}
          <a className="shell-classic" href="/gui/home/index">Sistema clásico</a>
        </div>
      </header>
      <aside className="shell-sidebar" id="shell-menu">
        <div className="shell-section">Menú</div>
        <nav aria-label="Menú principal">
          <a className="shell-link" href="/gui/home/index"><Icon className="shell-icon" name="radio" />Tiempo real</a>
          <a className="shell-link" href="/v2/mapa" aria-current={active === "map" ? "page" : undefined}><Icon className="shell-icon" name="map-pin" />Mapa en vivo</a>
          <a className="shell-link" href="/v2/" aria-current={active === "fleet" ? "page" : undefined}><Icon className="shell-icon" name="layout-dashboard" />Tablero de flota</a>
          {me?.is_admin === true && <a className="shell-link" href="/v2/leads" aria-current={active === "leads" ? "page" : undefined}><Icon className="shell-icon" name="clipboard-list" />Leads y Citas</a>}
        </nav>
      </aside>
      <main className="shell-content">{children}</main>
      <nav className="shell-tabs" aria-label="Navegación">
        <a href="/v2/mapa" aria-current={active === "map" ? "page" : undefined}><Icon className="shell-icon" name="map-pin" /><span>Mapa</span></a>
        <a href="/v2/" aria-current={active === "fleet" ? "page" : undefined}><Icon className="shell-icon" name="layout-dashboard" /><span>Tablero</span></a>
        {me?.is_admin === true && <a href="/v2/leads" aria-current={active === "leads" ? "page" : undefined}><Icon className="shell-icon" name="clipboard-list" /><span>Leads</span></a>}
        <a href="/gui/home/index"><Icon className="shell-icon" name="radio" /><span>Clásico</span></a>
      </nav>
    </div>
  );
}
