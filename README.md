# Protektor Web

Front nuevo de [Protektor](https://github.com/krecinos/protektor), consumiendo la [API moderna](https://github.com/krecinos/protektor-api). Es la Fase 2 del plan de modernización: pantallas nuevas en React que conviven con el GUI legacy en PHP, sin tocarlo.

**En vivo:** <https://app.protektor.com.gt/v2/>

## Por qué se sirve en /v2/ del dominio del GUI

Esto no es un detalle de despliegue, es lo que hace viable todo el modelo:

- Las cookies son **de host**. Una SPA servida desde otro dominio no recibiría la cookie `PHPSESSID` del GUI y tendría que autenticarse sola.
- Una SPA **no puede guardar un secreto**: el JavaScript se le entrega al usuario. Poner una API key en el front dejaría que cualquier cliente leyera datos de otros.

Sirviendo el bundle en el mismo origen (`app.protektor.com.gt/v2/`) y llamando a `/api/v2/...`, el navegador manda la sesión que el PHP ya creó y el front **no guarda ninguna credencial**. Por eso `vite.config.js` compila con `base: "/v2/"` y `api.js` usa rutas relativas con `credentials: "include"`.

La API también existe en `api.protektor.com.gt` con autenticación por API key, pero eso es para consumo servidor-a-servidor, la app móvil y el bot — nunca para este front.

## Qué muestra

Tablero de flota para el usuario que ya inició sesión en el GUI:

- **Indicadores**: vehículos activos, reportando en 24 h, mantenimientos vencidos, kilometraje del período.
- **Kilometraje diario** por vehículo (gráfico de línea con crosshair y detalle al pasar el cursor).
- **Tabla de flota**: último reporte, velocidad y semáforo de mantenimiento; al tocar una fila cambia el vehículo del gráfico.

El aislamiento por empresa lo impone la API, no el front: la sesión determina qué vehículos se ven.

## Decisiones de visualización

Siguen el método de la skill `dataviz` (forma → color → validación → marcas → interacción → accesibilidad):

- **Los indicadores son cifras, no gráficos**: el dato es un titular, no una distribución.
- **Una sola serie ⇒ sin caja de leyenda**; el título nombra la serie.
- **Paleta validada por script**, no a ojo: azul `#2a78d6` (claro) / `#3987e5` (oscuro). Ambos modos pasan banda de luminosidad, piso de croma, separación para daltonismo y contraste.
- **El modo oscuro es un juego de pasos elegido**, no una inversión automática; se verificó capturando la pantalla en los dos modos.
- **El estado nunca es solo color**: el semáforo de mantenimiento lleva punto + etiqueta ("Al día", "Próximo", "Vencido").
- **Etiqueta directa solo en el pico**, nunca un número sobre cada punto; el resto vive en el hover.
- **Los días sin recorrido se rellenan con 0.** La API agrupa por fecha y omite los días sin movimiento; graficarlos tal cual dejaba los puntos equiespaciados por índice y una semana sin actividad se veía igual que un día — el eje temporal mentía.
- **El eje Y redondea hacia arriba al siguiente paso.** Sin eso, un máximo de 9 con ticks 0–5 dibujaba el pico fuera del área del gráfico.

## Desarrollo

```bash
npm install
npm run dev     # el proxy de Vite reenvía /api/v2 a producción
```

Para trabajar con datos reales hace falta una cookie `PHPSESSID` válida en el navegador (iniciar sesión en <https://app.protektor.com.gt/gui/login> en la misma sesión del navegador).

## Verificación visual

El validador de paleta comprueba color, no maquetación: hay que **mirar el resultado**.

```bash
npm run build
node scripts/screenshot.mjs "<PHPSESSID>"   # captura /tmp/v2-light.png y /tmp/v2-dark.png
```

Usa `puppeteer-core` con el Chrome del sistema, inyecta la cookie de sesión, captura ambos modos y reporta errores de consola. Este flujo fue el que detectó los dos bugs de gráfico documentados arriba.

## Despliegue

Estático: el build se copia a `/var/www/protektor-v2/` en el server `protektor` (157.230.58.73) y lo sirve el Caddy de sistema.

```bash
npm run build
rsync -a --delete dist/ protektor:/var/www/protektor-v2/
```

El bloque de Caddy (`/etc/caddy/Caddyfile`, respaldo `Caddyfile.bak-prev2`) usa `handle_path /v2/*`, que quita el prefijo — por eso el bundle se compila con `base: "/v2/"`.

## Pendientes

- **Enlazarlo desde el menú del GUI**: insertar filas en `menu_tag`/`menu_child` y habilitarlas en `menu_by_roles` para que aparezca como un módulo más. No requiere tocar código PHP.
- El semáforo de mantenimiento sale "Sin datos" en empresas que nunca usaron el módulo; el endpoint `/maintenance/types/bootstrap` clona la plantilla global.
- Mapa en vivo (reemplazo del módulo `monitor`) — el siguiente módulo natural a migrar.
