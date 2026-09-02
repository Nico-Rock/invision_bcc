# Diseño Técnico: Carga de Contenido desde la Web (Admin Dashboard, A11y-first)

**Fecha:** 2026-09-02
**Estado:** Propuesto
**Autor:** Nico (via Claude Code)

---

## 1. Contexto y Objetivos

Hoy la carga de audiolibros nuevos se hace por fuera de cualquier interfaz web: un script manual (`_ops_upload/upload_books.py`) sube MP3s directo a Azure Blob Storage con la convención `{nombre_canonico}/{archivo}.mp3`, y el registro en la tabla `audiolibros` se inserta a mano. Es el camino que se usa porque la API de producción (`api.biblioteca-invision.com`) está desactualizada y no se usa para esto. Quedan **~700 títulos** por cargar del catálogo (`Catalogo digital Audioteca 2025(disponibles).csv`, 1091 filas totales).

**Quién opera esto, y por qué importa:**
- **Corto plazo:** Nico, asistido, liquidando el backlog de 700 — sighted, prioriza velocidad.
- **Objetivo final:** el administrador de la biblioteca, que **es no vidente**, operando este flujo de forma independiente para altas puntuales una vez liquidado el backlog. Este es el requisito que define el diseño — no es un flujo administrativo genérico, es accesibilidad end-to-end o no sirve.

**Gap de documentación detectado:** `admin-dashboard/` (la interfaz nueva, con navegación por sidebar y KPIs) no figura en `docs/specs/00-overview.md` como módulo — es una herramienta construida después del spec de referencia, y hoy está sin trackear ahí. No se resuelve en este documento (ver §6, pendiente de decisión).

**Objetivos de este diseño:**
1. Permitir crear un audiolibro (metadata) y subir sus pistas de audio desde `admin-dashboard`, sin pasar por la API vieja ni por scripts manuales.
2. Que el flujo de carga individual sea operable de punta a punta sin mirar la pantalla (screen reader, TTS, earcons, teclado).
3. No introducir dependencias nuevas de infraestructura (nada de SharePoint/Graph API real, nada de SAS de escritura en el navegador).

---

## 2. Decisión de arquitectura

Tres opciones evaluadas — comparación completa en la conversación de diseño previa (no repetida acá en detalle, solo la conclusión):

| Opción | Costo Azure | Confiabilidad | Durabilidad |
|---|---|---|---|
| **A. Servidor como intermediario (elegida)** | Igual a las otras — Azure no cobra ingreso de datos | Alta: el servidor confirma blob+DB antes de avisar éxito | Alta: extiende el patrón ya probado de `upload_books.py` |
| B. SAS de escritura, subida directa del browser | Igual | Media: lógica de reintento y CORS viven en el cliente | Media: requiere mantener reglas CORS en el storage account |
| C. SharePoint real (Graph API) | Mayor: storage duplicado + llamadas a Graph | Baja: depende de secretos OAuth que vencen | Baja: mayor superficie, hoy 100% mock |

**Elegida: A.** El archivo viaja del navegador al proceso Python de `admin-dashboard/server.py`, que hace `upload_blob` a Azure y el `INSERT` en la misma operación — mismo patrón que el script actual, expuesto por HTTP. La señal de éxito/error que dispara el feedback accesible viene confirmada por el servidor, no es optimista del lado del cliente.

**Dato de modelo que simplifica el diseño:** no existe tabla de capítulos (`InvisionAPI-main/audiobooks/models.py`). Los capítulos se infieren de listar los blobs bajo el prefijo `{nombre}/` ordenados por nombre de archivo. Consecuencia directa: **el nombre de archivo es el único mecanismo de orden de reproducción**, y el diseño de UI tiene que protegerlo explícitamente (§4, Paso 2).

---

## 3. Backend (`admin-dashboard/server.py`)

Dos endpoints nuevos, agregados a `handle_api()` junto a los existentes (que hoy son 100% de lectura).

### 3.1 `POST /api/admin/crear-libro`
- **Body (JSON):** `{ nombre, autor, descripcion, genero, categoria_id }`
- **Nota de alcance (YAGNI):** se descartó `clasificaciones` (relación M:M) del v1. El catálogo fuente (`Catalogo digital Audioteca 2025(disponibles).csv`) trae solo `AUTOR; NOMBRE; EDITORIAL; GÉNERO; Descripción` — no hay clasificaciones en los datos reales de los ~700 títulos, así que la tabla asociativa quedaría vacía. Se agrega cuando exista un caso de uso concreto. (`EDITORIAL` tampoco tiene campo en el modelo `Audiolibro`; queda fuera del v1.)
- **Validación:** `nombre` obligatorio. Antes de insertar, `SELECT` case-insensitive por `nombre` contra `audiolibros` — si existe, responde `409` con `{error: "Ya existe un libro con ese nombre"}`. Es un gap conocido del pipeline actual (spec [08-ingesta-masiva.md](../../specs/08-ingesta-masiva.md) lo marca: "sin detección de duplicados") — acá se cierra por primera vez.
- **Éxito:** `201` con `{id, nombre, mensaje: "Libro '<nombre>' creado. Ahora seleccioná los archivos de audio."}`. El campo `mensaje` es el texto exacto que el frontend anuncia por voz — lo controla el servidor, no queda a criterio del JS del cliente.

