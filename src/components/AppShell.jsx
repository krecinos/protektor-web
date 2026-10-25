import { useEffect, useRef, useState } from "react";
import Icon from "./Icon";
import { getTheme, setTheme } from "../lib/theme";
import { cachedNavigation, loadNavigation, navigationIdentity } from "./navigation";

const NAV = [
  { key: "fleet", href: "/v2/", icon: "layout-dashboard", long: "Tablero de flota", short: "Tablero" },
  { key: "map", href: "/v2/mapa", icon: "map-pin", long: "Mapa en vivo", short: "Mapa", live: true },
  { key: "leads", href: "/v2/leads", icon: "clipboard-list", long: "Leads y Citas", short: "Leads", admin: true },
  { key: "mcp", href: "/v2/admin/mcp", icon: "radio", long: "Conector MCP", short: "MCP", admin: true },
  { key: "classic", href: "/gui/home/index", icon: "radio", long: "Tiempo real", short: "Clásico", title: "Sistema clásico" },
];

const initials = (name) =>
  (name ?? "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "P";

const focusable = (root) => [...root.querySelectorAll('a[href], button:not(:disabled), [tabindex="0"]')].filter((el) => el.getClientRects().length);

export default function AppShell({ me, active, children }) {
  const identityKey = navigationIdentity(me);
  const [navigation, setNavigation] = useState(() => ({ identity: identityKey, data: cachedNavigation(identityKey) }));
  const data = navigation.identity === identityKey ? navigation.data : cachedNavigation(identityKey);
  const sections = data?.sections ?? NAV.filter((i) => i.key !== "classic" && (!i.admin || me?.is_admin === true)).map((i) => ({
    key: i.key === "map" ? "realtime" : i.key === "fleet" ? "reports" : i.key,
    label: i.long, icon: i.icon, items: [{ ...i, label: i.long, v2: true }],
  }));
  const classic = { key: "classic-home", label: "Sistema clásico", href: data?.classic_href || "/gui/home/index", v2: false };
  const [theme, setThemeState] = useState(getTheme);
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem("protektor-sidebar") === "collapsed"; } catch { return false; }
  });
  const [mobile, setMobile] = useState(() => window.matchMedia("(max-width: 767px)").matches);
  const [drawer, setDrawer] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [popup, setPopup] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const sidebarRef = useRef(null);
  const popupRef = useRef(null);
  const popupTrigger = useRef(null);
  const drawerTrigger = useRef(null);
  const compact = !mobile && collapsed;
  const identity = [me?.company_name, data?.role_name || me?.role_name].filter(Boolean).join(" · ");
  const normalize = (path) => path.replace(/\/$/, "");
  const pathMatches = (item) => normalize(item.href) === normalize(window.location.pathname);
  const hasPathMatch = sections.some((section) => section.items.some(pathMatches));
  const isActive = (item) => pathMatches(item) || (!hasPathMatch && active === item.key);
  const sectionActive = (section) => section.items.some(isActive);
  const mobileSections = ["realtime", "reports", "alerts"].map((key) => sections.find((s) => s.key === key)).filter(Boolean);
  const closePopup = (restore = true) => {
    setPopup(null);
    setTooltip(null);
    if (restore) popupTrigger.current?.focus();
  };
  const closeDrawer = () => {
    setDrawer(false);
    requestAnimationFrame(() => drawerTrigger.current?.focus());
  };

  useEffect(() => {
    if (!identityKey) return;
    let alive = true;
    loadNavigation(identityKey).then((value) => {
      if (alive) setNavigation({ identity: identityKey, data: value });
    }).catch(() => { /* Keep the fallback menu available. */ });
    return () => { alive = false; };
  }, [identityKey]);

  useEffect(() => {
    setExpanded({});
    setPopup(null);
  }, [identityKey, active]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const change = () => {
      setMobile(media.matches);
      setDrawer(false);
      setPopup(null);
      setTooltip(null);
    };
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);

  useEffect(() => {
    if (!drawer) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    focusable(sidebarRef.current)[0]?.focus();
    const keydown = (event) => {
      if (event.key === "Escape") { event.preventDefault(); closeDrawer(); }
      if (event.key === "Tab") {
        const links = focusable(sidebarRef.current);
        const index = links.indexOf(document.activeElement);
        if (index < 0 || (event.shiftKey && index === 0) || (!event.shiftKey && index === links.length - 1)) {
          event.preventDefault();
          links[event.shiftKey ? links.length - 1 : 0]?.focus();
        }
      }
    };
    const keepFocus = (event) => {
      if (!sidebarRef.current?.contains(event.target)) focusable(sidebarRef.current)[0]?.focus();
    };
    document.addEventListener("keydown", keydown);
    document.addEventListener("focusin", keepFocus);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", keydown);
      document.removeEventListener("focusin", keepFocus);
    };
  }, [drawer]);

  useEffect(() => {
    if (!popup) return;
    focusable(popupRef.current)[0]?.focus();
    const outside = (event) => {
      if (!popupRef.current?.contains(event.target) && !popupTrigger.current?.contains(event.target)) closePopup(false);
    };
    const reposition = () => closePopup();
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", reposition);
    const sidebar = sidebarRef.current;
    sidebar.addEventListener("scroll", reposition);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", reposition);
      sidebar.removeEventListener("scroll", reposition);
    };
  }, [popup]);

  const openDrawer = (event, section) => {
    drawerTrigger.current = event.currentTarget;
    if (section) setExpanded((value) => ({ ...value, [section.key]: true }));
    setDrawer(true);
  };
  const toggleSidebar = () => {
    const next = !collapsed;
    setCollapsed(next);
    setPopup(null);
    setTooltip(null);
    try { localStorage.setItem("protektor-sidebar", next ? "collapsed" : "expanded"); } catch { /* Optional preference in WebViews. */ }
  };
  const showPopup = (event, section) => {
    if (popup?.key === section.key) return closePopup();
    popupTrigger.current = event.currentTarget;
    const rect = event.currentTarget.getBoundingClientRect();
    const top = Math.max(72, Math.min(rect.top, window.innerHeight - Math.min(section.items.length * 48 + 52, 400) - 12));
    setTooltip(null);
    setPopup({ key: section.key, top });
  };
  const tip = (event, label) => {
    if (!compact || popup) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setTooltip({ label, top: Math.min(rect.top, window.innerHeight - 48) });
  };
  const tipEvents = (label) => ({ onMouseEnter: (e) => tip(e, label), onMouseLeave: () => setTooltip(null), onFocus: (e) => tip(e, label), onBlur: () => setTooltip(null) });
  const navigate = () => { if (drawer) closeDrawer(); closePopup(false); };
  const marker = (item) => !item.v2 && <span className="shell-legacy" title="Sistema clásico"><Icon name="external-link" size={13} /><span className="sr-only"> (clásico)</span></span>;
  const itemLink = (item) => <a key={item.key} href={item.href} className="shell-menu-item" aria-current={isActive(item) ? "page" : undefined} onClick={navigate}>{item.label}{marker(item)}</a>;
  const group = popup && sections.find((s) => s.key === popup.key);

  return <div className="shell-root" data-sidebar-collapsed={collapsed}>
    <div className="shell-aurora" aria-hidden="true" />
    <header inert={drawer ? "" : undefined} className="shell-header">
      <div className="shell-bar">
        <button type="button" className="shell-sidebar-toggle" aria-label={collapsed ? "Mostrar menú" : "Ocultar menú"} aria-expanded={!collapsed} aria-controls="shell-sidebar" onClick={toggleSidebar}><Icon name="menu" /></button>
        <button type="button" className="shell-drawer-toggle" aria-label="Mostrar menú" aria-expanded={drawer} aria-controls="shell-sidebar" onClick={openDrawer}><Icon name="menu" /></button>
        <a className="shell-brand" href="/v2/" aria-label="Protektor: tablero de flota"><img src={`${import.meta.env.BASE_URL}img/favicon.png`} alt="" width="32" height="32" /><span className="shell-wordmark">PROTEKTOR</span></a>
        <div className="shell-account">
          {identity && <span className="shell-identity" title={identity}>{identity}</span>}
          <button type="button" className="shell-theme" onClick={() => { const next = theme === "dark" ? "light" : "dark"; setTheme(next); setThemeState(next); }} aria-label={theme === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}><Icon name={theme === "dark" ? "sun" : "moon"} size={18} /></button>
          <span className="shell-avatar" aria-hidden="true">{initials(me?.company_name)}</span>
        </div>
      </div>
    </header>
    {drawer && <div className="shell-drawer-backdrop" aria-hidden="true" onClick={closeDrawer} />}
    <aside id="shell-sidebar" ref={sidebarRef} className="shell-sidebar" data-collapsed={compact} data-open={drawer} role={mobile && drawer ? "dialog" : undefined} aria-modal={mobile && drawer ? true : undefined} aria-label="Menú principal" inert={mobile && !drawer ? "" : undefined} onScroll={() => setTooltip(null)} onKeyDown={(e) => { if (e.key === "Escape") setTooltip(null); }}>
      <div className="shell-drawer-heading"><strong>Menú principal</strong><button type="button" aria-label="Cerrar menú" onClick={closeDrawer}><Icon name="x" /></button></div>
      {identity && <p className="shell-drawer-identity">{identity}</p>}
      <nav className="shell-sidebar-nav" aria-label="Navegación principal">
        {sections.map((section, index) => {
          const id = `shell-section-${index}`;
          const isOpen = expanded[section.key] ?? sectionActive(section);
          const content = <><Icon className="shell-icon" name={section.icon || "circle"} /><span className="shell-sidebar-label">{section.label}</span>{section.items.length === 1 ? marker(section.items[0]) : <Icon className="shell-group-chevron" name="chevron-down" size={14} />}</>;
          return <div className="shell-sidebar-group" key={section.key}>
            {section.items.length === 1 ? <a className="shell-link" href={section.items[0].href} aria-label={compact ? section.label : undefined} aria-current={sectionActive(section) ? "page" : undefined} onClick={navigate} {...tipEvents(section.label)}>{content}</a> :
              <button type="button" className="shell-link" data-active={sectionActive(section)} aria-label={compact ? section.label : undefined} aria-expanded={compact ? popup?.key === section.key : isOpen} aria-controls={compact ? (popup?.key === section.key ? "shell-flyout" : undefined) : id} onClick={(e) => compact ? showPopup(e, section) : setExpanded((value) => ({ ...value, [section.key]: !isOpen }))} onKeyDown={(e) => { if (compact && ["ArrowRight", "ArrowDown"].includes(e.key)) { e.preventDefault(); showPopup(e, section); } if (e.key === "Escape") { setTooltip(null); closePopup(); } }} {...tipEvents(section.label)}>{content}</button>}
            {section.items.length > 1 && <div id={id} className="shell-accordion" hidden={compact || !isOpen}>{section.items.map(itemLink)}</div>}
          </div>;
        })}
      </nav>
      <a href={classic.href} className="shell-link shell-classic" aria-label={compact ? classic.label : undefined} onClick={navigate} {...tipEvents(classic.label)}><Icon name="external-link" /><span className="shell-sidebar-label">Sistema clásico</span></a>
    </aside>
    <main className="shell-content" inert={drawer ? "" : undefined}>{children}</main>
    <nav inert={drawer ? "" : undefined} className="shell-bottom-nav" aria-label="Menú móvil">
      {mobileSections.map((section) => {
        const content = <><Icon name={section.icon || "circle"} /><span>{{ realtime: "Mapa", reports: "Reportes", alerts: "Alertas" }[section.key]}</span></>;
        return section.items.length === 1 ? <a key={section.key} className="shell-link" href={section.items[0].href} aria-current={sectionActive(section) ? "page" : undefined}>{content}</a> : <button key={section.key} type="button" className="shell-link" data-active={sectionActive(section)} aria-expanded={drawer} aria-controls="shell-sidebar" onClick={(e) => openDrawer(e, section)}>{content}</button>;
      })}
      <button type="button" className="shell-link" aria-expanded={drawer} aria-controls="shell-sidebar" onClick={openDrawer}><Icon name="more-horizontal" /><span>Más</span></button>
    </nav>
    {tooltip && <div className="shell-tooltip" role="tooltip" style={{ top: tooltip.top }}>{tooltip.label}</div>}
    {group && <div id="shell-flyout" ref={popupRef} className="shell-flyout" aria-label={group.label} role="region" style={{ top: popup.top, maxHeight: `calc(100dvh - ${popup.top + 12}px)` }} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget) && e.relatedTarget !== popupTrigger.current) closePopup(false); }} onKeyDown={(e) => {
      if (e.key === "Escape" || e.key === "ArrowLeft") { e.preventDefault(); closePopup(); }
      else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
        e.preventDefault();
        const links = focusable(popupRef.current);
        const index = links.indexOf(document.activeElement);
        links[e.key === "Home" ? 0 : e.key === "End" ? links.length - 1 : (index + (e.key === "ArrowDown" ? 1 : -1) + links.length) % links.length]?.focus();
      }
    }}><div className="shell-group-title">{group.label}</div>{group.items.map(itemLink)}</div>}
  </div>;
}
