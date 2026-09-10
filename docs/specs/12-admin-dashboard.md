# 12 — Admin Dashboard (Panel Operativo Local)

> Estado: 70% | Carga de contenido construida y probada, **sin desplegar** (bloqueada por [13](13-divergencia-esquema-produccion.md))

---

## 1. Descripción funcional

Herramienta operativa independiente del `frontend/` principal — un servidor Python (`http.server`) con frontend HTML/JS vanilla, sin build step ni framework. Pensada para auditoría, diagnóstico estructural, y (a futuro) gestión de contenido, con navegación por sidebar en vez del patrón de tabs ARIA que usa el Admin Panel del `frontend/` (módulo [09-admin-panel.md](09-admin-panel.md)).

Se conecta directo a Azure Blob Storage y a la base de datos (Azure SQL en producción, con fallback a SQLite local si el firewall bloquea la conexión), sin pasar por `InvisionAPI-main` — la API de producción está desactualizada y no se usa como intermediaria acá.

**Nace fuera del spec de referencia original** (`00-overview.md` no lo mencionaba hasta esta revisión) — se construyó como herramienta operativa ad-hoc y se formaliza como módulo en este documento.

**Mandato operativo declarado en el propio panel** (sección Gobernanza): "Ningún cambio a bases de datos o código en producción sin validación formal previa del equipo BCC." Esto aplica directamente a cualquier extensión de este módulo que agregue escritura (ver §4).

---

## 2. Funciones

### 2.1 Resumen Ejecutivo (KPIs)
- **Qué hace:** Cards con totales — libros, archivos, storage usado, usuarios. Estado de conexión a Azure SQL vs. fallback SQLite.
- **Endpoint:** `GET /api/overview`
- **Frontend:** sección `view-overview`

### 2.2 Registros de Acceso
- **Qué hace:** Tabla de eventos LOGIN/LOGOUT, últimos 100, ordenados por timestamp DESC.
- **Endpoint:** `GET /api/access-logs`
- **Frontend:** sección `view-logs`

### 2.3 Explorador de Audios
- **Qué hace:** Grilla de audiolibros derivada de listar blobs en Azure Storage (agrupados por prefijo `{nombre}/`), con búsqueda por título y reproductor de preview embebido (SAS de solo lectura, expira en 2h).
- **Endpoints:** `GET /api/books` (con `?q=` y `?refresh=true`), `GET /api/stream-sas?blob=`
- **Frontend:** sección `view-books`, `player-bar` flotante
- **Nota:** no lee de la tabla `audiolibros` — el catálogo mostrado acá es 100% derivado de Blob Storage, puede divergir de lo que hay en SQL si un libro tiene fila en BD pero no archivos subidos (o viceversa).

### 2.4 Usuarios y Soporte
- **Qué hace:** Directorio de usuarios con roles agregados (`STRING_AGG`/`GROUP_CONCAT` según el motor).
- **Endpoint:** `GET /api/users`
- **Frontend:** sección `view-users`

### 2.5 Gobernanza y Reglas
- **Qué hace:** Contenido estático — mandato operativo del panel (continuidad, custodia de contenido accesible, cero riesgo en producción).
- **Frontend:** sección `view-governance`, sin backend.

---

## 3. Estado actual

| Función | Implementada | Tests | Bugs |
|---------|-------------|-------|------|
| Resumen Ejecutivo (KPIs) | Si | No | — |
| Registros de acceso | Si | No | Sin paginación (mismo gap que 09) |
| Explorador de audios | Si | No | Catálogo puede divergir de la tabla `audiolibros` (ver 2.3) |
| Usuarios y soporte | Si | No | Solo lectura, sin gestión de roles |
| Gobernanza (estático) | Si | N/A | — |
| Carga de contenido — backend (`crear_libro`, `subir_pista`, endpoints POST) | Si | Si (34) | **Sin desplegar**: bloqueado por [13](13-divergencia-esquema-produccion.md) |
| Carga de contenido — frontend (pasos 1 a 3, accesible) | Si | Manual pendiente | El formulario cambia según la decisión del board |
| Seguridad de escritura (localhost, token, guarda de `Host`) | Si | Si | — |

**Gaps principales:**
- **Bloqueante:** el esquema de producción no coincide con el modelo, así que la carga no se puede desplegar — ver [13-divergencia-esquema-produccion.md](13-divergencia-esquema-produccion.md)
- Verificación manual con lector de pantalla real (VoiceOver/NVDA) todavía no hecha
- El resto de las secciones (overview, logs, books, users) sigue sin accesibilidad: solo la de carga y la navegación fueron tratadas
- Los items de navegación no exponen cuál está activo (`aria-current`): se llega a todos con teclado, pero no se anuncia dónde está uno parado
- Autenticación de un solo token compartido: alcanza para operación local, insuficiente si se expone en remoto
- `GET /api/stream-sas` emite un SAS de lectura para cualquier blob sin exigir token (preexistente)

---

## 4. Ruta de escalabilidad

### Corto plazo
- Implementar carga de contenido (crear audiolibro + subir pistas de audio) según [2026-09-02-carga-contenido-accesible-design.md](superpowers/specs/2026-09-02-carga-contenido-accesible-design.md) — servidor como intermediario, sin SAS de escritura en el navegador, sin SharePoint real.
- Portar las primitivas de accesibilidad ya probadas en `frontend/` (earcons, TTS, live regions — ver [10-accesibilidad.md](10-accesibilidad.md)) a JS vanilla para este panel, empezando por la sección de carga de contenido.
- Validación formal del equipo BCC antes de habilitar cualquier escritura en producción (mandato propio del panel, §2.5).

### Mediano plazo
- Autenticación propia del panel (hoy no tiene) si se expone más allá de red local/VPN.
- Reconciliar el Explorador de Audios (2.3) contra la tabla `audiolibros` para detectar divergencias (libro en BD sin archivos, o archivos en Blob sin fila en BD).
- Extender accesibilidad al resto de las secciones (no solo carga de contenido) si el panel pasa a ser de uso regular del bibliotecario, no solo herramienta de auditoría de Nico.

### Largo plazo
- Evaluar si este módulo absorbe funciones hoy duplicadas en el Admin Panel de `frontend/` (09) o si se mantienen como herramientas separadas con propósitos distintos (auditoría/operación vs. gestión de usuarios).
- Si la carga de contenido se vuelve el camino oficial, migrar el endpoint a `InvisionAPI-main` en vez de mantenerlo como tercer camino de escritura paralelo (ver nota en el design doc de carga de contenido, §6).

---

## 5. Dependencias

| Dependencia | Tipo | Crítica |
|-------------|------|---------|
| Azure Blob Storage SDK | Backend | Si |
| pymssql (Azure SQL) | Backend | Si (con fallback a SQLite) |
| Variables de entorno (`.env` en raíz del proyecto) | Config | Si |
| Validación formal BCC (mandato de gobernanza) | Proceso | Si, antes de habilitar escritura |
| Ninguna dependencia de `InvisionAPI-main` | — | Diseño deliberado |
