# 05 — Streaming de Audio

> Estado: 90% | Producción

---

## 1. Descripción funcional

Streaming de archivos MP3 desde Azure Blob Storage con soporte completo de HTTP 206 Partial Content (range requests). Permite seek en el reproductor sin descargar el archivo completo. Los capítulos se organizan en carpetas por nombre de audiolibro y se ordenan numéricamente via regex.

---

## 2. Funciones

### 2.1 Streaming con range requests
- **Qué hace:** Sirve archivos MP3 como stream con soporte de byte-range para seek instantáneo.
- **Endpoint:** `GET /stream-audio-simple/{usuario_id}/{audiolibro_id}/{chapter_index}`
- **Headers de request:** `Range: bytes=start-end`
- **Headers de response:**
  - `Content-Range: bytes start-end/total`
  - `Accept-Ranges: bytes`
  - `Content-Length: chunk_size`
  - `Content-Type: audio/mpeg`
- **Status:** 206 Partial Content (con range) o 200 OK (sin range)
- **Autenticación:** Bearer token + validación de user_id contra JWT

### 2.2 Resolución de capítulos
- **Qué hace:** Dado un audiolibro_id y chapter_index, localiza el archivo MP3 correcto en Azure Blob.
- **Lógica:**
  1. Busca audiolibro en BD por ID → obtiene `nombre`
  2. Lista blobs en carpeta `{nombre}/` en Azure container
  3. Para cada archivo, extrae número via regex: `re.search(r'(\d+)', filename)`
  4. Ordena por número extraído (no alfabéticamente)
  5. Selecciona el archivo en posición `chapter_index` (1-based)
- **Ejemplo:** Carpeta "Don Quijote" → archivos `cap_01.mp3`, `cap_02.mp3`, `cap_10.mp3` → ordenados [1, 2, 10]

### 2.3 Validación de acceso
- **Qué hace:** Verifica que el usuario autenticado es quien solicita el stream.
- **Lógica:** `usuario_id` en URL debe coincidir con `id` en JWT decodificado.
- **Error:** 403 si no coincide.

---

## 3. Estado actual

| Función | Implementada | Tests | Bugs |
|---------|-------------|-------|------|
| Range requests (HTTP 206) | Si | Si (mock) | — |
| Resolución de capítulos | Si | Si (mock) | Regex frágil |
| Validación de acceso | Si | Si | — |

**Gaps principales:**
- Regex asume que los archivos tienen números en el nombre — falla con nombres tipo `intro.mp3`, `epilogo.mp3`
- Sin error recovery si el blob desaparece mid-stream
- Sin adaptive bitrate (calidad fija)
- Sin transcoding (solo MP3 nativo)
- Sin cache de metadata de blob (consulta Azure en cada request)
- Sin Content-Disposition header (no fuerza descarga vs. streaming)
- Sin rate limiting por usuario
- Sin tracking de bytes servidos (para analytics de consumo)

---

## 4. Ruta de escalabilidad

### Corto plazo
- Mejorar regex de capítulos: soportar nombres sin número, agregar fallback por orden alfabético
- Agregar metadata de capítulos en respuesta: `{ chapter_title, duration_seconds, file_size }`
- Cache de listado de blobs por audiolibro (TTL 5 min) para reducir llamadas a Azure
- Agregar header `Content-Disposition: inline` explícito

### Mediano plazo
- **CDN:** Poner Azure CDN o Cloudflare delante del blob storage. Reduce latencia para usuarios geográficamente distantes. Cache por archivo con invalidación por versión.
- **Metadata de capítulos en BD:** Tabla `capitulos` (id, audiolibro_id, numero, titulo, duracion_seg, archivo_blob, tamano_bytes). Elimina dependencia de regex y listado de blob en tiempo real.
- **Múltiples calidades:** Almacenar cada capítulo en 3 calidades (64kbps, 128kbps, 256kbps). Selector en reproductor. Default basado en conexión del usuario.
- **Pre-signed URLs directos:** En vez de proxiar el stream por FastAPI, generar SAS URL temporal y redirigir al cliente directo a Azure Blob. Reduce carga del servidor.

### Largo plazo
- **HLS/DASH streaming:** Convertir MP3 a segmentos HLS (.m3u8 + .ts) para adaptive bitrate real. El reproductor cambia calidad automáticamente según ancho de banda. Requiere pipeline de transcoding (FFmpeg).
- **Offline/PWA:** Service worker que pre-descarga capítulos para escucha offline. IndexedDB para almacenar audio localmente. Sync de progreso cuando vuelve la conexión.
- **DRM:** Si se requiere protección de contenido, implementar Widevine o FairPlay. Agrega complejidad significativa. Evaluar si el caso de uso lo justifica (biblioteca pública vs. contenido comercial).
- **Analytics de consumo:** Tracking de bytes servidos, tiempo de escucha por capítulo, tasa de completion, puntos de abandono. Dashboard para admin. Informa decisiones de catálogo.

---

## 5. Dependencias

| Dependencia | Tipo | Crítica |
|-------------|------|---------|
| Azure Blob Storage SDK | Backend | Si |
| FastAPI StreamingResponse | Backend | Si |
| HTML5 Audio API | Frontend | Si |
| Regex (chapter parsing) | Backend | Si (frágil) |
| AZURE_ACCOUNT_NAME/KEY | Config | Si |