### 3.2 `POST /api/admin/subir-pista?nombre=<canonico>&archivo=<file.mp3>`
- **Body:** binario crudo (no multipart — parsear multipart a mano con `http.server` es una fuente de bugs innecesaria para una herramienta interna). El handler lee `self.rfile` acotado por `Content-Length` y lo pasa como stream a `blob_client.upload_blob(stream, length=content_length, overwrite=False, content_type="audio/mpeg")`. No se buffer-ea el archivo completo en memoria de Python.
- **Validaciones:** extensión `.mp3` obligatoria (gap conocido: "sin validación de tipo de archivo"). Si `blob_client.exists()` ya es `True`, responde `200` con `{ok: true, mensaje: "Ya existía, salteado", skipped: true}` — mismo comportamiento no-destructivo que `upload_books.py` (`overwrite=False`).
- **Éxito:** `201` con `{ok: true, mensaje: "Pista '<archivo>' subida correctamente"}`.
- **Error:** `500` con `{ok: false, mensaje: "Error subiendo '<archivo>': <detalle corto>"}`.

### 3.3 Fuera de alcance de este documento
- `GET /api/categorias` (para poblar el `<select>` del formulario) — trivial, mismo patrón que los endpoints de lectura existentes, se implementa junto con el resto sin diseño aparte.

---

## 4. Frontend accesible (`admin-dashboard/static/`)

Nueva sección "Cargar audiolibro" en el sidebar existente. Se portan a JS vanilla (sin traer React) las primitivas de accesibilidad ya probadas en `frontend/src/context/AudioContext.jsx` y documentadas en [10-accesibilidad.md](../../specs/10-accesibilidad.md): earcons (Web Audio API, misma tabla de frecuencias — éxito 440→880Hz, error 180Hz, acción 659Hz), TTS vía `speechSynthesis` en `es-ES`, y un `<div aria-live="assertive">` de respaldo si TTS no está disponible en el navegador.

**Paso 1 — Metadata, un campo por vez, foco lineal:**
Nombre (obligatorio, foco inicial al entrar a la sección) → Autor → Género/Categoría (`<select>`, poblado desde `/api/categorias`) → Descripción (opcional) → Clasificaciones (checkboxes, opcional). Enter en el campo Nombre no dispara submit — evita envíos accidentales. Si el servidor devuelve 409, se anuncia "Ya existe un libro con ese nombre, revisá el catálogo" y el flujo se corta ahí — no deja avanzar a la carga de archivos sobre un libro pisado.

**Paso 2 — Selección de archivos, con salvaguarda de orden:**
`<input type="file" multiple accept=".mp3">` nativo — el diálogo de archivos del sistema operativo ya es accesible sin trabajo extra nuestro. Al seleccionar, se anuncia cuenta y orden: "3 archivos: 01.mp3, 02.mp3, 03.mp3". Si los nombres no matchean un patrón numérico reconocible (regex `^\d+`), se avisa **antes** de subir: "Los nombres no tienen número de orden, van a quedar en el orden que los leo — ¿confirmás?". Es la única corrección que no se puede hacer después sin volver a subir todo, porque el orden de reproducción depende 100% del nombre de archivo (§2).

**Paso 3 — Subida secuencial, nunca en paralelo:**
Un archivo por vez, deliberado — en paralelo, los anuncios de voz se pisarían entre sí. Después de cada uno: earcon + "Pista 1 de 3 subida" o "Error en pista 2, ¿reintentar?" con foco automático en un botón de reintento inmediatamente después del anuncio de error (no en un modal aparte). Cierre: "Carga completa, el libro ya está en el catálogo" — un solo anuncio final, no un resumen visual a leer.

---

## 5. Plan de verificación

**Backend:**
- Test de duplicado: crear el mismo `nombre` dos veces → segunda vez `409`.
- Test de `overwrite=False`: subir la misma pista dos veces → segunda vez `skipped: true`, no se pisa el blob.
- Test de extensión inválida (`.wav`, `.txt`) → rechazado antes de tocar Blob.
- Test de archivo grande (>50MB) → confirmar que no se buffer-ea completo en memoria (monitorear RSS del proceso durante el upload).

**Accesibilidad (manual, no automatizable con axe-core porque no hay DOM React acá):**
- Flujo completo con VoiceOver (Mac) y NVDA (Windows) sin usar mouse ni mirar pantalla.
- Verificar que cada anuncio de TTS coincide con el estado real (no anuncia "subida correctamente" si el request falló).
- Verificar que earcons y TTS no se superponen entre sí (la razón de la subida secuencial en §4).
- Probar con TTS deshabilitado en el navegador → el live region `aria-live` debe seguir comunicando todo.

---

## 6. Pendiente de decisión (no bloqueante para implementar)

`admin-dashboard/` no está registrado como módulo en [00-overview.md](../../specs/00-overview.md) — es una herramienta construida por fuera del spec de referencia original y hoy vive sin tracking en la tabla de módulos ni en el mapa de integración. Vale la pena, en algún momento, decidir si se agrega como módulo 12 formal (con su propio spec `12-admin-dashboard.md` siguiendo el mismo formato que 01–11) o si se documenta como herramienta operativa interna, fuera del spec de producto. No se resuelve acá para no bloquear la implementación de la carga de contenido.

También queda abierto, para más adelante: este diseño agrega un **tercer camino de escritura** a la base (API vieja + script manual + este endpoint nuevo). Es la ruta correcta para el corto/mediano plazo, pero en algún momento conviene que la API "oficial" absorba este mismo endpoint en vez de que quede como herramienta paralela permanente.
