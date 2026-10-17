# AGENTS.md — protektor-web (PROTEKTOR v2, Fase 2)

Front React servido en `https://app.protektor.com.gt/v2/`, consume protektor-api por mismo origen (`/api/v2`, cookie `PHPSESSID`). Razones y decisiones de visualización: `README.md`.

## Stack
React 18 + Vite 5, sin framework CSS (tokens propios en `src/styles.css`). `base: "/v2/"`.

## Estructura
`src/` → `api.js` (cliente API, `credentials: "include"`), `App.jsx`, `components/`, `map/`, `leads/`, `lib/`. `scripts/screenshot.mjs` (verificación visual).

## Comandos
```bash
npm install
npm run dev     # proxy de Vite reenvía /api/v2 a producción (solo lectura en pruebas)
npm run build
node scripts/screenshot.mjs "<PHPSESSID>"   # capturas claro/oscuro + errores de consola
```

## Reglas
- Nunca guardar API keys ni secretos en el front (el JS es público).
- Mobile-first: <768px usa barra inferior; respetar `safe-area-inset` (la app móvil del cliente es un WebView).
- Sin suite de tests: criterio de aceptación = `npm run build` sin errores + captura revisada.

## Prohibido para agentes delegados
Commit, push, rsync/deploy, usar cookies de sesión reales.
