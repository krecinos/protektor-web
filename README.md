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

El tablero usa todas las unidades **activas** del catálogo paginado. KPIs y lista comparten un único modelo: movimiento (velocidad > 0), detenida encendida (velocidad 0 e ignición 1), apagada (ignición 0), sin reportar (más de 24 horas o sin fecha válida) y estado desconocido (telemetría insuficiente o fecha futura). Son estados del último reporte, no una garantía de conectividad en tiempo real.

- Cada KPI filtra la lista; mantenimiento cuenta unidades con servicios vencidos/próximos y puede solaparse.
- Búsqueda por nombre/placa, orden por columnas, 25 unidades por página y tarjetas en móvil.
- Acciones visibles: mapa de la unidad, rutas del clásico y distancia diaria bajo demanda.
- Fechas sin zona se interpretan en Guatemala (UTC−6). El período de distancia incluye exactamente 7, 14 o 30 días calendario, incluyendo hoy parcial. Días omitidos por la API se muestran como 0 km.
- Refresco a los 60 segundos de terminar la consulta, con cancelación, pausa en pestañas ocultas y conservación de datos ante fallos. Mantenimiento puede fallar independientemente. Un 401 oculta el tablero.

## Desarrollo con datos ficticios (sin producción)

```bash
VITE_MOCK=1 npm run dev -- --host 127.0.0.1
node scripts/check-dashboard.mjs
node scripts/screenshot-dashboard.mjs
```

El modo mock intercepta el cliente antes de `fetch` y deshabilita el proxy de Vite. Los fixtures se importan exclusivamente con `import.meta.env.DEV`; `vite preview` sirve producción y **no** activa el mock. Hay 150 unidades. Parámetros de desarrollo: `?scenario=empty`, `error`, `session`, `maintenance` o `distance`.

El script visual usa Chrome headless (ruta opcional `CHROME_PATH`), bloquea solicitudes externas y `/api/`, no usa cookies y genera seis PNG en `/tmp/deleg/tablero/`: 1366×768, 1920×1080 y 390×844, claro/oscuro. Comprueba conteos, consola y desbordamiento horizontal. Se debe revisar visualmente cada captura.

Comprobación del aislamiento de fixtures tras compilar:

```bash
npm run build
rg 'TABLERO_MOCK_ONLY_150|Flota demostración|Fallo simulado|fixtures' dist
# Esperado: ninguna coincidencia (exit 1).
```

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

## Enlace desde el menú del GUI

Ya está enlazado para los 6 roles, sin tocar una línea de PHP: `menu_tag` id 16 + `menu_child` id 38 + filas en `menu_by_roles`.

El detalle no obvio es `complete_url`, que significa lo **contrario** de lo que sugiere el nombre. En `menu_min.php`:

```php
$complete_ulr = ($row[5]) ? URL.DS.$row[4] : $row[4];
```

`complete_url = 1` antepone la base del GUI (todo queda bajo `/gui/`); `complete_url = 0` usa el valor crudo. Para salir de `/gui/` hay que usar **`complete_url = 0`** con `menu_tag.destination = ''`, de modo que `CONCAT(cat.destination,'/',sub.destination)` dé `/v2/`. En la base hay un intento previo de enlace externo (a RabbitMQ) que quedó deshabilitado justamente por no haber entendido esto.

`father = 1` hace además que la etiqueta visible sea la de la **categoría**, no la del ítem — por eso ambas se llaman igual.

Para verificar el HTML sin credenciales del GUI, se puede ejecutar el código real del menú por CLI (el entorno local apunta a la misma base):

```php
$_SERVER['HTTP_HOST']='app.protektor.com.gt'; session_start(); $_SESSION['id_logged']=<user_id>;
// include paths.php, secrets.php, LIB/db.php, menu_min.php
echo (new MenuMiniModule())->doMenu('/gui/home/index');
```

Ojo: insertar una fila en `user_sessions` **no** loguea en el GUI — la sesión real vive en el almacenamiento nativo de PHP; esa tabla es un espejo para revocación y para que la API autentique.

## Pendientes

- El semáforo de mantenimiento sale "Sin datos" en empresas que nunca usaron el módulo; el endpoint `/maintenance/types/bootstrap` clona la plantilla global.
- Mapa en vivo (reemplazo del módulo `monitor`) — el siguiente módulo natural a migrar.
