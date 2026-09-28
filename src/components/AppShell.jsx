import { useEffect, useRef, useState } from "react";

function ShellIcon({ kind }) {
  return (
    <svg className="shell-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {kind === "realtime" ? <><circle cx="12" cy="12" r="8" /><path d="m15 9-2 4-4 2 2-4z" /></> :
        kind === "map" ? <><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></> :
        kind === "fleet" ? <><path d="M3 6h11v11H3zM14 10h4l3 4v3h-7" /><circle cx="7" cy="18" r="2" /><circle cx="18" cy="18" r="2" /></> :
          kind === "leads" ? <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 11h18m-14 5 3 3 6-6" /></> :
            <path d="M4 6h16M4 12h16M4 18h16" />}
    </svg>
  );
}

export default function AppShell({ me, active, children }) {
  const [open, setOpen] = useState(false);
  const toggleRef = useRef(null);
  const navRef = useRef(null);

  function closeMenu() {
    setOpen(false);
    toggleRef.current?.focus();
  }

  useEffect(() => {
    if (!open) return;
    navRef.current?.querySelector('a[aria-current="page"], a')?.focus();
    function onKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu();
      }
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    const desktop = window.matchMedia("(min-width: 768px)");
    const onResize = () => { if (desktop.matches) setOpen(false); };
    desktop.addEventListener("change", onResize);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      desktop.removeEventListener("change", onResize);
    };
  }, [open]);

  const identity = [me?.company_name, me?.role_name].filter(Boolean).join(" · ");
  return (
    <div className={`shell-root${open ? " shell-open" : ""}`}>
      <header className="shell-header">
        <button ref={toggleRef} className="shell-toggle" type="button" aria-label={open ? "Cerrar menú" : "Abrir menú"} aria-expanded={open} aria-controls="shell-menu" onClick={() => setOpen(!open)}>
          <ShellIcon kind="menu" />
        </button>
        <a className="shell-brand" href="/v2/" aria-label="Protektor: tablero de flota">
          <img src={`${import.meta.env.BASE_URL}img/logo-frase.png`} alt="Protektor" />
        </a>
        <div className="shell-account">
          {identity && <span className="shell-identity" title={identity}>{identity}</span>}
          <a className="shell-classic" href="/gui/home/index">Sistema clásico</a>
        </div>
      </header>
      {open && <button className="shell-backdrop" type="button" aria-label="Cerrar menú" onClick={closeMenu} />}
      <aside className="shell-sidebar" id="shell-menu">
        <div className="shell-section">Menú</div>
        <nav ref={navRef} aria-label="Menú principal">
          <a className="shell-link" href="/gui/home/index"><ShellIcon kind="realtime" />Tiempo real</a>
          <a className="shell-link" href="/v2/mapa" aria-current={active === "map" ? "page" : undefined}><ShellIcon kind="map" />Mapa en vivo</a>
          <a className="shell-link" href="/v2/" aria-current={active === "fleet" ? "page" : undefined}><ShellIcon kind="fleet" />Tablero de flota</a>
          {me?.is_admin === true && <a className="shell-link" href="/v2/leads" aria-current={active === "leads" ? "page" : undefined}><ShellIcon kind="leads" />Leads y Citas</a>}
        </nav>
      </aside>
      <main className="shell-content">{children}</main>
    </div>
  );
}
