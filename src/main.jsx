import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import LeadsApp from "./leads/LeadsApp";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {/* Ruteo mínimo por ruta: el Caddy ya devuelve index.html para /v2/*. */}
    {window.location.pathname.startsWith("/v2/leads") ? <LeadsApp /> : <App />}
  </React.StrictMode>,
);
