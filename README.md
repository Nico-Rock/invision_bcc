# Invision

Biblioteca digital accesible de audiolibros para la Biblioteca Central para Ciegos. Está diseñada para operarse con teclado y lector de pantalla, tanto por los socios como por quienes administran el catálogo.

## Qué incluye

| Carpeta | Contenido |
|---|---|
| `InvisionAPI-main/` | API en FastAPI y SQLAlchemy: autenticación, catálogo, búsqueda, streaming de audio y administración. |
| `frontend/` | Aplicación web en React 19 y Vite. |
| `admin-dashboard/` | Panel operativo local para auditar el catálogo y cargar libros y pistas. |
| `verificacion/a11y/` | Procedimiento repetible de verificación de accesibilidad (axe-core y matriz de lectores de pantalla). |
| `docs/` | Especificaciones por módulo, PRD y auditorías. |
| `.specops/` | Constitución del proyecto y especificaciones de las funciones nuevas, con su plan y tareas. |
| `aprobaciones/` | Cambios que requieren aprobación antes de tocar producción. |

## Requisitos

- Python 3.10 o superior
- Node.js 20 o superior
- Una cuenta de Azure Blob Storage si se quiere reproducir audio real. Sin ella, la API arranca igual con SQLite.

## Puesta en marcha

1. Crear la configuración local. El archivo `.env` no se sube al repositorio.

   ```bash
   cp .env.example .env
   ```

   Completar `SECRET_KEY` con una clave larga y aleatoria:

   ```bash
   python3 -c "import secrets; print(secrets.token_urlsafe(48))"
   ```

2. API, en el puerto 8000:

   ```bash
   python3 -m venv .venv && source .venv/bin/activate
   pip install -r InvisionAPI-main/audiobooks/requirements.txt
   cd InvisionAPI-main/audiobooks && uvicorn main:app --reload --port 8000
   ```

   También se puede levantar con Docker desde `InvisionAPI-main/` con `docker compose up --build`.

3. Frontend, en el puerto 3000:

   ```bash
   cd frontend && npm install && npm run dev
   ```

4. Panel operativo, en el puerto 8888:

   ```bash
   python3 admin-dashboard/server.py 8888
   ```

   Las acciones de escritura exigen `ADMIN_TOKEN` en el `.env`. Sin él, el panel no autoriza nada.

## Pruebas

```bash
# Panel operativo
python3 -m pytest admin-dashboard -q

# API
cd InvisionAPI-main && python3 -m pytest audiobooks scripts -q

# Frontend
cd frontend && npm run test:unit
cd frontend && npm run test:a11y
```

Tres pruebas de `test_routes.py` son de integración y necesitan credenciales reales de Azure. Sin ellas fallan, y no indican un defecto del código.

## Accesibilidad

La meta es WCAG 2.2 AA, con contraste AAA en el texto. No se afirma una cifra sin un informe de [verificacion/a11y](verificacion/a11y/README.md), que indica qué mide la herramienta automática y qué debe revisar una persona.

## Documentación

- [Visión general y mapa de módulos](docs/specs/00-overview.md)
- [PRD: biblioteca actualizada](docs/prd/2026-09-29-biblioteca-actualizada-prd.md)
- [Constitución del proyecto](.specops/constitution.md)
- [Auditorías](docs/auditoria)

## Seguridad

- No subas `.env`, bases de datos ni claves. `.env.example` es la única plantilla versionada.
- Los usuarios `admin@invision.com` y `user@invision.com` que crea la API al arrancar son solo de desarrollo. Cambia sus contraseñas antes de cualquier despliegue.
- La política de CORS es abierta y debe restringirse al dominio del frontend en producción.
- Si encuentras un problema de seguridad, avísalo en privado a quien mantiene el repositorio y no abras un issue público.
