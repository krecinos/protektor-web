import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import AppShell from "../components/AppShell";
import "./mcp.css";

const GROUPS = { consulta: "Consulta", escritura: "Escritura", mensajeria: "Mensajería" };
const timestamp = (value) => value ? new Date(/[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : `${value.replace(" ", "T")}Z`) : null;
const date = (value) => {
  const parsed = timestamp(value);
  return parsed && !isNaN(parsed) ? parsed.toLocaleString("es-GT", { timeZone: "America/Guatemala", dateStyle: "medium", timeStyle: "short" }) : "Sin registros";
};
const toolLabel = (name) => ({ __auth__: "Acceso rechazado (token inválido)", __disabled__: "Bloqueada (deshabilitada)" })[name] || name;
const errorText = (error) => error?.status === 403 ? "Solo personal de Protektor" : error?.status === 401 ? "Sesión no válida" : error?.message || "No se pudo cargar la información";

function Switch({ label, enabled, disabled, onChange }) {
  return <button type="button" className="mcp-switch" role="switch" aria-label={label} aria-checked={enabled} disabled={disabled} onClick={onChange}>
    <span aria-hidden="true" className="mcp-track"><span /></span>{enabled ? "Habilitado" : "Deshabilitado"}
  </button>;
}

function Confirm({ kind, onClose, onConfirm }) {
  const ref = useRef(null);
  useEffect(() => { ref.current.showModal(); }, []);
  return <dialog className="mcp-dialog" ref={ref} onCancel={onClose} onClose={onClose} aria-labelledby="mcp-confirm-title">
    <h2 id="mcp-confirm-title">{kind === "token" ? "¿Generar nuevo token?" : "¿Deshabilitar el MCP?"}</h2>
    <p>{kind === "token" ? "El conector actual dejará de funcionar. El token anterior quedará invalidado y tendrás que configurar el conector con la nueva URL. Cópiala al generarla: solo se mostrará una vez." : "Se bloqueará el acceso a todas las herramientas del conector MCP."}</p>
    <p className="muted">Los cambios pueden tardar hasta 15 segundos en aplicarse en el servicio.</p>
    <div className="mcp-actions"><button autoFocus onClick={onClose}>Cancelar</button><button onClick={onConfirm}>{kind === "token" ? "Generar token" : "Deshabilitar MCP"}</button></div>
  </dialog>;
}

export default function McpAdmin() {
  const [me, setMe] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [confirm, setConfirm] = useState(null);
  const [secret, setSecret] = useState(null);
  const [copyStatus, setCopyStatus] = useState("");
  const [filter, setFilter] = useState("");
  const [audit, setAudit] = useState([]);
  const [auditError, setAuditError] = useState(null);
  const [auditLoading, setAuditLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [now, setNow] = useState(Date.now());
  const secretRef = useRef(null);

  useEffect(() => {
    document.title = "Protektor — Conector MCP";
    let alive = true;
    api.whoami().then((who) => { if (alive) setMe(who); }).catch(() => {});
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => { alive = false; clearInterval(timer); };
  }, []);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    api.mcp().then((result) => { if (alive) { setData(result); setError(null); } })
      .catch((e) => { if (alive) setError(e); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [refresh]);
  useEffect(() => {
    let alive = true;
    setAuditLoading(true); setAuditError(null);
    api.mcpAudit(filter).then((rows) => { if (alive) setAudit(rows); })
      .catch((e) => { if (alive) { setAuditError(e); if (e.status === 403) setSecret(null); } })
      .finally(() => { if (alive) setAuditLoading(false); });
    return () => { alive = false; };
  }, [filter, refresh]);
  useEffect(() => { if (secret) secretRef.current?.focus(); }, [secret]);

  async function mutate(action, optimistic) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(null);
    const previous = data;
    if (optimistic) setData(optimistic);
    try { setData(await action()); }
    catch (e) { setData(previous); setError(e); if (e.status === 403) setSecret(null); }
    finally { lock.current = false; setBusy(false); }
  }
  function changeTools(tools, enabled) {
    const names = tools.filter((t) => t.enabled !== enabled).map((t) => t.name);
    if (!names.length) return;
    // El catálogo actual tiene ~21 herramientas; cada petición admite hasta 50.
    if (names.length > 50) { setError(new Error("Selecciona un grupo de hasta 50 herramientas.")); return; }
    mutate(() => api.updateMcpTools(names, enabled), { ...data, tools: data.tools.map((t) => names.includes(t.name) ? { ...t, enabled } : t) });
  }
  async function rotate() {
    setConfirm(null);
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(null); setSecret(null); setCopyStatus("");
    try {
      const result = await api.rotateMcpToken();
      setSecret(result.url);
      setData((current) => ({ ...current, token: { configured: true, hint: result.hint, rotated_at: result.rotated_at }, public_url_template: result.url.replace(result.token, `k-••••${result.hint}`) }));
    } catch (e) { setError(e); }
    finally { lock.current = false; setBusy(false); }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(secret); setCopyStatus("URL copiada"); }
    catch { setCopyStatus("No se pudo copiar. Selecciona y copia la URL manualmente."); }
  }
  const forbidden = error?.status === 403 || auditError?.status === 403;
  const sync = timestamp(data?.service_link?.last_sync_at);
  const stale = !sync || isNaN(sync) || now - sync.getTime() > 600000;
  return <div className="mcp-page"><AppShell me={me} active="mcp"><div className="app mcp-admin">
    <header className="topbar"><div><div className="muted small">Administración</div><h1>Conector MCP</h1></div><button disabled={busy || loading} onClick={() => setRefresh((v) => v + 1)}>Refrescar</button></header>
    {forbidden ? <div className="error" role="alert">Solo personal de Protektor</div> : <>
      {error && <div className="error" role="alert"><strong>{errorText(error)}</strong>{error.status === 401 && <p>Inicia sesión en <a href="/gui/login">el sistema</a> y vuelve a esta página.</p>}</div>}
      {loading ? <p className="skeleton" role="status">Cargando…</p> : data && <>
        <section className="card mcp-section"><div className="mcp-heading"><h2>Estado</h2><Switch label="MCP habilitado" enabled={data.enabled} disabled={busy} onChange={() => data.enabled ? setConfirm("disable") : mutate(() => api.updateMcp(true), { ...data, enabled: true })} /></div>
          <p className="muted">{data.enabled ? "El conector permite acceder a las herramientas habilitadas." : "El conector está apagado. Ninguna herramienta está disponible."} Los cambios se aplican en hasta 15 segundos.</p>
          <div className="mcp-kpis">{[["Llamadas · 24 h", data.stats.calls_24h], ["Errores · 24 h", data.stats.errors_24h], ["Accesos rechazados · 24 h", data.stats.denied_24h], ["Última llamada", date(data.stats.last_call_at)], ["Última sincronización del servicio", date(data.service_link.last_sync_at)]].map(([label, value]) => <div key={label}><div className="muted small">{label}</div><strong>{value}</strong></div>)}</div>
          {stale && <p className="mcp-warning" role="status">El servicio MCP no ha sincronizado</p>}
        </section>
        <section className="card mcp-section"><div className="mcp-heading"><h2>Token de acceso</h2><button disabled={busy || !!secret} onClick={() => setConfirm("token")}>Generar nuevo token</button></div>
          <code className="mcp-url">{data.public_url_template}</code><p className="muted">{data.token.configured ? `Última rotación: ${date(data.token.rotated_at)}` : "Sin token configurado"}</p>
          {secret && <div className="mcp-secret" ref={secretRef} tabIndex={-1}><strong>Cópiala ahora, no se volverá a mostrar</strong><label htmlFor="mcp-secret-url" className="muted small">URL completa del conector</label><textarea id="mcp-secret-url" readOnly value={secret} onFocus={(e) => e.target.select()} /><div className="mcp-actions"><button onClick={copy}>Copiar</button><button onClick={() => { setSecret(null); setCopyStatus(""); }}>Cerrar y descartar URL</button><span role="status">{copyStatus}</span></div></div>}
        </section>
        <section className="card mcp-section"><div className="mcp-heading"><h2>Herramientas</h2><button disabled={busy || !data.tools.some((t) => t.category !== "consulta" && t.enabled)} onClick={() => changeTools(data.tools.filter((t) => t.category === "escritura" || t.category === "mensajeria"), false)}>Modo solo lectura</button></div>
          <p className="muted">El modo solo lectura deshabilita escritura y mensajería; conserva la selección de consultas.</p>
          {!data.tools.length && <p className="muted">No hay herramientas registradas. Esperando la sincronización del servicio.</p>}
          {Object.entries(GROUPS).map(([category, title]) => {
            const tools = data.tools.filter((t) => t.category === category);
            return <div className="mcp-group" key={category}><div className="mcp-heading"><h3>{title} <span className="muted small">{tools.filter((t) => t.enabled).length}/{tools.length}</span></h3><div className="mcp-actions"><button disabled={busy || !tools.some((t) => !t.enabled)} onClick={() => changeTools(tools, true)}>Habilitar todas</button><button disabled={busy || !tools.some((t) => t.enabled)} onClick={() => changeTools(tools, false)}>Deshabilitar todas</button></div></div>
              {tools.map((tool) => <article className="mcp-tool" key={tool.name}><div><strong>{tool.title}</strong><code className="mcp-tool-name">{tool.name}</code><div className="mcp-actions">{tool.read_only && <span className="mcp-badge">solo lectura</span>}{tool.destructive && <span className="mcp-badge mcp-danger">destructiva</span>}</div><p className="muted small">{tool.calls_24h} llamadas · {tool.errors_24h} errores en 24 h<br />Última llamada: {date(tool.last_call_at)}</p></div><Switch label={tool.title} enabled={tool.enabled} disabled={busy} onChange={() => changeTools([tool], !tool.enabled)} /></article>)}
            </div>;
          })}
        </section>
        <section className="card mcp-section"><div className="mcp-heading"><h2>Actividad</h2><label>Herramienta <select value={filter} onChange={(e) => setFilter(e.target.value)}><option value="">Todas</option>{data.tools.map((t) => <option key={t.name} value={t.name}>{t.title}</option>)}<option value="__auth__">Accesos rechazados</option><option value="__disabled__">Bloqueadas</option></select></label></div>
          <p className="muted small">Últimas 50 llamadas · Hora de Guatemala</p>
          {auditLoading ? <p role="status" className="skeleton">Cargando actividad…</p> : auditError ? <p role="alert" className="error">{errorText(auditError)}</p> : !audit.length ? <p className="muted">No hay actividad con este filtro.</p> : <div className="table-scroll"><table><thead><tr>{["Fecha (GT)", "Herramienta", "Resultado", "Duración", "Error"].map((label) => <th key={label}>{label}</th>)}</tr></thead><tbody>{audit.map((row) => <tr key={row.id}><td data-label="Fecha (GT)">{date(row.created_at)}</td><td data-label="Herramienta">{toolLabel(row.tool)}</td><td data-label="Resultado"><span className={`mcp-badge ${row.ok ? "" : "mcp-danger"}`}>{row.ok ? "OK" : "Error"}</span></td><td data-label="Duración">{row.duration_ms == null ? "—" : `${row.duration_ms} ms`}</td><td data-label="Error">{row.error || "—"}</td></tr>)}</tbody></table></div>}
        </section>
      </>}
      {confirm && <Confirm kind={confirm} onClose={() => setConfirm(null)} onConfirm={() => { if (confirm === "token") rotate(); else { setConfirm(null); mutate(() => api.updateMcp(false), { ...data, enabled: false }); } }} />}
    </>}
  </div></AppShell></div>;
}
