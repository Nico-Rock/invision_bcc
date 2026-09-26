# Scripts operativos de la API

## `snapshot_catalogo.py` — catálogo real en local (SOLO DEMO / DESARROLLO)

Copia las fichas de `audiolibros` de producción a la base SQLite local, para que la app local muestre el catálogo real. Spec 001, R21, R22, R36 y R38.

**Qué garantiza**
- Sobre producción ejecuta **solo `SELECT`**. La conexión va envuelta en una guarda que rechaza cualquier otra sentencia.
- Copia solo el catálogo. **No** copia `usuarios` ni `progreso_audiolibros`: la base local conserva sus cuentas demo.
- **No cambia a qué base apunta nada.** Sin `DATABASE_URL` explícito, la API sigue usando Azure SQL (producción). El modo demo existe solo mientras se arranca la API así.
- El audio no se copia: la API local lo lee de Azure Blob por el nombre de cada ficha, así que los libros suenan de verdad.

**Cómo levantar la demo** (desde la raíz del repo)

```bash
# 1. API local contra SQLite. El DATABASE_URL va en el comando, nunca en .env (R36)
docker run -d --name invision_local -p 8000:8000 --env-file .env \
  -e DATABASE_URL=sqlite:///invision.db \
  -v "$PWD/InvisionAPI-main/audiobooks:/app" invisionapi-main-invision-api:latest \
  uvicorn main:app --host 0.0.0.0 --port 8000 --reload --reload-dir /app

# 2. Copiar el catálogo (solo lectura sobre producción)
.venv/bin/python InvisionAPI-main/scripts/snapshot_catalogo.py \
  --destino InvisionAPI-main/audiobooks/invision.db

# 3. Reiniciar la API: la conexión abierta conserva una caché vieja del archivo
#    reemplazado a través del volumen de Docker ("database disk image is malformed")
docker restart invision_local

# 4. Frontend
cd frontend && npm run dev   # http://localhost:3000
```

Las cuentas demo son `admin@invision.com` y `user@invision.com`, y **solo existen en la base local**. Su contraseña de demo no se versiona; pídesela a Nico.

**Volver a los datos reales:** borrar el contenedor (`docker rm -f invision_local`) y arrancar la API sin `-e DATABASE_URL`. Con eso usa Azure SQL, como en el despliegue.

## Credencial de solo lectura (T32 de 001)

`snapshot_catalogo.py` se niega a correr con la credencial de escritura de la API:

- exige `SQL_RO_USERNAME` y `SQL_RO_PASSWORD` en el entorno de quien lo corre (nunca en archivos versionados);
- falla si `SQL_RO_USERNAME` es igual a `SQL_USERNAME`;
- a producción solo le manda exactamente `CONSULTA_CATALOGO` (lista blanca): cualquier otra sentencia se rechaza antes de salir.

Mientras la BCC no apruebe el login de solo lectura ([propuesta](../../aprobaciones/2026-09-29_login_solo_lectura.md)), la copia del catálogo **no se puede volver a correr**. La copia local que existe hoy sigue sirviendo para la demo.
