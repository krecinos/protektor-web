# Plan de migración del GUI legacy (JAB/PHP) a PROTEKTOR v2

_Redactado 2026-10-24; matriz de roles verificada en producción el mismo día. Motivo principal: seguridad
(reducir la superficie del PHP legacy)._

## 1. Principios (decididos con el usuario)

- **Navegación parecida, no idéntica**: mismas secciones y orden aproximado para que el cambio no sea
  abrupto; se aprovecha para mejorar nombres, agrupar y modernizar pantallas.
- **Mismas tablas para los dos sistemas**: legacy y v2 leen/escriben la misma BD MySQL. Cero doble
  escritura. Tablas nuevas solo aditivas y vía migración versionada (p. ej. agregados para reportes).
- **Permisos de menú en un solo lugar**: `menu_by_roles` sigue decidiendo qué ve cada rol (se administra
  igual que hoy desde Administración › Menús del clásico). v2 no inventa su propia matriz.
- **El menú NO es la seguridad**: lección del legacy (`checkRoute` solo protegía métodos del menú →
  `home/stop` sin sesión, IDOR en `monitor/route_events`). Cada endpoint de la API valida rol + empresa +
  ACL de vehículo (rol 6) por sí mismo.
- **Strangler fig por módulo**: construir en v2 → probar → repuntar `menu_child` → convivencia →
  **retirar el método PHP** (ahí está el beneficio de seguridad). Reversible repuntando de vuelta.

## 2. Roles (producción, `roles` + conteo en `users`)

| id | Nombre | Quién es (inferido por menú y volumen) | Usuarios (status 1 / 2) |
|---|---|---|---|
| 1 | Super Admin | equipo interno, todo | 2 / 3 |
| 2 | Admin | equipo interno operativo | 1 / 1 |
| 3 | User | usuario de empresa (sin admin de usuarios) | 2 / 11 |
| 4 | View | solo consulta: mapa + reportes | 0 / 7 |
| 5 | Advanced | **cliente titular** (la gran mayoría); administra sus usuarios, puede detener/reactivar | 48 / 231 |
| 6 | Specific | usuario limitado a vehículos asignados (`roles_device_user`) | 31 / 20 |

_Pendiente de verificar_: significado de `users.status` 1 vs 2 (¿2 = activo?).

## 3. Menú legacy real (ítems activos y roles que los ven)

