# 08 — Ingesta Masiva

> Estado: 70% | Parcial

---

## 1. Descripción funcional

Pipeline de importación batch que permite a admins subir un archivo Excel con metadata de audiolibros, mapear columnas automáticamente, crear registros en BD, y encolar transferencia de archivos desde SharePoint a Azure Blob Storage. La parte de SharePoint actualmente es mock.

---

## 2. Funciones

### 2.1 Importación desde Excel
- **Qué hace:** Acepta archivo .xlsx, parsea headers con mapeo flexible, crea audiolibros en batch.
- **Endpoint:** `POST /admin/importar-lote`
- **Frontend:** `ExcelImporter.jsx` — drag & drop de Excel, preview de datos, botón de importar
- **Mapeo inteligente de columnas:**

| Variantes aceptadas | Campo destino |
|---------------------|---------------|
| nombre, title, titulo, name | `nombre` |
| desc, descripcion, description | `descripcion` |
| autor, author | `autor` |
| cat, genre, genero | `categoria` |
| clas, tag, label, clasificaciones | `clasificaciones` (array) |
| sharepoint, url, link, path | `sharepoint_url` |

- **Procesamiento:**
  1. Frontend parsea Excel con librería `xlsx`
  2. Envia JSON al backend
  3. Backend crea/enlaza categorías y clasificaciones (auto-create si no existen)
  4. Crea registro `Audiolibro` por cada fila
  5. Encola background task para ingesta desde SharePoint

### 2.2 Transferencia SharePoint → Azure Blob
- **Qué hace:** Para cada audiolibro con `sharepoint_url`, descarga archivos de SharePoint y los sube a Azure Blob Storage.
- **Backend:** `sharepoint.py` → `ingest_audiobook_files(sharepoint_url, destination_folder)`
- **Autenticación SharePoint:** OAuth2 client credentials via Microsoft Graph API (MSAL)
- **Estado actual:** MOCK — sube `b"dummy mp3 content"` en vez de descargar de SharePoint real.
- **Background task:** FastAPI BackgroundTasks — ejecuta después de responder al cliente.

### 2.3 Upload directo con presigned URLs
- **Qué hace:** Genera SAS URL temporal (1h) para que el admin suba archivos directamente a Azure Blob desde el navegador, sin pasar por FastAPI.
- **Endpoint:** `POST /audiolibros/{audiolibro_id}/capitulos/presign-upload`
- **Body:** `{ filename: "capitulo_01.mp3" }`
- **Respuesta:** `{ upload_url: "https://...blob...?sas=..." }`
- **Permisos SAS:** Write + Create, expira en 1 hora
- **Frontend:** No tiene UI implementada para esta función.

---

## 3. Estado actual

| Función | Implementada | Tests | Bugs |
|---------|-------------|-------|------|
| Excel parsing + preview | Si | No (frontend) | — |
| Mapeo inteligente de columnas | Si | Si | — |
| Creación batch en BD | Si | Si | Sin detección de duplicados |
| SharePoint transfer | Mock | Si (mock) | Solo sube dummy content |
| Presigned URLs | Si | Si | Sin UI frontend |
| Background tasks | Si | No | Sin tracking de estado |

**Gaps principales:**
- SharePoint integration es mock — no descarga archivos reales
- Sin detección de duplicados (reimportar Excel crea registros dobles)
- Sin validación de datos del Excel (tipos, campos requeridos)
- Sin progreso real de importación (frontend simula 2s por item)
- Sin reporte de errores por fila (no se sabe cuáles fallaron)
- Sin rollback de importación parcialmente fallida
- Sin historial de importaciones realizadas
- Sin límite de tamaño de archivo Excel
- Presigned upload no tiene UI
- Sin validación de tipo de archivo en upload (acepta cualquier cosa)
- Sin virus scanning en archivos subidos

---

## 4. Ruta de escalabilidad

### Corto plazo
- Implementar detección de duplicados (match por nombre + autor antes de crear)
- Agregar validación de campos requeridos en cada fila del Excel (nombre obligatorio)
- Retornar reporte detallado: `{ exitosos: N, fallidos: N, errores: [{fila, motivo}] }`
- Crear UI básica para presigned upload (seleccionar audiolibro → subir MP3s)

### Mediano plazo
- **SharePoint real:** Implementar flujo completo con Microsoft Graph API:
  1. `GET /sites/{site-id}/drives/{drive-id}/root:/{folder}:/children` para listar archivos
  2. `GET /drives/{drive-id}/items/{item-id}/content` para descargar cada archivo
  3. Stream directo a Azure Blob sin almacenar en servidor
  4. Retry con exponential backoff en fallos de red
  5. Tracking de progreso por archivo en tabla `ingesta_jobs`
- **Job queue:** Reemplazar BackgroundTasks de FastAPI por Celery + Redis. Permite:
  - Estado de jobs (pending, running, completed, failed)
  - Retry automático en fallos
  - Concurrencia configurable
  - Dashboard de monitoreo
- **UI de progreso real:** WebSocket o polling que muestra estado de cada archivo siendo transferido. Barra de progreso real, no simulada.

### Largo plazo
- **Pipeline de procesamiento:** Al ingestar un archivo MP3:
  1. Validar formato (es MP3 válido?)
  2. Extraer metadata ID3 (duración, bitrate, tags)
  3. Generar waveform preview
  4. Transcribir audio a texto (Whisper)
  5. Generar versiones en múltiples calidades
  6. Actualizar tabla `capitulos` con metadata
- **Importación desde múltiples fuentes:** Además de Excel + SharePoint:
  - Google Drive
  - Dropbox
  - FTP/SFTP
  - API de otras bibliotecas
  - Formato ONIX (estándar editorial)
- **Scheduling:** Importaciones programadas (ej: "cada lunes sincronizar con SharePoint"). Cron jobs con notificación de resultados.
- **Cuota de storage:** Tracking de espacio usado por audiolibro y total. Alertas al acercarse al límite. Dashboard de consumo de Azure Blob.

---

## 5. Dependencias

| Dependencia | Tipo | Crítica |
|-------------|------|---------|
| xlsx (npm) | Frontend | Si |
| openpyxl | Backend | Si |
| Azure Blob Storage SDK | Backend | Si |
| Microsoft Graph API (MSAL) | Backend | Si (mock actual) |
| FastAPI BackgroundTasks | Backend | Si |
| MS_CLIENT_ID/SECRET/TENANT | Config | Si (para SharePoint real) |
