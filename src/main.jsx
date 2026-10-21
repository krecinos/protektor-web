import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import LiveMap from "./map/LiveMap";
import LeadsApp from "./leads/LeadsApp";
import McpAdmin from "./mcp/McpAdmin";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {/* Ruteo mínimo por ruta: el Caddy ya devuelve index.html para /v2/*. */}
    {window.location.pathname.replace(/\/$/, "") === "/v2/admin/mcp" ? <McpAdmin /> : window.location.pathname.startsWith("/v2/mapa") ? <LiveMap /> : window.location.pathname.startsWith("/v2/leads") ? <LeadsApp /> : <App />}
  </React.StrictMode>,
);
