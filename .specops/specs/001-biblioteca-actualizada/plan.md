# Plan — 001-biblioteca-actualizada

> CÓMO. Cada decisión cita el requisito (R#) o el principio de la constitución (P#) que la justifica.
> Constitución de referencia: `.specops/constitution.md` v1.0.0.

**Status:** constitution-checked  **Author:** Nico (vía Claude Code)  **Date:** 2026-09-26

## Arquitectura

La lógica nueva vive como **módulos Python puros dentro de `admin-dashboard/`**. El panel (`server.py`) y una CLI de lotes los comparten, así que la validación que ve la bibliotecaria en el panel es exactamente la misma que corre antes de escribir en producción (P7, R10, R18).

```
admin-dashboard/
├── server.py                 panel HTTP (existente): consume los módulos
├── invision/                 NUEVO paquete, sin dependencias de http.server
│   ├── esquema.py            introspección: ¿existe la tabla/columna? (R1, R2, R17, R34)
│   ├── normalizar.py         clave de comparación de títulos y autores (R6, R12)
│   ├── indice_blob.py        índice de Blob en segundo plano con estado honesto (R3, R4)
│   ├── reconciliacion.py     catálogo ↔ audio, géneros, En Memoria (R5–R8, R33)
│   ├── manifiesto.py         lectura de la planilla CSV (UTF-8 / Windows-1252, ; o ,) (R9)
│   ├── audio_local.py        inspección de carpetas: vacías, 0 bytes, "solo en la nube", orden (R11)
│   ├── validacion.py         reglas por fila: schema de la API + largos de prod (R10–R12, R31)
│   ├── aprobaciones.py       aprobación del lote integrada en origin/main (R32, R35)
│   └── lote.py               ejecutor: simulación por defecto, audio antes que ficha, retomable (R13–R16, R29, R34)
├── cargar_lote.py            CLI: `validar` | `simular` | `ejecutar --aprobacion` (R13)
└── tests/                    los nuevos tests; los existentes siguen en test_server.py
aprobaciones/                 NUEVO en la raíz del repo: un .md por operación aprobada (R32)
informes/lotes/<lote>/        NUEVO, fuera de git: estado.jsonl (reanudación) + informe.md/json (R14, R15)
InvisionAPI-main/migrations/  NUEVO: migración aditiva propuesta + reversión (R16b, R34)
InvisionAPI-main/scripts/snapshot_catalogo.py   copia de lectura prod → SQLite local (R21, R22)
```

Decisiones:
- **Paquete `invision/` separado de `server.py`**, porque la CLI de lotes no puede depender de un servidor HTTP y porque `server.py` ya tiene 738 líneas (P1). Justifica: R10, R18.
- **El panel nunca ejecuta escrituras de lote.** Solo valida y simula (R18). La ejecución real es la CLI, con aprobación (R13, R32). Así la superficie web que escribe en producción no crece (P12).
- **La validación importa el schema real de la API** (`AudiobookCreateUpdate` de `InvisionAPI-main/audiobooks/schemas.py`) y le suma los largos de columna de producción (`nombre`/`autor`/`editorial` ≤ 255, `genero` ≤ 100). Es una sola fuente de reglas, no una copia (P7, R10). Justifica el incidente del 2026-09-21.
- **El esquema se descubre, no se asume** (P13): `esquema.py` consulta `INFORMATION_SCHEMA` (Azure SQL) o `PRAGMA table_info` (SQLite). El overview omite las métricas sin tabla (R1, R2), `crear_libro` inserta `editorial` y `narrador` solo si la columna existe y nunca inserta `categoria_id` si no existe (R17, R34). No es la "Opción B" del módulo 13 (dos esquemas soportados en paralelo): el esquema objetivo es el de producción. La introspección solo evita que una columna ausente tumbe una vista.
- **Índice de Blob en un hilo aparte** con estado `indexando | listo | error`, la fecha del último índice válido y la conservación del índice anterior si falla el refresco (P10, R3, R4). El servidor abre el puerto antes de indexar.
- **Orden audio → ficha** en el ejecutor (R16a): por cada libro se suben todas las pistas (reusando `subir_pista`, que ya hace streaming, salta las existentes y detecta truncados), se verifica el conteo en Blob y recién entonces se crea la ficha, volviendo a comprobar la existencia justo antes del INSERT (caso borde 6).
- **Reanudación por diario** `estado.jsonl` de solo agregar: cada pista y cada ficha confirmada se anota. Al retomar se confía en el diario **y** en `exists()` de Blob / SELECT en SQL; si discrepan, gana el almacenamiento real (R14).
- **Identidad del lote = SHA-256 del manifiesto normalizado** (filas ordenadas y el contenido de cada celda). La aprobación cita ese hash, así que cualquier cambio en el manifiesto la invalida (R35).
- **Aprobación "integrada"** = el archivo `aprobaciones/<lote>.md` existe en `origin/main` (tras `git fetch`) con el hash correcto y los campos `aprobado_por` y `fecha`. Se lee con `git show origin/main:aprobaciones/<lote>.md`. No alcanza con una copia local sin integrar (R32).
- **Detección de "solo en la nube"**: en macOS el cliente de OneDrive deja marcadores con el flag `SF_DATALESS` (`st_flags & 0x40000000`). También se trata como no descargado un archivo cuyo `st_blocks` sea 0 con `st_size` mayor que 0 (R11, V27).
- **Orden de pistas**: número = último grupo de dígitos del nombre **sin extensión**. Es ambiguo si alguna pista no tiene número o si hay números repetidos (R11, caso borde 3). La API usa la misma regla (R24), así que el orden validado es el orden que después se reproduce.
- **Nombre distintivo** (R31): si el título normalizado existe con otro autor o narrador, la fila exige la columna `nombre_catalogo` (p. ej. "Rayuela, narrado por Ana Pérez"), que pasa a ser `nombre` y carpeta. Sin ella, la fila es inválida.

## Stack tecnológico
- Python 3.13 stdlib + `azure-storage-blob` + `pymssql` (ya usados por el panel) + `pydantic[email]` v2 para importar el schema de la API (R10). Nada más (P1).
- Tests: `pytest` con los fakes existentes (`FakeContainer`, SQLite temporal) (P3).
- Similitud difusa: `difflib.SequenceMatcher` de la stdlib sobre claves normalizadas (R6). No hace falta una librería de *fuzzy matching* para ~600 títulos.
- Frontend del panel: HTML/JS sin framework, reusando `a11y.js` (voz, earcons, live region) (P1, P14).

## Modelo de datos / esquemas

Manifiesto (CSV, una fila por libro). Encabezados, sin distinguir mayúsculas ni tildes:
```
autor; nombre; editorial; genero; descripcion; narrador; carpeta; nombre_catalogo
```
- `carpeta`: ruta **relativa** a la raíz de la carpeta sincronizada que se pasa por parámetro (`--raiz`).
- `narrador`: vacío = "sin informar"; `desconocido` = narrador no identificado (R30).
- `nombre_catalogo`: opcional; obligatorio si hay un título repetido (R31).

Resultado de validación por fila:
```json
{"fila": 12, "nombre": "…", "estado": "valida|invalida|omitida|advertencia",
 "motivos": ["El título supera los 255 caracteres"], "advertencias": ["Género nuevo: …"],
 "pistas": 20, "bytes": 241000000}
```

Migración propuesta (no se aplica en esta entrega; va por PR de aprobación, D6):
```sql
-- InvisionAPI-main/migrations/2026-09-29_publicacion_narrador.sql  (Azure SQL)
ALTER TABLE audiolibros ADD publicado BIT NOT NULL CONSTRAINT DF_audiolibros_publicado DEFAULT 1;
ALTER TABLE audiolibros ADD narrador NVARCHAR(255) NULL;
-- reversión: ..._rollback.sql  → DROP CONSTRAINT + DROP COLUMN
```
`DEFAULT 1` deja visibles las 538 filas existentes sin tocarlas.

## Contratos / interfaces

Panel (`server.py`), todos solo lectura salvo los ya existentes:
- `GET /api/overview`: agrega `indice_audio: {estado, error, ultimo_ok}`. Cada métrica de una tabla inexistente devuelve `null` más `no_disponible: {metrica: motivo}` (R1, R3).
- `GET /api/access-logs`: `{"disponible": false, "motivo": "Esta base no registra sesiones de acceso"}` si falta la tabla (R2).
- `POST /api/books/refrescar`: dispara el reindexado en segundo plano. Requiere token (R4).
- `GET /api/reconciliacion` y `GET /api/reconciliacion.csv` (R5–R8).
- `GET /api/en-memoria` (R33).
- `POST /api/lotes/validar`: cuerpo CSV (≤ 2 MB), parámetro `raiz` limitado a `LOTES_RAIZ` del `.env`. Devuelve el informe de validación. Requiere token (R18).
- `POST /api/admin/crear-libro`: acepta `editorial` y `narrador`, deja de exigir categoría y valida largos (R17).

CLI:
```
python admin-dashboard/cargar_lote.py validar  manifiesto.csv --raiz <OneDrive>/Audiolibros
python admin-dashboard/cargar_lote.py simular  manifiesto.csv --raiz …   # escribe informe + imprime hash del lote
python admin-dashboard/cargar_lote.py ejecutar manifiesto.csv --raiz … --aprobacion aprobaciones/<lote>.md
```

Aprobación (`aprobaciones/<lote>.md`):
```yaml
---
tipo: carga-lote | correccion-reconciliacion | migracion
lote: <sha256>
manifiesto: <nombre de archivo>
aprobado_por: <nombre, BCC>
fecha: YYYY-MM-DD
---
<informe de simulación pegado>
```

API (`InvisionAPI-main/audiobooks/`):
- `schemas.py`: `UserResponse.email` y `UserBaseResponse.email` pasan a `str`. `UserCreate` y `UserUpdate` mantienen `EmailStr` (R23).
- `crud.py`: la función de número de capítulo, compartida en las dos rutas (líneas 291 y 349) (R24).

Frontend (`frontend/src/App.jsx`): la lista de géneros se carga de `GET /genres` (R25).

## Dependencias
- Azure SQL (lectura para reconciliación y snapshot; escritura solo con la CLI aprobada), Azure Blob, cliente de OneDrive en la máquina de carga, `git` con acceso a `origin` para verificar aprobaciones, Docker (imagen existente) para correr la API local.

## Mitigación de riesgos y compuerta de seguridad (CWE)
- **CWE-89:** todas las consultas parametrizadas (`?` / `%s`). Los nombres de tabla y columna solo salen de listas blancas fijas, nunca de la entrada.
- **CWE-22:** `carpeta` se resuelve con `realpath` y debe quedar dentro de `--raiz`. Nombres de libro y pista pasan por `_nombre_seguro` (existente).
- **CWE-20 / CWE-79:** el schema de la API y los largos se validan en el borde. El panel inserta texto del manifiesto con `textContent`, nunca con `innerHTML`.
- **CWE-862 / CWE-352:** los POST nuevos exigen el `ADMIN_TOKEN` y la guarda de `Host` existentes. El servidor escucha solo en 127.0.0.1.
- **CWE-400:** el cuerpo del manifiesto se acota a 2 MB (`_BoundedReader`) y las pistas a 500 MB (existente).
- **CWE-798 / CWE-200:** credenciales solo desde `.env`. Los informes de lote no incluyen secretos, y el snapshot local excluye la tabla `usuarios` y el progreso (R22).
- **Falsificación de aprobación:** solo vale el archivo integrado en `origin/main` con el hash del lote. La protección de la rama `main` en GitHub (revisión obligatoria) es recomendación para D2.
- **Rendimiento:** subida en streaming (P11), índice en segundo plano (P10), reconciliación O(n·m) con n, m ≈ 600 → despreciable.

## Chequeo de constitución (Constitution check)
- **P1** — cumple: stdlib y dependencias ya presentes; paquete separado para no inflar `server.py`.
- **P2** — cumple: los géneros del frontend salen de `/genres` (R25).
- **P3** — cumple: toda escritura (ejecutor, `crear_libro`) se prueba con fakes. Ningún test toca producción.
- **P4** — cumple: tests con fila envenenada para `GET /users/` (R23) y para el overview con tabla ausente (R1).
- **P5** — cumple: cada tarea declara su comando de verificación y el log de `tasks.md` registra la salida.
- **P6** — cumple: `.env` fuera de git, `informes/` fuera de git.
- **P7** — cumple: schema de la API importado más largos de prod, en el panel y en la CLI por igual.
- **P8** — cumple: ver la sección CWE.
- **P9** — cumple: cuentas de demo locales con dominio no reservado.
- **P10** — cumple: índice en hilo aparte; el puerto abre antes.
- **P11** — cumple: streaming más diario de reanudación.
- **P12** — cumple: simulación por defecto; la ejecución real exige un PR integrado; esta entrega no escribe en producción; la migración queda propuesta, no aplicada.
- **P13** — cumple: introspección con el esquema de prod como objetivo.
- **P14** — cumple: vistas nuevas con live region, foco gestionado y `aria-current`, más verificación manual con VoiceOver (V16).
- **P15/P16** — cumple: gates registradas en `analysis.md` y `verification.md`.

## Riesgos y preguntas abiertas
- **La API de producción es una versión vieja** y no filtra por `publicado`. La garantía (b) de R16 recién rige cuando se despliegue una API que lo respete. Hasta entonces, la garantía la da solo el orden audio → ficha (a). Se deja escrito en la aprobación de la migración.
- **Horas de audio (R26, P3):** Blob no guarda duración. Se estima con `bytes × 8 / bitrate`, midiendo el bitrate real en la cabecera MP3 de una muestra de pistas (lectura por rango de los primeros bytes). Se rotula "estimado".
- **Plazo:** el 29/09 es la demo. El orden de las tareas prioriza lo que se muestra (P1: panel, reconciliación, validación y simulación de lote). Lo que no llegue queda en `tasks.md` con su estado real.
- **El snapshot local** usa el modelo local (que tiene `categoria_id` y no `editorial`); la editorial no se ve en local. Es aceptable para la demo visual y queda documentado.
