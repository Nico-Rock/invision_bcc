# 11 — Infraestructura & Configuración

> Estado: 60% | Dev-ready

---

## 1. Descripción funcional

Infraestructura que soporta la app: base de datos (SQLite dev / SQL Server prod), configuración via .env, seeding de datos iniciales, CORS, Docker + Nginx para deployment, y suite de tests con pytest. Es el módulo con más deuda técnica — credenciales hardcodeadas, sin migraciones, CORS abierto.

---

## 2. Funciones

### 2.1 Base de datos & ORM
- **Qué hace:** SQLAlchemy ORM con soporte para SQLite (desarrollo) y SQL Server (producción).
- **Backend:** `database.py` — engine y session factory
- **Config:**
  - Dev: `DATABASE_URL="sqlite:///invision.db"` (desde .env)
  - Prod: Connection string SQL Server hardcodeada en `config.py`
  - Driver: pyodbc con ODBC Driver 18 for SQL Server
- **Modelos:** 8 tablas (ver [00-overview.md](00-overview.md) sección 3)
- **Archivo local:** `invision.db` (SQLite de desarrollo con datos seed)

### 2.2 Seeding de datos iniciales
- **Qué hace:** Al iniciar la app, crea roles y usuarios de prueba si no existen.
- **Backend:** `main.py` → `seed_database()` ejecuta en `@app.on_event("startup")`
- **Datos seed:**
  - Roles: "Admin", "User"
  - Admin: `admin@invision.com` / `admin123` (rol Admin)
  - User: `user@invision.com` / `user123` (rol User)
- **Problema:** Credenciales de prueba hardcodeadas en código fuente.

### 2.3 Configuración y secretos
- **Qué hace:** Carga configuración desde variables de entorno (.env) con python-dotenv.
- **Archivo .env:**
  ```
  SECRET_KEY=<retirada del repositorio>
  ALGORITHM=HS256
  ACCESS_TOKEN_EXPIRE_MINUTES=1440
  DATABASE_URL="sqlite:///invision.db"
  ```
- **Archivo .env.example (en repo Vortex):**
  ```
  SECRET_KEY=
  ALGORITHM=HS256
  ACCESS_TOKEN_EXPIRE_MINUTES=1440
  DATABASE_URL=
  AZURE_ACCOUNT_NAME=
  AZURE_ACCOUNT_KEY=
  AZURE_CONTAINER_NAME=
  MS_CLIENT_ID=
  MS_CLIENT_SECRET=
  MS_TENANT_ID=
  ```
- **Problema crítico:** `config.py` tiene credenciales SQL Server y Azure hardcodeadas como fallback.

### 2.4 CORS
- **Qué hace:** Configura Cross-Origin Resource Sharing para permitir requests del frontend.
- **Backend:** `main.py` → `CORSMiddleware`
- **Config actual:**
  ```python
  allow_origin_regex=r"https?://.*"  # CUALQUIER origen
  allow_credentials=True
  allow_methods=["*"]
  allow_headers=["*"]
  ```
- **Problema:** Extremadamente permisivo. En producción debe restringirse al dominio del frontend.

### 2.5 Docker & deployment
- **Qué hace:** Containerización de la app con Docker + reverse proxy Nginx.
- **Archivos:**
  - `Dockerfile` — imagen del backend FastAPI
  - `docker-compose.yml` — orquestación multi-container
  - `nginx_dev.conf` — reverse proxy para desarrollo
  - `nginx_test.conf` — reverse proxy para test
- **Componentes Docker:**
  - Container FastAPI (puerto 8000)
  - Container Nginx (puertos 80/443)
  - Volumes para persistencia

### 2.6 Testing
- **Qué hace:** Suite de tests pytest con fixtures, mocks, y TestClient de FastAPI.
- **Archivos:**
  - `test_routes.py` — 545 líneas, 30+ tests
  - `test_database.py` — tests de conexión a BD
- **Fixtures:**
  - `test_db` — SQLite in-memory
  - `client` — FastAPI TestClient
  - `admin_token` — JWT de admin para tests autenticados
  - `test_user` — usuario de prueba
- **Mocking:** Azure Blob y SharePoint mockeados (no hay llamadas reales en tests)
- **Cobertura:** Backend bien cubierto. Frontend sin tests.

### 2.7 Frontend build
- **Qué hace:** Build tooling para el SPA de React.
- **Stack:** Vite 8 + React 19 + ESLint
- **Config:** `vite.config.js`, `eslint.config.js`
- **API URL:** `frontend/src/config.js` — `API_BASE_URL` hardcodeada o desde env
- **Build:** `npm run build` → genera `/dist/`
- **Dev:** `npm run dev` → Vite dev server con HMR

---

## 3. Estado actual

| Función | Implementada | Tests | Bugs |
|---------|-------------|-------|------|
| SQLAlchemy ORM | Si | Si | — |
| SQLite (dev) | Si | Si | — |
| SQL Server (prod) | Si | No (requiere infra) | Creds hardcodeadas |
| Seeding | Si | Si | Creds de prueba en código |
| .env config | Parcial | No | Fallbacks hardcodeados |
| CORS | Si | No | Acepta cualquier origen |
| Docker | Si | No | — |
| Nginx | Si | No | — |
| Tests backend | Si | Si | — |
| Tests frontend | No | No | No existen |
| Vite build | Si | No | — |

