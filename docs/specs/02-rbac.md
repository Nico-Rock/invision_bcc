# 02 — RBAC (Control de Acceso Basado en Roles)

> Estado: 80% | Funcional

---

## 1. Descripción funcional

Sistema de dos roles fijos (Admin, User) con asignación M:M mediante tabla junction. Los endpoints admin verifican rol "Admin" en el JWT. No hay permisos granulares — es binario: eres Admin o no.

---

## 2. Funciones

### 2.1 Definición de roles
- **Qué hace:** Mantiene roles en tabla `roles` con nombre y descripción. Seeding crea "Admin" y "User" al iniciar.
- **Endpoint:** `GET /roles/` (admin-only) — lista roles disponibles
- **Tabla:** `roles` (id, name, description)
- **Seed:** `main.py` → `seed_database()` crea los dos roles si no existen

### 2.2 Asignación de roles a usuarios
- **Qué hace:** Admin asigna/revoca roles a usuarios via tabla junction `user_roles`.
- **Endpoints:**
  - `GET /user/{user_id}/roles` — ver roles del usuario
  - `POST /users/add_roles` — asignar rol
  - `DELETE /users/{user_id}/roles/{role_id}` — revocar rol
  - `DELETE /roles/{role_id}/` — eliminar rol del sistema
- **Frontend:** Checkboxes en modal de edición de usuario (`UserManagement.jsx`)
- **Tabla:** `user_roles` (user_id, role_id, assigned_at)

### 2.3 Protección de endpoints (backend)
- **Qué hace:** Cada endpoint admin decodifica el JWT y verifica que `"Admin"` esté en el array de roles. Si no, retorna 403.
- **Patrón:**
  ```python
  user_info = decode_access_token(token)
  if "Admin" not in user_info["roles"]:
      raise HTTPException(status_code=403, detail="No autorizado")
  ```
- **Endpoints protegidos:** CRUD usuarios, CRUD audiolibros, importación batch, auditoría, presigned URLs, gestión de roles

### 2.4 Protección de rutas (frontend)
- **Qué hace:** Componente `ProtectedRoute` verifica autenticación y rol admin antes de renderizar.
- **Componente:** `App.jsx` → `ProtectedRoute({ children, requireAdmin })`
- **Lógica:** No auth → redirect `/login`. No admin + requireAdmin → redirect `/`.
- **Navegación:** Menú lateral muestra/oculta "Admin" según rol.

---

## 3. Estado actual

| Función | Implementada | Tests | Bugs |
|---------|-------------|-------|------|
| Roles fijos (Admin/User) | Si | Si | Solo 2 roles, sin extensibilidad |
| Asignación M:M | Si | Si | Sin auditoría de cambios |
| Protección backend | Si | Si | Sin cache de roles (decode en cada request) |
| Protección frontend | Si | No | Protección solo visual (backend es la real) |

**Gaps principales:**
- Solo 2 roles hardcodeados — no hay creación de roles custom en runtime
- Sin permisos granulares (no hay tabla de capabilities/permissions)
- Sin jerarquía de roles (Admin no "hereda" de User formalmente)
- Sin auditoría de quién asignó/revocó qué rol y cuándo
- Sin roles por recurso (ej: "editor de categoría X")

---

## 4. Ruta de escalabilidad

### Corto plazo
- Agregar campo `created_by` y `revoked_by` en `user_roles` para auditoría de cambios
- Cache del token decodificado por request (middleware que parsea una vez y lo pone en `request.state`)
- Agregar rol "Editor" para gestión de contenido sin acceso a usuarios

### Mediano plazo
- **Permisos granulares:** Tabla `permissions` (id, name, description) + tabla junction `role_permissions`. Cada endpoint verifica permission, no rol. Ejemplo: `can_manage_users`, `can_manage_books`, `can_view_audit`.
- **Roles dinámicos:** UI para crear/editar roles con checkboxes de permisos. Admin define qué puede hacer cada rol sin tocar código.
- **Middleware de autorización:** Decorador `@requires_permission("can_manage_users")` en vez de verificar roles manualmente en cada endpoint.

### Largo plazo
- **ABAC (Attribute-Based Access Control):** Políticas basadas en atributos del usuario, recurso y contexto. Ejemplo: "Editor puede modificar audiolibros solo de su categoría asignada".
- **Integración LDAP/Azure AD:** Roles sincronizados desde directorio institucional. Login SSO trae roles automáticamente.
- **Separación de tenants:** Si la plataforma se expande a múltiples bibliotecas, cada tenant tiene sus propios roles y permisos aislados.

---

## 5. Dependencias

| Dependencia | Tipo | Crítica |
|-------------|------|---------|
| JWT payload (roles array) | Backend | Si |
| SQLAlchemy relationships | Backend | Si |
| React Router Navigate | Frontend | Si |
| AuthContext (isAdmin) | Frontend | Si |
