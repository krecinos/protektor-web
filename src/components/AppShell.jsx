import { useEffect, useLayoutEffect, useRef, useState } from "react";
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

export default function AppShell({ me, active, children }) {
  const identityKey = navigationIdentity(me);
  const [navigation, setNavigation] = useState(() => ({ identity: identityKey, data: cachedNavigation(identityKey) }));
  const data = navigation.identity === identityKey ? navigation.data : cachedNavigation(identityKey);
  const sections = data?.sections ?? NAV.filter((i) => !i.admin || me?.is_admin === true).map((i) => ({
    key: i.key === "map" ? "realtime" : i.key === "fleet" ? "reports" : i.key,
    label: i.long, icon: i.icon, items: [{ ...i, label: i.long, v2: i.key !== "classic" }],
  }));
  const classic = { key: "classic-home", label: "Sistema clásico", href: data?.classic_href || "/gui/home/index", v2: false };
  const [theme, setThemeState] = useState(getTheme);
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(null);
  const [visible, setVisible] = useState(0);
  const navRef = useRef(null);
  const measureRef = useRef(null);
  const popupRef = useRef(null);
  const triggerRef = useRef(null);
  const identity = [me?.company_name, data?.role_name || me?.role_name].filter(Boolean).join(" · ");
  const normalize = (path) => path.replace(/\/$/, "");
  const pathMatches = (item) => normalize(item.href) === normalize(window.location.pathname);
  const hasPathMatch = sections.some((section) => section.items.some(pathMatches));
  const isActive = (item) => pathMatches(item) || (!hasPathMatch && active === item.key);
  const sectionActive = (section) => section.items.some(isActive);
  const mobileSections = sections.filter((s) => ["realtime", "reports", "alerts"].includes(s.key));

  useEffect(() => {
    if (!identityKey) return;
    let alive = true;
    loadNavigation(identityKey).then((value) => {
      if (alive) setNavigation({ identity: identityKey, data: value });
    }).catch(() => { /* The original menu remains available. */ });
    return () => { alive = false; };
  }, [identityKey]);

  // Measure all labels independently of the visible subset, reserving room for Más.
  const sectionSignature = JSON.stringify(sections);
  useLayoutEffect(() => {
    const measure = () => {
      if (!navRef.current || !measureRef.current) return;
      const widths = [...measureRef.current.children].map((el) => el.getBoundingClientRect().width);
      let used = widths.pop() + 4;
      let count = 0;
      for (const width of widths) {
        if (used + width + 4 > navRef.current.clientWidth) break;
        used += width + 4;
        count++;
      }
      setVisible(count);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(navRef.current);
    measure();
    document.fonts.ready.then(measure);
    return () => observer.disconnect();
  }, [sectionSignature]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const close = (restore = true) => {
    setOpen(null);
    if (restore) triggerRef.current?.focus();
  };
  useEffect(() => {
    if (!open) return;
    const popup = popupRef.current;
    popup?.querySelector("a, button")?.focus();
    const outside = (event) => {
      if (!popup?.contains(event.target) && !triggerRef.current?.contains(event.target)) close(false);
    };
    const resize = () => close();
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", resize);
    const previousOverflow = document.body.style.overflow;
    if (open.mobile) document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", resize);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const show = (event, key, mobile = false) => {
    if (open?.key === key && open.mobile === mobile) return close();
    triggerRef.current = event.currentTarget;
    const rect = event.currentTarget.getBoundingClientRect();
    setOpen({ key, mobile, left: Math.max(12, Math.min(rect.left, window.innerWidth - 332)), top: rect.bottom + 12 });
  };
  const keyboard = (event) => {
    const links = [...popupRef.current.querySelectorAll("a, button")];
    const index = links.indexOf(document.activeElement);
    if (event.key === "Escape") { event.preventDefault(); close(); }
    else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const next = event.key === "Home" ? 0 : event.key === "End" ? links.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + links.length) % links.length;
      links[next]?.focus();
    } else if (event.key === "Tab") {
      if (!open.mobile) close(false);
      else if ((event.shiftKey && index === 0) || (!event.shiftKey && index === links.length - 1)) {
        event.preventDefault(); links[event.shiftKey ? links.length - 1 : 0]?.focus();
      }
    }
  };
  const marker = (item) => !item.v2 && <span className="shell-legacy" title="Sistema clásico"><Icon name="external-link" size={13} /><span className="sr-only"> (clásico)</span></span>;
  const itemLink = (item, menu = true) => <a key={item.key} href={item.href} role={menu ? "menuitem" : undefined} className="shell-menu-item" aria-current={isActive(item) ? "page" : undefined}>{item.label}{marker(item)}</a>;
  const trigger = (section, mobile = false, measuring = false) => {
    const label = mobile ? ({ realtime: "Mapa", reports: "Reportes", alerts: "Alertas" }[section.key] || section.label) : section.label;
    const content = <><Icon className="shell-icon" name={section.icon} /><span>{label}</span>{!mobile && section.items.length > 1 && <Icon name="chevron-down" size={12} />}{section.items.length === 1 && marker(section.items[0])}</>;
    if (section.items.length === 1) return <a key={section.key} className="shell-link" href={section.items[0].href} tabIndex={measuring ? -1 : undefined} aria-current={sectionActive(section) ? "page" : undefined}>{content}</a>;
    return <button key={section.key} type="button" className="shell-link" tabIndex={measuring ? -1 : undefined} aria-current={sectionActive(section) ? "page" : undefined} aria-haspopup={mobile ? "dialog" : "menu"} aria-expanded={open?.key === section.key && open.mobile === mobile} aria-controls={open?.key === section.key ? "shell-popup" : undefined} onClick={(e) => show(e, section.key, mobile)} onKeyDown={(e) => { if (["ArrowDown", "ArrowUp"].includes(e.key)) { e.preventDefault(); show(e, section.key, mobile); } }}>{content}</button>;
  };
  const more = (mobile = false, measuring = false) => <button type="button" className="shell-link" tabIndex={measuring ? -1 : undefined} aria-label="Más" aria-current={(mobile ? sections.filter((s) => !mobileSections.includes(s)) : sections.slice(visible)).some(sectionActive) ? "page" : undefined} aria-haspopup={mobile ? "dialog" : "menu"} aria-expanded={open?.key === "more" && open.mobile === mobile} onClick={(e) => show(e, "more", mobile)}><Icon name="more-horizontal" /><span>Más</span></button>;
  const groups = !open ? [] : open.key === "more" ? (open.mobile ? sections.filter((s) => !mobileSections.includes(s)) : sections.slice(visible)) : sections.filter((s) => s.key === open.key);

  return <div className="shell-root">
    <div className="shell-aurora" aria-hidden="true" />
    <header inert={open?.mobile ? "" : undefined} className="shell-header" data-scrolled={scrolled || undefined}>
      <div className="shell-bar">
        <a className="shell-brand" href="/v2/" aria-label="Protektor: tablero de flota"><img src={`${import.meta.env.BASE_URL}img/favicon.png`} alt="" width="32" height="32" /><span className="shell-wordmark">PROTEKTOR</span></a>
        <nav ref={navRef} className="shell-nav shell-desktop-nav" aria-label="Menú principal">{sections.slice(0, visible).map((s) => trigger(s))}{more()}</nav>
        <div className="shell-measure" ref={measureRef} aria-hidden="true">{sections.map((s) => trigger(s, false, true))}{more(false, true)}</div>
        <div className="shell-account">
          {identity && <span className="shell-identity" title={identity}>{identity}</span>}
          <button type="button" className="shell-theme" onClick={() => { const next = theme === "dark" ? "light" : "dark"; setTheme(next); setThemeState(next); }} aria-label={theme === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}><Icon name={theme === "dark" ? "sun" : "moon"} size={18} /></button>
          <span className="shell-avatar" aria-hidden="true">{initials(me?.company_name)}</span>
        </div>
      </div>
    </header>
    <main className="shell-content" inert={open?.mobile ? "" : undefined}>{children}</main>
    <nav inert={open?.mobile ? "" : undefined} className="shell-bottom-nav" aria-label="Menú móvil">{mobileSections.map((s) => trigger(s, true))}{more(true)}</nav>
    {open && <>
      {open.mobile && <div className="shell-sheet-backdrop" aria-hidden="true" />}
      <div id="shell-popup" ref={popupRef} className={open.mobile ? "shell-sheet" : "shell-dropdown"} role={open.mobile ? "dialog" : "menu"} aria-modal={open.mobile ? true : undefined} aria-label={open.key === "more" ? "Más opciones" : groups[0]?.label} style={open.mobile ? undefined : { left: open.left, top: open.top }} onKeyDown={keyboard}>
        {open.mobile && <div className="shell-sheet-heading"><strong>{open.key === "more" ? "Más opciones" : groups[0]?.label}</strong><button type="button" aria-label="Cerrar menú" onClick={() => close()}><Icon name="x" /></button></div>}
        {open.key === "more" && identity && <p className="shell-menu-identity" role={open.mobile ? undefined : "presentation"}>{identity}</p>}
        {groups.map((section) => <div key={section.key} role={open.mobile ? undefined : "group"} aria-label={section.label} className="shell-menu-group"><div className="shell-group-title" role="presentation"><Icon name={section.icon} size={16} />{section.label}</div>{section.items.map((item) => itemLink(item, !open.mobile))}</div>)}
        {open.key === "more" && itemLink(classic, !open.mobile)}
      </div>
    </>}
  </div>;
}