| Sección legacy | Ítem | Destino | Roles |
|---|---|---|---|
| Tiempo real | Visor General | home/index | 1-6 |
| Tablero de flota | Tablero de flota | /v2/mapa | **1,2** (hoy los clientes NO lo ven) |
| Alertas | Alertas | alerts/index | 1,2,3,5 |
| Geocercas | Generales | geocerca/index | 1,2,3,5,6 |
| Monitoreo y Reportes | Rutas por vehículo · KMs totales · KMs por fecha · Reportes · Reporte ubicaciones | monitor/* | 1-6 |
| Monitoreo y Reportes | Notificaciones | monitor/mov_index | 1,5 |
| Monitoreo y Reportes | Tokens (deshabilitado) | monitor/tokens | 1,2,5 |
| Mantenimientos | Mantenimientos | maintenance/index | 1,2,3,5,6 |
| Admin | Usuarios (de su empresa) | adminuser/list_users | 5 |
| Conf. Dispositivos | Creación/vista · Monitoreo | devices/* | 1,2 |
| Conf. Eventos | Eventos GPS | messages/index | 1,2 |
| Administración | Usuarios · Empresas · Dispositivos activos · Procesos · Leads y Citas | admin/* , /v2/leads | 1,2 |
| Administración | Roles · Device Type · Device Brand · Menús | admin/* | 1 |
| Financiero | ER (ledger) | financial/ledger | 1,2 (Saldos y Profile deshabilitados) |

Lo que ve un **cliente (rol 5)** hoy: Visor, Alertas, Geocercas, 6 reportes de Monitoreo, Notificaciones,
Mantenimientos y Usuarios. Eso es lo prioritario.

## 4. Navegación propuesta en v2 (parecida + mejoras)

Cada entrada de v2 declara qué `menu_child.menu_id` legacy la habilita; se muestra si el rol tiene ese
ítem en `menu_by_roles`. Así la matriz se sigue administrando en el mismo lugar.

| Sección v2 | Contiene | Habilitada por (menu_id legacy) |
|---|---|---|
| **Tiempo real** | Mapa en vivo (+ comandos según rol) | 1 |
| **Alertas** | Reglas de alerta + historial de notificaciones (une "Alertas" y "Notificaciones") | 37, 32 |
| **Geocercas** | Geocercas | 2 |
| **Reportes** | Tablero de flota + catálogo de reportes (§5) — reemplaza los 6 ítems sueltos | 6, 31, 8, 24, 25 |
| **Mantenimientos** | Mantenimientos por vehículo | 30 |
| **Mi empresa** | Usuarios de la empresa (rol 5) | 27 |
| **Administración** (internos) | Empresas, Usuarios, Dispositivos, SIMs, Sesiones, Catálogos, Eventos GPS, Leads, MCP, Menús/Roles | 10, 12, 13, 21, 36, 11, 28, 29, 17, 39, 33 |
| **Finanzas** (internos) | Estado de resultados, saldos | 22 |
| Sistema clásico | enlace temporal mientras dure la convivencia | todos |

Escritorio: **menú lateral izquierdo plegable** (decisión del usuario 2026-10-24, como el clásico):
expandido con ícono+texto y grupos tipo acordeón, o contraído solo íconos con tooltip y menú flotante;
estado recordado en `localStorage`. Móvil (WebView): sin barra inferior (el usuario la quitó por innecesaria); la misma barra lateral
se abre como cajón desde la hamburguesa ☰.

## 5. Reportería y gráficas modernas

**Decisión del usuario (2026-10-24): NO un BI.** Un **buen dashboard para ayudar a los clientes**,
idealmente **en vivo pero muy optimizado**, más un **generador de rutas en PDF**. Avanzar gradualmente.

### 5.1 Dashboard en vivo (diseño)
- **Arriba, en vivo**: en línea / fuera de línea, en movimiento / detenidos, alertas de hoy, km de hoy.
  Se actualiza por **polling liviano cada 30-60 s** contra un endpoint de resumen con caché corta en la
  API (≈15 s por empresa) — sin WebSockets al inicio; si luego hace falta, SSE desde la misma API.
- **Abajo, histórico**: tendencias de 7/30 días (km por día, horas de motor, excesos, alertas) leídas de la
  tabla de agregados diarios — nunca de `gps_data` en crudo.
- **Útil para decidir**: "vehículos que requieren atención" (sin reportar >24 h, batería baja, mantenimiento
  vencido, excesos repetidos), ranking de vehículos, comparación con el período anterior.
- Todo filtrado por `device_filter()` (empresa / ACL rol 6). Móvil primero (WebView).

### 5.2 Generador de rutas en PDF
- Elegir vehículo + rango → PDF con mapa de la ruta (imagen estática), paradas, km, velocidad máxima,
  tabla de eventos. Generado en la API (render HTML → PDF) con límite de rango y puntos simplificados;
  la consulta respeta el filtro de `device_id` sobre `gps_data`.

### 5.3 Catálogo de reportes

**Enfoque: catálogo de reportes declarativo dentro de v2** (no un BI externo para clientes).

- **Por qué no Metabase/Superset para clientes**: hay que replicar el aislamiento por empresa y el ACL del
  rol 6 en otra herramienta (riesgo de fuga entre clientes, que es justo lo que queremos cerrar), otra
  cuenta/login, y la experiencia no se integra al WebView. Se puede usar Metabase **solo para internos**
  (roles 1-2) más adelante si hace falta análisis ad hoc.
- **Cómo funciona**: cada reporte es una definición en la API (`reports/catalog/*.py`): nombre, descripción,
  parámetros (rango de fechas, vehículos, grupo), consulta, columnas y tipo de gráfica. Un solo componente
  React genera filtros, KPIs, gráfica, tabla y exportación (CSV/XLSX/PDF). **Agregar un reporte = un archivo**;
  la seguridad (`device_filter()` por empresa/rol 6) la aplica el motor, no cada reporte.
- **Rendimiento**: tabla aditiva de agregados diarios por vehículo (`report_daily_device`: km, horas de motor,
  tiempo detenido, excesos de velocidad, eventos, primera/última posición) llenada por un job nocturno +
  recálculo del día en curso. Evita barrer `gps_data`/Traccar en cada consulta.
- **Reportes iniciales** (paridad + utilidad):
  1. Resumen de flota (km, horas de motor, % en línea, por día) — reemplaza KMs totales / KMs por fecha.
  2. Rutas y viajes por vehículo con paradas (mapa + línea de tiempo) — reemplaza Rutas por vehículo.
  3. Ubicaciones / último reporte — reemplaza Reporte ubicaciones.
  4. Excesos de velocidad y conducción.
  5. Uso fuera de horario y fines de semana.
  6. Entradas/salidas de geocercas.
  7. Alertas y eventos (SOS, corte de energía, encendido/apagado).
  8. Mantenimientos próximos por km/fecha.
- **Muy útil para el usuario**: favoritos, filtros recordados, comparación con el período anterior y
  **envío programado** por correo (semanal/mensual) — cola existente o tabla nueva aditiva.

## 6. Olas de migración

| Ola | Qué | Falta (API / front) | Riesgo |
|---|---|---|---|
| 0 | Fundación | `GET /api/v2/auth/menu` (ítems permitidos del rol desde `menu_by_roles`), `core/permissions.py` por capacidad, test de matriz de roles; AppShell con la navegación de §4 | bajo |
| 1 | Tiempo real | comandos detener/reactivar (roles 1,2,5; justificación; destino fijado por el servidor), escuchar/tracker, vista compartida; **abrir el mapa v2 a roles 3-6** | **alto** |
| 2 | Reportes | motor de catálogo + agregados diarios + reportes 1-3 (paridad) → luego 4-8 y envío programado | medio |
| 3 | Alertas + Notificaciones + Geocercas | alertas CRUD + sync Traccar + destinatarios; historial; geocercas (API ya existe) | medio |
| 4 | Mantenimientos + Mi empresa | mantenimientos; usuarios de la empresa (rol 5) con ACL de vehículos para rol 6 | medio |
| 5 | Administración interna | dispositivos, SIMs, sesiones, catálogos, eventos GPS, menús/roles | alto (permisos) |
| 6 | Finanzas | pantallas sobre el ledger/saldos existentes | medio |
| F5 | Consolidación | login v2, retirar JAB y PHP | alto |

## 7. Definición de "terminado" por módulo

1. Inventario de acciones del módulo PHP → checklist de paridad.
2. Endpoints con permisos + test de matriz (6 roles, otra empresa, sin sesión) + ACL rol 6.
3. Pantalla escritorio + móvil, capturas claro/oscuro, sin errores de consola.
4. Migración SQL versionada que repunta `menu_child.destination` → v2.
5. Convivencia 2-4 semanas vigilando `event_site`.
6. **Retiro** del método PHP (redirige a v2 / 410). Registrar en bitácora.

## 8. Delegación

Ola 0 API (endpoint de menú + permisos + tests) → Codex. AppShell/navegación → agy en paralelo.
Comandos sensibles (Ola 1) y la capa de permisos: diseño de Claude, implementación delegada con spec cerrada.

## 9. Bitácora

### 2026-10-24 — Ola 0 iniciada
- La API ya tenía `GET /auth/menu` (reemplazo del SP `GetMenu`) y `/auth/route-access` (reemplazo de
  `checkRoute`). Hallazgo: `services/menu.py` interpreta `complete_url` al revés (en el PHP
  `complete_url=1` = ruta interna bajo `/gui/`, `0` = valor crudo) → se corrige en esta ola.
- Delegado en paralelo:
  - **Codex → protektor-api**: `core/permissions.py` (capacidades por rol, `admin.*`/`finance.*` solo
    para admin interno, `role_id` NULL → nada), `GET /api/v2/auth/navigation` (secciones de §4 filtradas
    por capacidad + `menu_by_roles`), fix de `complete_url`, tests de matriz de roles.
  - **Codex → protektor-web** (agy sin cuota ese día): AppShell dinámico desde `/auth/navigation` (desplegables accesibles en
    escritorio; Mapa/Reportes/Alertas/Más en móvil; respaldo al menú fijo si la API falla).
- Contrato compartido del endpoint: ver anexo A.
- **Resultado (mismo día, EN PRODUCCIÓN)**: API `0099d82` (93 tests verdes; desplegada en
  protektor-backend; `/auth/navigation` responde 401 sin credenciales) y web `1ae2f0e` (build limpio,
  capturas roles 1 y 5 escritorio/móvil claro/oscuro sin errores de consola, rsync a `/var/www/protektor-v2`).
  Las pantallas clásicas se marcan con ícono de enlace externo. Hoy solo roles 1-2 llegan a v2
  (menu_child 38); abrir v2 a clientes es parte de la Ola 1.
- Nota operativa: agy sin cuota → la parte web la hizo Codex; el sandbox de Codex necesita
  `-c sandbox_workspace_write.network_access=true` para correr los tests contra MySQL local.

- Ajuste del usuario: navegación pasa de barra superior a **menú lateral izquierdo plegable** (ver §4).
- Ajuste del usuario: se elimina la barra de pestañas inferior en móvil; solo menú ☰.

### Siguiente
- Ola 1: abrir el acceso a v2 para roles 3-6 (repuntar/habilitar menu_child 38) y comandos de Tiempo real.
- En paralelo (inicio de Ola 2): `report_daily_device` + endpoint de resumen en vivo para el dashboard.

## Anexo A — Contrato `GET /api/v2/auth/navigation`
Requiere principal (sesión PHPSESSID o API key). Respuesta 200:
```json
{
  "role_id": 5,
  "role_name": "Advanced",
  "capabilities": ["fleet.view", "reports.view", "..."],
  "classic_href": "/gui/home/index",
  "sections": [
    {
      "key": "realtime", "label": "Tiempo real", "icon": "map-pin",
      "items": [ {"key": "map", "label": "Mapa en vivo", "href": "/v2/mapa", "v2": true} ]
    }
  ]
}
```
- Solo se devuelven secciones con al menos un ítem visible, en este orden:
  realtime, reports, alerts, geofences, maintenance, company, admin, finance.
- `v2: true` = pantalla nueva (/v2/...); `false` = pantalla del sistema clásico (/gui/...).
- Íconos posibles: map-pin, layout-dashboard, bell, hexagon, wrench, users, shield, wallet.

Secciones e ítems (legacy_ids = menu_child.menu_id que lo habilitan vía menu_by_roles; cap = capacidad requerida):

| sección (label, icon) | ítem key | label | href | v2 | legacy_ids | cap |
|---|---|---|---|---|---|---|
| realtime (Tiempo real, map-pin) | map | Mapa en vivo | /v2/mapa | sí | [1] | fleet.view |
| reports (Reportes, layout-dashboard) | fleet | Tablero de flota | /v2/ | sí | [38, 31, 8] | reports.view |
| reports | routes | Rutas por vehículo | /gui/monitor/routes_index | no | [6] | reports.view |
| reports | kms | Kilómetros totales | /gui/monitor/kms_index | no | [31] | reports.view |
| reports | kms_date | Kilómetros por fecha | /gui/monitor/statics_index | no | [8] | reports.view |
| reports | report | Reportes | /gui/monitor/report | no | [24] | reports.view |
| reports | locations | Ubicaciones | /gui/monitor/report_resume | no | [25] | reports.view |
| alerts (Alertas, bell) | rules | Reglas de alerta | /gui/alerts/index | no | [37] | alerts.manage |
| alerts | notifications | Notificaciones | /gui/monitor/mov_index | no | [32] | alerts.view |
| geofences (Geocercas, hexagon) | geofences | Geocercas | /gui/geocerca/index | no | [2] | geofences.view |
| maintenance (Mantenimientos, wrench) | maintenance | Mantenimientos | /gui/maintenance/index | no | [30] | maintenance.view |
| company (Mi empresa, users) | users | Usuarios | /gui/adminuser/list_users | no | [27] | company_users.manage |
| admin (Administración, shield) | companies | Empresas | /gui/admin/list_company | no | [12] | admin.view |
| admin | users | Usuarios | /gui/admin/list_users | no | [10] | admin.view |
| admin | devices | Dispositivos | /gui/devices/index | no | [13] | admin.view |
| admin | devices_monitor | Monitoreo de dispositivos | /gui/devices/monitor | no | [21] | admin.view |
| admin | sessions | Sesiones activas | /gui/admin/sessions | no | [36] | admin.view |
| admin | processes | Procesos | /gui/admin/processes | no | [18] | admin.view |
| admin | gps_events | Eventos GPS | /gui/messages/index | no | [17] | admin.view |
| admin | leads | Leads y Citas | /v2/leads | sí | [39] | admin.view |
| admin | mcp | Conector MCP | /v2/admin/mcp | sí | [] | admin.view |
| admin | roles | Roles | /gui/admin/list_roles | no | [11] | admin.super |
| admin | device_types | Tipos de dispositivo | /gui/admin/list_device_type | no | [29] | admin.super |
| admin | brands | Marcas | /gui/admin/list_device_brand | no | [28] | admin.super |
| admin | menus | Menús | /gui/admin/list_menu_tag | no | [33] | admin.super |
| finance (Finanzas, wallet) | ledger | Estado de resultados | /gui/financial/ledger | no | [22] | finance.view |
