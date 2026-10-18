import { useEffect, useState } from "react";
import Icon from "./Icon";
import { getTheme, setTheme } from "../lib/theme";

const NAV = [
  { key: "fleet", href: "/v2/", icon: "layout-dashboard", long: "Tablero de flota", short: "Tablero" },
  { key: "map", href: "/v2/mapa", icon: "map-pin", long: "Mapa en vivo", short: "Mapa", live: true },
  { key: "leads", href: "/v2/leads", icon: "clipboard-list", long: "Leads y Citas", short: "Leads", admin: true },
  { key: "classic", href: "/gui/home/index", icon: "radio", long: "Tiempo real", short: "Clásico", title: "Sistema clásico" },
];

const initials = (name) =>
  (name ?? "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "P";

export default function AppShell({ me, active, children }) {
  const [theme, setThemeState] = useState(getTheme);
  const [scrolled, setScrolled] = useState(false);
  const identity = [me?.company_name, me?.role_name].filter(Boolean).join(" · ");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    setThemeState(next);
  };

  return (
    <div className="shell-root">
      <div className="shell-aurora" aria-hidden="true" />
      <header className="shell-header" data-scrolled={scrolled || undefined}>
        <div className="shell-bar">
          <a className="shell-brand" href="/v2/" aria-label="Protektor: tablero de flota">
            <img src={`${import.meta.env.BASE_URL}img/favicon.png`} alt="" width="32" height="32" />
            <span className="shell-wordmark">PROTEKTOR</span>
          </a>
          <nav className="shell-nav" aria-label="Menú principal">
            {NAV.filter((item) => !item.admin || me?.is_admin === true).map((item) => (
              <a
                key={item.key}
                className="shell-link"
                href={item.href}
                title={item.title}
                aria-current={active === item.key ? "page" : undefined}
              >
                <Icon className="shell-icon" name={item.icon} />
                <span className="lbl-long">{item.long}</span>
                <span className="lbl-short">{item.short}</span>
                {item.live && <span className="live-dot" aria-hidden="true" />}
              </a>
            ))}
          </nav>
          <div className="shell-account">
            {identity && <span className="shell-identity" title={identity}>{identity}</span>}
            <button
              type="button"
              className="shell-theme"
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
              title={theme === "dark" ? "Tema claro" : "Tema oscuro"}
            >
              <Icon name={theme === "dark" ? "sun" : "moon"} size={18} />
            </button>
            <span className="shell-avatar" aria-hidden="true">{initials(me?.company_name)}</span>
          </div>
        </div>
      </header>
      <main className="shell-content">{children}</main>
    </div>
  );
}
