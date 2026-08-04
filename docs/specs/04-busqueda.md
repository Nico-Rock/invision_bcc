# 04 — Búsqueda

> Estado: 70% | Básica

---

## 1. Descripción funcional

Búsqueda de audiolibros por título con query LIKE case-insensitive. Los resultados se validan contra Azure Blob Storage (solo retorna libros que tienen carpeta en blob). Frontend ofrece búsqueda por voz via Web Speech API.

---

## 2. Funciones

### 2.1 Búsqueda por texto
- **Qué hace:** Busca audiolibros cuyo nombre contenga el término (substring match, case-insensitive).
- **Endpoint:** `POST /search` — body: `{ "query": "término" }`
- **Query SQL:** `Audiolibro.nombre.ilike(f"%{search_term}%")`
- **Post-filtro:** Solo retorna resultados donde existe carpeta correspondiente en Azure Blob Storage.
- **Respuesta:** Lista de audiolibros con id, nombre, autor, género, descripción.
- **Frontend:** `Home.jsx` — input de búsqueda con submit manual

### 2.2 Filtro por género
- **Qué hace:** Lista libros de un género específico.
- **Endpoints:**
  - `GET /genres` — valores únicos de `Audiolibro.genero`
  - `GET /books-by-genre/{genre}` — libros filtrados
- **Frontend:** Botones de género en sidebar de `Home.jsx`
- **Problema:** Botones hardcodeados, no reflejan géneros reales de la BD.

### 2.3 Búsqueda por voz
- **Qué hace:** Activa micrófono, transcribe voz a texto, y ejecuta búsqueda con el texto resultante.
- **Frontend:** `Home.jsx` — botón de micrófono que usa Web Speech API (`SpeechRecognition`)
- **Config:** `recognition.lang = 'es-ES'`, continuous = false
- **Feedback:** Earcon `voiceStart` al activar, resultado transcrito se coloca en input de búsqueda.

### 2.4 Filtrado local en admin
- **Qué hace:** Filtrado client-side en panels de admin (usuarios por email/username, libros por título/autor/género).
- **Frontend:** `UserManagement.jsx`, `ContentManagement.jsx` — input de filtro con match case-insensitive
- **Nota:** No es búsqueda backend — filtra la lista ya cargada en memoria.

---

## 3. Estado actual

| Función | Implementada | Tests | Bugs |
|---------|-------------|-------|------|
| Búsqueda por título | Si | Si | Solo título, no autor ni descripción |
| Filtro por género | Parcial | Si | Géneros hardcodeados en frontend |
| Búsqueda por voz | Si | No | Depende de soporte del navegador |
| Filtrado local admin | Si | No | — |

**Gaps principales:**
- Búsqueda solo por título (no incluye autor, descripción, narrador)
- Sin ranking de relevancia (retorna todos los matches sin orden de relevancia)
- Sin paginación de resultados de búsqueda
- Sin filtros combinados (género + autor + búsqueda de texto simultáneo)
- Sin autocomplete/sugerencias mientras se escribe
- Sin búsqueda difusa (fuzzy matching) — solo substring exacto
- Sin historial de búsquedas
- Sin búsqueda avanzada (operadores AND/OR, rangos de fecha)
- Validación contra blob agrega latencia a cada búsqueda

---

## 4. Ruta de escalabilidad

### Corto plazo
- Extender búsqueda a campos `autor` y `descripcion` (multi-field ilike OR)
- Consumir `GET /genres` dinámicamente en frontend en vez de hardcodear
- Agregar paginación a resultados (`limit`, `offset` como query params)
- Eliminar validación contra blob en búsqueda (validar solo al reproducir)

### Mediano plazo
- **Filtros combinados:** Endpoint acepta: `query` (texto), `genero`, `categoria`, `clasificacion`, `autor` como query params opcionales. Backend construye query dinámico con AND. Frontend muestra panel de filtros expandible.
- **Autocomplete:** Endpoint `GET /search/suggest?q=ter` que retorna top 5 títulos/autores que matchean. Debounce de 300ms en frontend. Dropdown de sugerencias accesible con ARIA listbox.
- **Fuzzy search:** Reemplazar LIKE por trigram similarity (PostgreSQL `pg_trgm`) o Levenshtein distance. Tolera errores de tipeo. Requiere migración de SQLite/SQL Server a PostgreSQL, o implementar en aplicación.

### Largo plazo
- **Full-text search engine:** Integrar Elasticsearch o Azure Cognitive Search. Indexa título, autor, descripción, tags. Soporte para sinónimos, stemming en español, ranking por relevancia (BM25). Búsqueda fonética para accesibilidad.
- **Búsqueda semántica:** Embeddings vectoriales de descripciones de libros. Query del usuario se embede y se busca por similitud coseno. Permite búsquedas como "libro sobre un viajero en el desierto" sin que esas palabras estén en el título.
- **Búsqueda por voz avanzada:** Modelo de speech-to-text propio (Whisper) para mejor precisión en español. Soporte para comandos de voz ("buscar libros de García Márquez en literatura").
- **Analytics de búsqueda:** Trackear qué buscan los usuarios, qué no encuentran (zero results), qué clickean. Dashboard para admin. Alimenta recomendaciones.

---

## 5. Dependencias

| Dependencia | Tipo | Crítica |
|-------------|------|---------|
| SQLAlchemy ilike() | Backend | Si |
| Azure Blob (validación) | Backend | Si (agrega latencia) |
| Web Speech API | Frontend | No (graceful degradation) |
| SpeechRecognition | Frontend | Soporte variable por navegador |
