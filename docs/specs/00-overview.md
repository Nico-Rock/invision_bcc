# 00 — Overview: Invision

> Spec de referencia — Biblioteca Digital Accesible para la Biblioteca Central para Ciegos

**Fecha:** 2026-08-04
**Estado:** documentado
**Autor:** Nico (via Vortex/TARS)

---

## 1. Qué es Invision

Plataforma de audiolibros accesible diseñada para usuarios con discapacidad visual. Permite buscar, escuchar y trackear progreso en audiolibros con accesibilidad premium (WCAG 2.1 AA/AAA).

**Stack:**
- Backend: FastAPI + SQLAlchemy + Azure Blob Storage
- Frontend: React 19 + Vite + vanilla CSS
- DB: SQLite (dev) / SQL Server (prod)
- Infra: Docker + Nginx

---

## 2. Módulos funcionales

| # | Módulo | Spec | Estado | Completitud |
|---|--------|------|--------|-------------|
| 01 | Auth & Usuarios | [01-auth-usuarios.md](01-auth-usuarios.md) | Producción | 95% |
| 02 | RBAC (Roles) | [02-rbac.md](02-rbac.md) | Funcional | 80% |
| 03 | Catálogo Audiolibros | [03-catalogo-audiolibros.md](03-catalogo-audiolibros.md) | Producción | 85% |
| 04 | Búsqueda | [04-busqueda.md](04-busqueda.md) | Básica | 70% |
| 05 | Streaming Audio | [05-streaming-audio.md](05-streaming-audio.md) | Producción | 90% |
| 06 | Reproductor | [06-reproductor.md](06-reproductor.md) | Producción | 90% |
| 07 | Progreso & Historial | [07-progreso-historial.md](07-progreso-historial.md) | Producción | 95% |
| 08 | Ingesta Masiva | [08-ingesta-masiva.md](08-ingesta-masiva.md) | Parcial | 70% |
| 09 | Admin Panel | [09-admin-panel.md](09-admin-panel.md) | Producción | 85% |
| 10 | Accesibilidad | [10-accesibilidad.md](10-accesibilidad.md) | Producción | 90% |
| 11 | Infra & Config | [11-infra-config.md](11-infra-config.md) | Dev-ready | 60% |
| 12 | Admin Dashboard (panel operativo local) | [12-admin-dashboard.md](12-admin-dashboard.md) | Solo lectura, en desarrollo | 40% |

---

## 3. Mapa de integración

```
FRONTEND (React 19 + Vite)
│
├── Login.jsx ──────────────────── POST /auth/token/
├── Home.jsx ───────────────────── POST /search
│                                  GET  /genres
│                                  GET  /books-by-genre/{genre}
│                                  GET  /audio-by-id/{id}
├── AudioPlayer.jsx ────────────── GET  /stream-audio-simple/{user}/{book}/{ch}
│                                  POST /guardar-progreso
│                                  GET  /obtener-progreso/{user}/{book}
├── AdminPanel.jsx
│   ├── ExcelImporter.jsx ──────── POST /admin/importar-lote
│   ├── UserManagement.jsx ─────── CRUD /users/, /roles/, /users/add_roles
│   ├── ContentManagement.jsx ──── CRUD /admin/audiolibros, /admin/categorias
│   └── AuditLogs.jsx ─────────── GET  /admin/auditoria/sesiones/
└── A11yBar.jsx ────────────────── (local state: contraste, texto, earcons)

ADMIN DASHBOARD (Python http.server, standalone — módulo 12)
│                                  Independiente de InvisionAPI-main
├── /api/overview, /api/access-logs, /api/users ── lectura directa a DB
├── /api/books, /api/stream-sas ──────────────── lectura directa a Blob
└── (planeado) /api/admin/crear-libro,
    /api/admin/subir-pista ──────────────────── escritura DB + Blob,
                                                  ver 12-admin-dashboard.md

BACKEND (FastAPI)
│
├── Auth ── JWT (HS256, 24h expiry)
├── DB ──── SQLAlchemy → SQLite | SQL Server
├── Blob ── Azure Blob Storage (streaming MP3)
└── Graph ─ Microsoft Graph API (SharePoint, mock)

MODELOS DE DATOS
│
├── Usuario ←──→ Role (M:M via UserRole)
├── Audiolibro ←──→ Clasificacion (M:M via audiolibro_clasificacion)
├── Audiolibro ──→ Categoria (M:1)
├── ProgresoAudiolibro ──→ Usuario + Audiolibro
└── SesionAcceso ──→ Usuario (audit trail)
```

---

## 4. Bugs críticos conocidos

| Severidad | Problema | Ubicación |
|-----------|----------|-----------|
| CRITICO | Credenciales SQL Server y Azure hardcodeadas en código | `config.py` |
| CRITICO | CORS acepta cualquier origen | `main.py` |
| ALTO | SharePoint transfer es mock (sube dummy content) | `sharepoint.py` |
| ALTO | Géneros hardcodeados en frontend ("Biografías", "Literatura") | `App.jsx` |
| MEDIO | Sin refresh tokens (re-login cada 24h) | Auth flow |
| MEDIO | Sin paginación en audit logs | `AuditLogs.jsx` |
| BAJO | Regex frágil para detectar capítulos | `crud.py` / `routes.py` |

---

## 5. Dependencias externas

| Servicio | Uso | Estado |
|----------|-----|--------|
| Azure Blob Storage | Almacenamiento y streaming de MP3 | Configurado |
| SQL Server | Base de datos producción | Configurado (creds en código) |
| Microsoft Graph API | Ingesta desde SharePoint | Mock (no implementado) |
| Web Speech API | Búsqueda por voz + TTS | Navegador nativo |
| Web Audio API | Earcons/audio cues | Navegador nativo |
