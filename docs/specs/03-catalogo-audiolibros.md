# 03 — Catálogo de Audiolibros

> Estado: 85% | Producción

---

## 1. Descripción funcional

Sistema CRUD completo para gestionar el catálogo de audiolibros. Cada audiolibro tiene metadata (título, autor, género, descripción), pertenece a una categoría (1:M) y puede tener múltiples clasificaciones/tags (M:M). Los archivos de audio viven en Azure Blob Storage organizados en carpetas por nombre de libro.

---

## 2. Funciones

### 2.1 CRUD de audiolibros (Admin)
- **Qué hace:** Crear, leer, actualizar y eliminar registros de audiolibros con toda su metadata.
- **Endpoints:**
  - `POST /admin/audiolibros` — crear audiolibro con nombre, autor, género, descripción, categoría, clasificaciones
  - `GET /admin/audiolibros` — listar todos (admin)
  - `PUT /admin/audiolibros/{id}` — actualizar metadata
  - `DELETE /admin/audiolibros/{id}` — eliminar
- **Frontend:** `ContentManagement.jsx` — lista con búsqueda, modales de crear/editar
- **Modelo:** `Audiolibro` (id, nombre, descripcion, genero, autor, categoria_id)

### 2.2 Categorías
- **Qué hace:** Agrupa audiolibros en categorías (relación 1:M). Admin selecciona categoría al crear/editar libro.
- **Endpoint:** `GET /admin/categorias` — lista categorías disponibles
- **Frontend:** Dropdown en modal de edición (`ContentManagement.jsx`)
- **Modelo:** `Categoria` (id, nombre, descripcion)
- **Nota:** Las categorías se auto-crean durante importación batch si no existen.

### 2.3 Clasificaciones (Tags)
- **Qué hace:** Tags M:M para etiquetar audiolibros. Se ingresan como texto separado por comas.
- **Tabla junction:** `audiolibro_clasificacion` (audiolibro_id, clasificacion_id)
- **Modelo:** `Clasificacion` (id, nombre, descripcion)
- **Comportamiento:** Si la clasificación no existe, se crea automáticamente al asignarla.

### 2.4 Géneros
- **Qué hace:** Campo de texto libre en cada audiolibro. Endpoint para listar géneros únicos usados.
- **Endpoints:**
  - `GET /genres` — lista valores únicos de `Audiolibro.genero`
  - `GET /books-by-genre/{genre}` — filtra libros por género
- **Frontend:** Sidebar con botones de género en `Home.jsx`
- **Problema:** Los géneros en frontend están hardcodeados ("Biografías", "Literatura") y no reflejan la BD.

### 2.5 Listado de capítulos
- **Qué hace:** Para un audiolibro dado, lista sus capítulos disponibles en Azure Blob Storage.
- **Endpoint:** `GET /audio-by-id/{audiolibro_id}` — retorna lista de capítulos
- **Lógica:** Busca carpeta en blob con nombre del audiolibro → lista archivos MP3 → extrae número de capítulo via regex → ordena numéricamente.

---

## 3. Estado actual

| Función | Implementada | Tests | Bugs |
|---------|-------------|-------|------|
| CRUD audiolibros | Si | Si | — |
| Categorías | Si | Si | Sin CRUD independiente de categorías |
| Clasificaciones | Si | Si | Sin gestión separada, solo via libros |
| Géneros | Parcial | Si | Hardcodeados en frontend |
| Listado capítulos | Si | Si (mock) | Regex frágil para nombres de archivo |

**Gaps principales:**
- Sin imagen de portada/artwork
- Sin campo de fecha de publicación
- Sin ISBN u otros identificadores externos
- Sin campo de idioma (asume español)
- Sin ratings o reseñas de usuarios
- Sin agrupación por series/colecciones
- Sin detección de duplicados en importación
- Sin CRUD independiente para categorías y clasificaciones
- Géneros como texto libre sin vocabulario controlado

---

## 4. Ruta de escalabilidad

### Corto plazo
- Corregir géneros hardcodeados en frontend: consumir `GET /genres` dinámicamente
- Agregar endpoint `CRUD /admin/categorias` completo (crear, editar, eliminar)
- Agregar endpoint `CRUD /admin/clasificaciones` completo
- Agregar detección de duplicados (por nombre + autor) en creación

### Mediano plazo
- **Portadas:** Campo `cover_url` en modelo. Upload a Azure Blob con presigned URL. Thumbnail generado en resize. Placeholder accesible con alt-text descriptivo.
- **Metadata extendida:** Campos: `isbn`, `idioma`, `fecha_publicacion`, `duracion_total`, `narrador`, `editorial`. Migración Alembic para agregar columnas.
- **Vocabulario controlado de géneros:** Tabla `generos` normalizada en vez de texto libre. Relación M:M (un libro puede tener varios géneros). UI con multiselect.
- **Series/colecciones:** Tabla `series` (id, nombre, descripción) + campo `serie_id` y `orden_en_serie` en Audiolibro. Permite navegación "Siguiente libro de la serie".

### Largo plazo
- **Sistema de reseñas:** Tabla `resenas` (usuario_id, audiolibro_id, rating 1-5, texto, fecha). Promedio calculado. Moderación por admin. Impacto en accesibilidad: ratings anunciados por screen reader.
- **Recomendaciones:** Motor basado en historial de escucha, géneros preferidos, y ratings. Puede ser reglas simples (collaborative filtering) o ML.
- **Catálogo federado:** API pública para que otras bibliotecas consulten el catálogo. Formato OPDS (Open Publication Distribution System) para interoperabilidad con lectores estándar.
- **Versionado de contenido:** Historial de cambios en metadata con diff y rollback. Tabla `audiolibro_history` con snapshots.

---

## 5. Dependencias

| Dependencia | Tipo | Crítica |
|-------------|------|---------|
| SQLAlchemy ORM | Backend | Si |
| Azure Blob Storage | Backend | Si (para capítulos) |
| Pydantic schemas | Backend | Si |
| ContentManagement.jsx | Frontend | Si |
| Regex chapter parsing | Backend | Si (frágil) |