**Bugs críticos:**
1. `config.py` línea 15+: SQL_PASSWORD y AZURE_ACCOUNT_KEY visibles en código fuente
2. CORS `allow_origin_regex=r"https?://.*"` — cualquier sitio puede hacer requests
3. SECRET_KEY es `<retirada del repositorio>` — débil: debe rotarse y no documentarse
4. Credenciales seed hardcodeadas (admin123, user123)

**Gaps principales:**
- Sin framework de migraciones (Alembic). Cambios de schema requieren recrear tablas.
- Sin validación de config al startup (app arranca con config incompleta)
- Sin health check endpoint (`GET /health`)
- Sin separación dev/staging/prod en config
- Sin secrets management (KeyVault, AWS Secrets Manager)
- Sin CI/CD pipeline (GitHub Actions)
- Sin test coverage reporting
- Sin frontend tests (React Testing Library, Cypress)
- Sin logging estructurado
- Sin connection pooling configurado
- Sin rate limiting

---

## 4. Ruta de escalabilidad

### Corto plazo
- **Limpiar secretos del código:** Mover TODAS las credenciales a .env. Eliminar fallbacks hardcodeados de config.py. Rotar credenciales comprometidas.
- **SECRET_KEY seguro:** Generar con `python -c "import secrets; print(secrets.token_hex(32))"`. Mínimo 32 bytes random.
- **Restringir CORS:** `allow_origins=["https://invision.biblioteca.org"]` (dominio real del frontend).
- **Health check:** Endpoint `GET /health` que verifica conexión a BD y Azure Blob. Retorna status 200/503.
- **Alembic:** Inicializar framework de migraciones. Generar migración inicial desde modelos existentes. Flujo: `alembic revision --autogenerate` → `alembic upgrade head`.
- **Eliminar seed de producción:** Condicionar `seed_database()` a variable de entorno `SEED_DB=true` (solo dev/test).

### Mediano plazo
- **CI/CD pipeline (GitHub Actions):**
  ```yaml
  on: [push, pull_request]
  jobs:
    test:
      - pytest con coverage report
      - axe-core accessibility audit
      - ESLint + type checking
    build:
      - Docker build + push a registry
    deploy:
      - Deploy a staging (auto)
      - Deploy a producción (manual approval)
  ```
- **Frontend testing:**
  - Unit tests con React Testing Library (componentes, hooks, contexts)
  - Integration tests con Cypress (flujos completos: login → buscar → reproducir)
  - Accessibility tests con cypress-axe
- **Secrets management:** Azure KeyVault para producción. GitHub Secrets para CI/CD. Rotación automática de API keys.
- **Logging estructurado:** Python `structlog` con JSON output. Campos: timestamp, level, request_id, user_id, action. Centralizar en Azure Monitor o ELK stack.
- **Rate limiting:** Middleware con slowapi o custom. Límites por IP y por usuario. Protección contra brute force en login.
- **Config por entorno:** Archivos `.env.dev`, `.env.staging`, `.env.prod`. Variable `APP_ENV` determina cuál cargar. Validación de campos requeridos al startup con Pydantic Settings.

### Largo plazo
- **Kubernetes:** Migrar de Docker Compose a K8s para escalado horizontal. Pods separados para API y workers (Celery). HPA (Horizontal Pod Autoscaler) basado en requests/segundo. Azure AKS o EKS.
- **Database escalable:** Migrar de SQL Server a PostgreSQL (mejor soporte, menor costo, extensiones como pg_trgm para búsqueda). Read replicas para queries pesadas. Connection pooling con PgBouncer.
- **Observabilidad completa:**
  - Metrics: Prometheus + Grafana (latencia, throughput, error rate)
  - Traces: OpenTelemetry con Jaeger (tracing distribuido)
  - Logs: ELK stack o Azure Monitor
  - Alertas: PagerDuty o OpsGenie para incidentes
- **Disaster recovery:** Backups automáticos de BD (diarios). Backup de Azure Blob (geo-redundant). Runbook de recovery documentado. RTO/RPO definidos.
- **Multi-tenancy:** Si se expande a múltiples bibliotecas: schema-per-tenant o row-level security. Aislamiento de datos. Admin central + admin por biblioteca.
- **Compliance:** Audit de seguridad (OWASP Top 10). GDPR compliance (derecho al olvido, portabilidad). Política de retención de datos. Encryption at rest y in transit.

---

## 5. Dependencias

| Dependencia | Tipo | Crítica |
|-------------|------|---------|
| SQLAlchemy | Backend | Si |
| pyodbc | Backend | Si (SQL Server) |
| python-dotenv | Backend | Si |
| FastAPI CORSMiddleware | Backend | Si |
| Docker | Infra | Si (deploy) |
| Nginx | Infra | Si (reverse proxy) |
| pytest | Dev | Si (testing) |
| Vite | Frontend | Si (build) |
| React | Frontend | Si |
