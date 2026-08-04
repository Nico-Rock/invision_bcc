# 09 — Panel de Administración

> Estado: 85% | Producción

---

## 1. Descripción funcional

Dashboard centralizado con 4 tabs accesibles (ARIA tablist) para gestión completa: ingesta masiva, usuarios, contenido y auditoría. Solo accesible para usuarios con rol Admin. Navegación por teclado entre tabs con flechas.

---

## 2. Funciones

### 2.1 Dashboard con tabs
- **Qué hace:** Container con 4 pestañas que organizan las funciones admin.
- **Frontend:** `AdminPanel.jsx`
- **Tabs:**
  1. Ingesta Masiva → `ExcelImporter.jsx`
  2. Usuarios → `UserManagement.jsx`
  3. Libros → `ContentManagement.jsx`
  4. Auditoría → `AuditLogs.jsx`
- **Accesibilidad:** ARIA `role="tablist"`, `role="tab"`, `role="tabpanel"`. Navegación con flechas izquierda/derecha.
- **Ruta:** `/admin/import` (protegida con `requireAdmin`)

### 2.2 Gestión de usuarios
- **Qué hace:** CRUD completo de usuarios con búsqueda, asignación de roles, y reset de password.
- **Frontend:** `UserManagement.jsx`
- **Operaciones:**
  - Listar usuarios con filtro por email/username
  - Crear usuario (modal: email, username, password)
  - Editar usuario (modal: email, username, nombre, apellido, teléfono, roles, password)
  - Eliminar usuario (confirmación)
  - Asignar/revocar roles (checkboxes)
- **Endpoints consumidos:** `GET/POST /users/`, `PUT /users/{id}/admin`, `DELETE /users/{id}/`, `POST /users/add_roles`, `DELETE /users/{id}/roles/{role_id}`

### 2.3 Gestión de contenido
- **Qué hace:** CRUD de audiolibros con búsqueda y gestión de metadata.
- **Frontend:** `ContentManagement.jsx`
- **Operaciones:**
  - Listar audiolibros con filtro por título/autor/género
  - Crear audiolibro (modal: título, autor, género, categoría, descripción, clasificaciones)
  - Editar audiolibro (mismo modal)
  - Eliminar audiolibro (confirmación)
- **Endpoints consumidos:** `GET/POST/PUT/DELETE /admin/audiolibros`, `GET /admin/categorias`

### 2.4 Logs de auditoría
- **Qué hace:** Muestra cronología de eventos login/logout con badges de color.
- **Frontend:** `AuditLogs.jsx`
- **Display:**
  - Lista de eventos ordenados por timestamp DESC
  - Badge verde: "INICIO SESION"
  - Badge rojo: "CERRO SESION"
  - Fecha/hora formateada en zona local
- **Endpoint consumido:** `GET /admin/auditoria/sesiones/`

### 2.5 Importación masiva
- **Qué hace:** Drag & drop de Excel, preview, y ejecución de importación batch.
- **Frontend:** `ExcelImporter.jsx`
- **Detalle completo:** Ver [08-ingesta-masiva.md](08-ingesta-masiva.md)

---

## 3. Estado actual

| Función | Implementada | Tests | Bugs |
|---------|-------------|-------|------|
| Tab container (ARIA) | Si | No | — |
| Gestión usuarios | Si | Si (backend) | Sin bulk operations |
| Gestión contenido | Si | Si (backend) | Sin gestión de categorías/clasificaciones |
| Audit logs | Si | Si (backend) | Sin paginación ni filtros |
| Importación masiva | Si | Parcial | SharePoint es mock |

**Gaps principales:**
- Sin dashboard de métricas (totales de usuarios, libros, sesiones activas)
- Sin gráficos o visualización de tendencias
- Sin actividad reciente del admin (quién hizo qué)
- Sin notificaciones de eventos importantes
- Sin export de datos (CSV/JSON)
- Audit logs sin paginación (performance con muchos registros)
- Sin filtros en audit logs (por usuario, fecha, tipo)
- Sin gestión independiente de categorías y clasificaciones
- Sin indicadores de salud del sistema
- Sin log de acciones admin (solo login/logout)

---

## 4. Ruta de escalabilidad

### Corto plazo
- Agregar paginación a audit logs (20 por página, botones prev/next)
- Agregar filtros a audit logs: por usuario, rango de fechas, tipo de evento
- Agregar contadores en el dashboard: total usuarios, total libros, sesiones hoy
- Agregar tab/sección para CRUD de categorías y clasificaciones

### Mediano plazo
- **Dashboard de métricas:** Cards con KPIs:
  - Usuarios activos (últimos 7 días)
  - Libros más escuchados (top 10)
  - Horas totales de escucha
  - Nuevos registros por semana
  - Gráficos con Chart.js o Recharts (líneas de tendencia)
- **Audit trail completo:** Registrar todas las acciones admin (crear/editar/eliminar usuarios, libros, roles). Tabla `admin_actions` (admin_id, action, target_type, target_id, details_json, timestamp). Responde "quién cambió qué y cuándo".
- **Export de datos:** Botón "Exportar" en cada sección. Genera CSV o JSON descargable. Para audit logs, usuarios, y catálogo.
- **Notificaciones admin:** Alertas in-app para eventos: nuevo usuario registrado, importación completada, error en sistema. Badge con contador en header.

### Largo plazo
- **Panel multi-biblioteca:** Si la plataforma se expande, admin central que gestiona múltiples instancias/tenants. Métricas consolidadas. Gestión de licencias.
- **Workflows de aprobación:** Acciones sensibles (eliminar usuario, eliminar libro) requieren aprobación de segundo admin. Cola de aprobaciones pendientes.
- **API de gestión:** RESTful API para operaciones admin que permita integración con sistemas externos (dashboards BI, scripts de automatización). Documentación OpenAPI.
- **Monitoring & alertas:** Integración con herramientas de monitoreo (Grafana, Azure Monitor). Alertas por email/SMS cuando: servidor down, storage al 80%, errores 500 frecuentes, login attempts sospechosos.

---

## 5. Dependencias

| Dependencia | Tipo | Crítica |
|-------------|------|---------|
| React state (tabs) | Frontend | Si |
| AuthContext (isAdmin) | Frontend | Si |
| ARIA tab pattern | Frontend | Si (accesibilidad) |
| Todos los endpoints admin | Backend | Si |
| ProtectedRoute (requireAdmin) | Frontend | Si |
