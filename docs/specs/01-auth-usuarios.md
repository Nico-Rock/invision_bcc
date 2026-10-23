# 01 — Autenticación & Gestión de Usuarios

> Estado: 95% | Producción

---

## 1. Descripción funcional

Sistema de autenticación basado en JWT que cubre login, registro (admin-only), gestión de perfil, cambio de contraseña y logout con auditoría. No hay auto-registro — los administradores crean las cuentas.

---

## 2. Funciones

### 2.1 Login (JWT)
- **Qué hace:** Usuario envía email + password, recibe JWT con id, email, roles y expiración (24h).
- **Endpoint:** `POST /auth/token/` (OAuth2PasswordRequestForm)
- **Frontend:** `Login.jsx` → `AuthContext.jsx` (almacena token en localStorage)
- **Algoritmo:** HS256 con SECRET_KEY desde .env
- **Expiración:** 1440 minutos (24 horas)

### 2.2 Registro de usuarios (Admin-only)
- **Qué hace:** Admin crea cuenta con email, username, password. Password se hashea con bcrypt.
- **Endpoint:** `POST /users/` (requiere rol Admin)
- **Frontend:** `UserManagement.jsx` — modal de creación
- **Validación:** Email único, username único, password mínimo 8 caracteres (Pydantic)

### 2.3 Perfil de usuario
- **Qué hace:** Usuario ve y edita su perfil (nombre, apellido, teléfono). Admin puede editar cualquier perfil.
- **Endpoints:**
  - `GET /user/me` — perfil propio
  - `PUT /user/me` — actualizar perfil propio
  - `PUT /users/{user_id}/admin` — admin actualiza cualquier usuario
  - `GET /users/` — admin lista todos los usuarios
  - `GET /users/{user_id}/` — admin ve detalle de usuario
- **Frontend:** `UserManagement.jsx` (admin), perfil básico en `App.jsx`

### 2.4 Cambio de contraseña
- **Qué hace:** Usuario cambia su password (requiere password actual). Admin resetea sin verificación.
- **Endpoint:** `PUT /user/change-password`
- **Frontend:** Campo de reset en modal de edición de usuario (admin)

### 2.5 Logout & auditoría de sesión
- **Qué hace:** Registra evento LOGIN/LOGOUT en tabla `sesiones_acceso` con timestamp.
- **Endpoint:** `POST /auth/logout`
- **Frontend:** Botón logout en navegación → limpia localStorage, redirige a login
- **Tabla:** `SesionAcceso` (id, usuario_id, tipo_evento, timestamp)

---

## 3. Estado actual

| Función | Implementada | Tests | Bugs |
|---------|-------------|-------|------|
| Login JWT | Si | Si | SECRET_KEY débil (valor retirado del repositorio) |
| Registro | Si | Si | Sin validación de fuerza de password |
| Perfil | Si | Si | UI de perfil es placeholder |
| Cambio password | Si | Si | Sin flujo "olvidé mi password" |
| Logout | Si | Si | Token sigue válido hasta expirar |

**Gaps principales:**
- Sin refresh tokens — usuario debe re-loguearse cada 24h
- Sin 2FA
- Sin flujo de "olvidé mi contraseña" (email reset)
- Token en localStorage (vulnerable a XSS)
- Sin blacklist de tokens en logout
- Sin política de complejidad de password
- Sin historial de passwords

---

## 4. Ruta de escalabilidad

### Corto plazo (quick wins)
- Reemplazar SECRET_KEY por valor seguro generado (32+ bytes random)
- Agregar validación de fuerza de password (mayúscula, número, símbolo, 12+ chars)
- Implementar token blacklist en logout (Redis o tabla en DB)

### Mediano plazo
- **Refresh tokens:** Access token de 15 min + refresh token de 7 días. Endpoint `POST /auth/refresh` que rota el refresh token.
- **"Olvidé mi password":** Endpoint genera token temporal → envía email con link de reset → usuario define nuevo password. Requiere servicio de email (SendGrid, SES).
- **Migrar token storage:** De localStorage a httpOnly cookie (previene XSS). Requiere ajustar CORS y middleware.

### Largo plazo
- **2FA:** TOTP (Google Authenticator) o SMS. Tabla `user_2fa` con secret encriptado. Flujo: login normal → si 2FA habilitado → pide código → valida → emite token.
- **OAuth2/SSO:** Login con Microsoft (Azure AD) para integración institucional. Flujo PKCE con redirect URI.
- **Sesiones activas:** Dashboard donde el usuario ve dispositivos logueados y puede cerrar sesiones remotamente.
- **Auto-registro con aprobación:** Formulario público → admin aprueba → cuenta activada. Útil si se expande a más bibliotecas.

---

## 5. Dependencias

| Dependencia | Tipo | Crítica |
|-------------|------|---------|
| PyJWT | Backend | Si |
| Passlib/bcrypt | Backend | Si |
| localStorage | Frontend | Si (actual) |
| FastAPI OAuth2 | Backend | Si |
| Servicio de email | Futura | Para password reset |
| Redis | Futura | Para token blacklist |
