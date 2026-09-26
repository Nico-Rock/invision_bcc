# Tasks — 001-biblioteca-actualizada

> Atómicas, ordenadas, verificables por separado. Cada grupo es un checkpoint.
> Orden elegido por el plazo: primero lo que se muestra el 29/09 (grupos A–C), después lo demás.
> Comando base de tests del panel: `.venv/bin/python -m pytest admin-dashboard -q` (desde la raíz del repo).
> Commits: `tipo(T#): descripción [R#]`.

**Status:** analyzed  **Date:** 2026-09-26

## Group A — Historia 1 [P1]: panel operativo confiable (checkpoint)

### T1 [Story P1] — Introspección de esquema
- **Satisfies:** R1, R2
- **Depends on:** none
- **Parallel:** [P]
- **Files:** `admin-dashboard/invision/__init__.py`, `admin-dashboard/invision/esquema.py`, `admin-dashboard/tests/test_esquema.py`
- **Verification command:** `.venv/bin/python -m pytest admin-dashboard/tests/test_esquema.py -q`
- **Commit message:** `feat(T1): introspeccion de tablas y columnas [R1, R2]`
- **Acceptance:** `tabla_existe(db, t)` y `columnas(db, t)` responden bien en SQLite; la rama de Azure SQL arma consultas parametrizadas sobre `INFORMATION_SCHEMA` (test con cursor falso); el nombre de tabla se valida contra una lista blanca.

### T2 [Story P1] — Overview y Registros de Acceso resilientes
- **Satisfies:** R1, R2
- **Depends on:** T1
- **Parallel:** sequential
- **Files:** `admin-dashboard/server.py`, `admin-dashboard/static/index.html`, `admin-dashboard/tests/test_overview.py`
- **Verification command:** `.venv/bin/python -m pytest admin-dashboard -q`
- **Commit message:** `fix(T2): overview y registros no fallan si falta sesiones_acceso [R1, R2]`
- **Acceptance:** con una SQLite sin `sesiones_acceso`, `/api/overview` responde 200 con `no_disponible.total_access_logs`; `/api/access-logs` responde `disponible:false` con motivo; la UI muestra y anuncia "no disponible en esta base".

### T3 [Story P1] — Índice de Blob en segundo plano, con estado honesto
- **Satisfies:** R3, R4
- **Depends on:** T2
- **Parallel:** sequential
- **Files:** `admin-dashboard/invision/indice_blob.py`, `admin-dashboard/server.py`, `admin-dashboard/static/index.html`, `admin-dashboard/tests/test_indice_blob.py`
- **Verification command:** `.venv/bin/python -m pytest admin-dashboard -q`
- **Commit message:** `fix(T3): indexar Blob en segundo plano sin reportar exito falso [R3, R4]`
- **Acceptance:** el servidor abre el puerto antes de indexar; un listado que lanza una excepción deja `estado=error` y conserva el índice anterior con su fecha; nunca se imprime "indexada correctamente" tras un fallo; `POST /api/books/refrescar` (con token) reindexa.

## Group B — Historia 2 [P1]: reconciliación del catálogo (checkpoint)

### T4 [Story P1] — Normalización de títulos
- **Satisfies:** R6, R12
- **Depends on:** none
- **Parallel:** [P]
- **Files:** `admin-dashboard/invision/normalizar.py`, `admin-dashboard/tests/test_normalizar.py`
- **Verification command:** `.venv/bin/python -m pytest admin-dashboard/tests/test_normalizar.py -q`
- **Commit message:** `feat(T4): clave normalizada de titulos y autores [R6, R12]`
- **Acceptance:** `clave("Ah, pajarita, sí yo pudiera") == clave("AH PAJARITA SI YO PUDIERA")`; la ñ y las tildes se pliegan de forma consistente; la similitud entre "BESTIARIO Y TODOS LOS FUEGO" y "…FUEGOS" es ≥ 0.9.

### T5 [Story P1] — Motor de reconciliación (solo lectura)
- **Satisfies:** R5, R6, R7, R8, R33
- **Depends on:** T1, T4
- **Parallel:** sequential
- **Files:** `admin-dashboard/invision/reconciliacion.py`, `admin-dashboard/tests/test_reconciliacion.py`
- **Verification command:** `.venv/bin/python -m pytest admin-dashboard/tests/test_reconciliacion.py -q`
- **Commit message:** `feat(T5): reconciliacion catalogo-audio, generos y En Memoria [R5, R6, R7, R8, R33]`
- **Acceptance:** con fixtures de fichas y carpetas devuelve `ficha_sin_audio`, `audio_sin_ficha` (con sugerencia y confianza) y `coincidencias`, más `generos.variantes` y `generos.sin_genero`; `en_memoria` lista los libros sin narrador (o todos, con motivo "la base no registra narrador", si falta la columna); un test con una conexión que prohíbe escrituras prueba que no se ejecuta ningún INSERT/UPDATE/DELETE; la exportación CSV sale en UTF-8 con BOM (legible en Excel).

### T6 [Story P1] — Endpoints de reconciliación
- **Satisfies:** R5, R7, R33
- **Depends on:** T3, T5
- **Parallel:** sequential
- **Files:** `admin-dashboard/server.py`, `admin-dashboard/tests/test_endpoints_reconciliacion.py`
- **Verification command:** `.venv/bin/python -m pytest admin-dashboard -q && curl -s localhost:8888/api/reconciliacion | head -c 300`
- **Commit message:** `feat(T6): endpoints de reconciliacion y En Memoria [R5, R7, R33]`
- **Acceptance:** `GET /api/reconciliacion`, `GET /api/reconciliacion.csv` y `GET /api/en-memoria` responden; si el índice de Blob no está listo, devuelven 503 con el motivo y no un informe vacío; contra producción reproducen 538/520/42/24 (o la diferencia, con fecha).

## Group C — Historias 3 y 9 [P1]: carga por lotes que valida antes de escribir, con aprobación por PR (checkpoint)

### T7 [Story P1] — Lectura del manifiesto
- **Satisfies:** R9
- **Depends on:** none
- **Parallel:** [P]
- **Files:** `admin-dashboard/invision/manifiesto.py`, `admin-dashboard/tests/test_manifiesto.py`
- **Verification command:** `.venv/bin/python -m pytest admin-dashboard/tests/test_manifiesto.py -q`
- **Commit message:** `feat(T7): lectura de manifiesto CSV (utf-8/cp1252, ; o ,) [R9]`
- **Acceptance:** lee el CSV real del catálogo (cp1252, `;`) sin corromper tildes; mapea encabezados sin distinguir mayúsculas ni tildes (`GÉNERO`→`genero`); ignora columnas vacías de relleno; calcula el `lote_id` (SHA-256 del contenido normalizado), que es estable ante el reordenamiento de filas y cambia si cambia cualquier celda.

### T8 [Story P1] — Inspección de carpetas de audio locales
- **Satisfies:** R11
- **Depends on:** none
- **Parallel:** [P]
- **Files:** `admin-dashboard/invision/audio_local.py`, `admin-dashboard/tests/test_audio_local.py`
- **Verification command:** `.venv/bin/python -m pytest admin-dashboard/tests/test_audio_local.py -q`
- **Commit message:** `feat(T8): inspeccion de audio local (vacios, solo-nube, orden) [R11]`
- **Acceptance:** detecta carpeta inexistente, carpeta sin MP3, pista de 0 bytes, pista "solo en la nube" (flag `SF_DATALESS` simulado), número de pista faltante o repetido (orden ambiguo) y ruta que escapa de `--raiz` (CWE-22); devuelve las pistas ordenadas por el último número del nombre sin extensión.

### T9 [Story P1] — Validación por fila con el schema de la API
- **Satisfies:** R10, R12, R31, R30
- **Depends on:** T4, T7, T8
- **Parallel:** sequential
- **Files:** `admin-dashboard/invision/validacion.py`, `admin-dashboard/tests/test_validacion.py`
- **Verification command:** `.venv/bin/python -m pytest admin-dashboard/tests/test_validacion.py -q`
- **Commit message:** `feat(T9): validacion de lote con schema de la API y largos de prod [R10, R12, R30, R31]`
- **Acceptance:** usa `AudiobookCreateUpdate` importado de `InvisionAPI-main/audiobooks/schemas.py`; los casos de V8 (256 caracteres, género nuevo como **advertencia**, obligatorio vacío), V10 (existe con otra capitalización → omitida) y V23 (mismo título con otro narrador sin `nombre_catalogo` → inválida; con él → válida) dan lo esperado; detecta duplicados dentro del mismo manifiesto; `narrador` acepta vacío o "desconocido".

### T10 [Story P1] — Verificación de aprobaciones integradas
- **Satisfies:** R32, R35
- **Depends on:** T7
- **Parallel:** [P]
- **Files:** `admin-dashboard/invision/aprobaciones.py`, `admin-dashboard/tests/test_aprobaciones.py`, `aprobaciones/README.md`, `aprobaciones/_plantilla.md`
- **Verification command:** `.venv/bin/python -m pytest admin-dashboard/tests/test_aprobaciones.py -q`
- **Commit message:** `feat(T10): aprobaciones oficiales por PR, verificadas contra origin/main [R32, R35]`
- **Acceptance:** en un repo git temporal con un remoto falso: rechaza si el archivo no existe en `origin/main`, si solo existe localmente, si el hash no coincide con el lote o si falta `aprobado_por`/`fecha`; acepta el caso correcto. El README explica el flujo PR → merge → ejecutar.

### T11 [Story P1] — Ejecutor de lote: simulación por defecto, audio antes que ficha, retomable
- **Satisfies:** R13, R14, R15, R16, R27, R29, R34
- **Depends on:** T9, T10
- **Parallel:** sequential
- **Files:** `admin-dashboard/invision/lote.py`, `admin-dashboard/tests/test_lote.py`, `.gitignore`
- **Verification command:** `.venv/bin/python -m pytest admin-dashboard/tests/test_lote.py -q`
- **Commit message:** `feat(T11): ejecutor de lotes retomable con simulacion por defecto [R13, R14, R15, R16, R27, R29, R34]`
- **Acceptance:** V11 (la simulación no escribe; la ejecución sin aprobación se rechaza), V12 (se interrumpe tras N pistas, se reanuda, no hay duplicados ni re-subidas), V13 (queda `informes/lotes/<lote>/informe.json` e `informe.md`), V14 (un fallo de audio no crea la ficha), V25 (el narrador queda en el informe si falta la columna) y V22 (las pistas se pasan como stream, sin `read()` completo). `informes/` queda en `.gitignore`.

### T12 [Story P1] — CLI `cargar_lote.py`
- **Satisfies:** R13, R15
- **Depends on:** T11
- **Parallel:** sequential
- **Files:** `admin-dashboard/cargar_lote.py`, `admin-dashboard/tests/test_cli.py`
- **Verification command:** `.venv/bin/python -m pytest admin-dashboard/tests/test_cli.py -q && .venv/bin/python admin-dashboard/cargar_lote.py --help`
- **Commit message:** `feat(T12): CLI validar/simular/ejecutar [R13, R15]`
- **Acceptance:** `validar` y `simular` nunca abren conexión de escritura; `simular` imprime el `lote_id` y la ruta del informe; `ejecutar` exige `--aprobacion`; los códigos de salida son 0 (ok), 1 (filas inválidas) y 2 (rechazo por aprobación).

## Group D — Historias 4 y 8 [P2]: interfaz de administración mejorada (checkpoint)

### T13 [Story P2] — Formulario individual alineado a producción
- **Satisfies:** R17, R30
- **Depends on:** T1, T9
- **Parallel:** sequential
- **Files:** `admin-dashboard/server.py`, `admin-dashboard/static/carga.js`, `admin-dashboard/static/index.html`, `admin-dashboard/test_server.py`
- **Verification command:** `.venv/bin/python -m pytest admin-dashboard -q`
- **Commit message:** `feat(T13): carga individual con editorial y narrador, sin categoria [R17, R30]`
- **Acceptance:** V15; `crear_libro` inserta solo las columnas existentes (introspección) y reusa la validación de T9; el desplegable de categoría desaparece si no existe la tabla; los tests existentes siguen verdes (ajustados donde el contrato cambió a propósito).

### T14 [Story P2] — Validación de lote desde el panel
- **Satisfies:** R18, R28
- **Depends on:** T12, T13
- **Parallel:** sequential
- **Files:** `admin-dashboard/server.py`, `admin-dashboard/static/lotes.js`, `admin-dashboard/static/index.html`, `admin-dashboard/tests/test_endpoint_lotes.py`
- **Verification command:** `.venv/bin/python -m pytest admin-dashboard -q`
- **Commit message:** `feat(T14): vista accesible de validacion de lotes [R18, R28]`
- **Acceptance:** `POST /api/lotes/validar` exige token, acota el cuerpo a 2 MB y confina `raiz` a `LOTES_RAIZ`; la vista anuncia el resumen ("120 válidas, 12 con problemas, 3 advertencias") en la live region; la tabla es navegable con teclado y el texto se inserta con `textContent`; la vista no ofrece ejecutar.

### T15 [Story P2] — Vistas de reconciliación y En Memoria
- **Satisfies:** R19, R28, R33
- **Depends on:** T6
- **Parallel:** [P]
- **Files:** `admin-dashboard/static/reconciliacion.js`, `admin-dashboard/static/index.html`
- **Verification command:** `node --check admin-dashboard/static/reconciliacion.js`
- **Commit message:** `feat(T15): vistas accesibles de reconciliacion y En Memoria [R19, R28, R33]`
- **Acceptance:** secciones con encabezados navegables, conteos anunciados, botón de descarga del CSV y estado "índice de audio no disponible" cuando corresponde.

### T16 [Story P2] — `aria-current` en la navegación
- **Satisfies:** R20
- **Depends on:** none
- **Parallel:** [P]
- **Files:** `admin-dashboard/static/index.html`
- **Verification command:** `grep -c 'aria-current' admin-dashboard/static/index.html`
- **Commit message:** `fix(T16): la navegacion anuncia la seccion actual [R20]`
- **Acceptance:** al cambiar de sección, solo el ítem activo tiene `aria-current="page"`.

### T29 [Story P2] — Correcciones de la auditoría de accesibilidad (panel y sitio)
- **Satisfies:** R28, R42
- **Depends on:** T28
- **Parallel:** sequential
- **Files:** `admin-dashboard/static/index.html`, `frontend/src/index.css`
- **Verification command:** axe-core en el navegador (V34) + medición de escalado con A+
- **Commit message:** `fix(T29): correcciones de la auditoria axe y escalado de botones del sitio [R28, R42]`
- **Acceptance:** V34.

### T28 [Story P2] — Ayudas al usuario del mockup accesible en el panel
- **Satisfies:** R41, R20, R28
- **Depends on:** T27
- **Parallel:** sequential
- **Files:** `admin-dashboard/static/ayuda.js`, `admin-dashboard/static/a11y.js`, `admin-dashboard/static/index.html`
- **Verification command:** `node --check admin-dashboard/static/ayuda.js` + V33 y V16 (navegación) en el navegador
- **Commit message:** `feat(T28): atajos, ayuda, dictado y sonido de foco del mockup accesible [R41, R20, R28]`
- **Acceptance:** V33; cubre también T16 (aria-current).

### T27 [Story P2] — Barra de accesibilidad visual del sitio en el panel
- **Satisfies:** R40, R28
- **Depends on:** none
- **Parallel:** [P]
- **Files:** `admin-dashboard/static/index.html`, `admin-dashboard/static/a11y.js`
- **Verification command:** `node --check admin-dashboard/static/a11y.js` + V32 en el navegador
- **Commit message:** `feat(T27): barra de accesibilidad visual del sitio en el panel [R40, R28]`
- **Acceptance:** V32.

### T24 [Story P2] — Fondo del faro al 90 % de transparencia
- **Satisfies:** R37
- **Depends on:** none
- **Parallel:** [P]
- **Files:** `admin-dashboard/static/index.html`
- **Verification command:** `grep -c 'fondo-faro' admin-dashboard/static/index.html` + captura del panel
- **Commit message:** `feat(T24): fondo decorativo del faro al 90% de transparencia [R37]`
- **Acceptance:** V29.

## Group E — Historia 5 [P2]: catálogo real en local (checkpoint)

### T17 [Story P2] — Snapshot de lectura prod → SQLite local
- **Satisfies:** R21, R22, R36
- **Depends on:** none
- **Parallel:** [P]
- **Files:** `InvisionAPI-main/scripts/snapshot_catalogo.py`, `InvisionAPI-main/scripts/README.md`
- **Verification command:** `.venv/bin/python InvisionAPI-main/scripts/snapshot_catalogo.py --destino InvisionAPI-main/audiobooks/invision.db && sqlite3 InvisionAPI-main/audiobooks/invision.db "select count(*) from audiolibros; select count(*) from usuarios where email not like '%@invision.com'"`
- **Commit message:** `feat(T17): snapshot de solo lectura del catalogo a SQLite local [R21, R22, R36]`
- **Acceptance:** el modo demo se activa solo con `DATABASE_URL` explícito en el comando (nunca en `.env` ni en archivos versionados), documentado en el README como solo para demo (V28); solo emite `SELECT` a producción (la conexión se abre en modo lectura y se verifica con un test sobre un cursor falso); copia `audiolibros` (nombre, autor, genero, descripcion); no copia `usuarios` ni `progreso_audiolibros`; deja las cuentas demo locales; el frontend en :3000 lista los géneros reales (V17).

### T25 [Story P2] — Paridad local: mayúsculas acentuadas en SQLite
- **Satisfies:** R38
- **Depends on:** T17
- **Parallel:** sequential
- **Files:** `InvisionAPI-main/audiobooks/database.py`, `InvisionAPI-main/audiobooks/test_database.py`
- **Verification command:** `docker exec invision_local sh -c "cd /app && python -m pytest test_database.py -q -k acentos"` + V30 con curl
- **Commit message:** `fix(T25): lower() Unicode en conexiones SQLite locales [R38]`
- **Acceptance:** V30; el hook y `check_same_thread=False` solo se aplican si el motor es SQLite; el streaming local responde 200.

## Group F — Historia 6 [P2]: deuda estructural (checkpoint)

### T18 [Story P2] — Correo validado en la entrada, no en la salida
- **Satisfies:** R23
- **Depends on:** none
- **Parallel:** [P]
- **Files:** `InvisionAPI-main/audiobooks/schemas.py`, `InvisionAPI-main/audiobooks/test_routes.py`
- **Verification command:** `docker exec invision_local sh -c "pip install -q pytest && cd /app && python -m pytest test_routes.py -q"`
- **Commit message:** `fix(T18): UserResponse acepta correos historicos, la validacion queda en la entrada [R23]`
- **Acceptance:** V18: con un usuario `.local` en la base, `GET /users/` responde 200 con todos; `UserCreate` sigue rechazando `.local`.

### T19 [Story P2] — Número de capítulo sin confundir la extensión
- **Satisfies:** R24
- **Depends on:** none
- **Parallel:** [P]
- **Files:** `InvisionAPI-main/audiobooks/crud.py`, `InvisionAPI-main/audiobooks/test_database.py`
- **Verification command:** `docker exec invision_local sh -c "cd /app && python -m pytest test_database.py -q"`
- **Commit message:** `fix(T19): indice de capitulo desde el nombre sin extension [R24]`
- **Acceptance:** V19: `Pista 1.mp3 … Pista 20.mp3` → índices 1…20 en orden; una sola función compartida por las dos rutas.

### T20 [Story P2] — Géneros del frontend desde la API
- **Satisfies:** R25
- **Depends on:** T17
- **Parallel:** sequential
- **Files:** `frontend/src/App.jsx`
- **Verification command:** `cd frontend && npx eslint src/App.jsx src/pages/Home.jsx && npm run build && ! grep -n "Filtrando Biografías" src/App.jsx` (lint acotado por A11)
- **Commit message:** `fix(T20): generos del menu lateral desde /genres [R25]`
- **Acceptance:** V20: no quedan nombres de género fijos; el menú visible muestra los géneros de la API, anuncia el elegido y filtra; ningún botón enfocable queda dentro de un contenedor `sr-only` (hallazgo A12, WCAG 2.4.7); con la API caída muestra un estado accesible.

### T26 [Story P2] — Autor real en el catálogo del frontend
- **Satisfies:** R39
- **Depends on:** none
- **Parallel:** [P]
- **Files:** `frontend/src/pages/Home.jsx`
- **Verification command:** `cd frontend && npx eslint src/pages/Home.jsx` + V31 en el navegador
- **Commit message:** `fix(T26): mostrar el autor que devuelve /search [R39]`
- **Acceptance:** V31.

## Group G — Historias 3 y 8 [P2]: migración aditiva propuesta (checkpoint)

### T21 [Story P2] — Migración `publicado` + `narrador` con reversión
- **Satisfies:** R16, R34
- **Depends on:** T11
- **Parallel:** [P]
- **Files:** `InvisionAPI-main/migrations/2026-09-29_publicacion_narrador.sql`, `InvisionAPI-main/migrations/2026-09-29_publicacion_narrador_rollback.sql`, `InvisionAPI-main/migrations/README.md`, `aprobaciones/2026-09-29_migracion_publicacion_narrador.md`
- **Verification command:** `.venv/bin/python -m pytest admin-dashboard/tests/test_migracion.py -q`
- **Commit message:** `feat(T21): proponer migracion aditiva publicado+narrador (sin aplicar) [R16, R34]`
- **Acceptance:** el equivalente SQLite se aplica y se revierte sobre una copia del snapshot sin perder filas; las filas existentes quedan `publicado=1`; el documento de aprobación queda en borrador para el PR (D6) y **no se aplica en producción**.

## Group H — Historia 7 [P3]: cifras del aniversario

### T22 [Story P3] — Horas de audio estimadas y socios activos
- **Satisfies:** R26
- **Depends on:** T3
- **Parallel:** [P]
- **Files:** `admin-dashboard/invision/indice_blob.py`, `admin-dashboard/server.py`, `admin-dashboard/static/index.html`, `admin-dashboard/tests/test_cifras.py`
- **Verification command:** `.venv/bin/python -m pytest admin-dashboard -q`
- **Commit message:** `feat(T22): horas de audio estimadas y socios activos en el resumen [R26]`
- **Acceptance:** V21: el bitrate se mide en la cabecera MP3 de una muestra (lectura por rango); la cifra se rotula "estimado"; los socios activos = usuarios distintos con progreso.

## Group Z — Verificación final

### T23 [Story P2] — Verificación manual con VoiceOver y `verification.md`
- **Satisfies:** R28
- **Depends on:** T14, T15, T16
- **Parallel:** sequential
- **Files:** `.specops/specs/001-biblioteca-actualizada/verification.md`
- **Verification command:** `python3 ~/.claude/skills/specops/scripts/validate_artifacts.py .specops/specs/001-biblioteca-actualizada`
- **Commit message:** `docs(T23): matriz de trazabilidad y evidencia [R28]`
- **Acceptance:** V16 ejecutada y registrada; cada V# con evidencia o marcada como pendiente con su motivo; compuerta CWE registrada.

---

## Coverage check
- R1 → T1, T2 · R2 → T1, T2 · R3 → T3 · R4 → T3
- R5 → T5, T6 · R6 → T4, T5 · R7 → T5, T6 · R8 → T5
- R9 → T7 · R10 → T9 · R11 → T8 · R12 → T4, T9
- R13 → T11, T12 · R14 → T11 · R15 → T11, T12 · R16 → T11, T21
- R17 → T13 · R18 → T14 · R19 → T15 · R20 → T16, T28 · R41 → T28 · R37 → T24 · R40 → T27
- R21 → T17 · R22 → T17 · R38 → T25 · R36 → T17 · R23 → T18 · R24 → T19 · R25 → T20 · R39 → T26 · R42 → T29 · R26 → T22
- R27 → T11 · R28 → T14, T15, T23 · R29 → T11
- R30 → T9, T13 · R31 → T9 · R32 → T10 · R33 → T5, T6, T15 · R34 → T11, T21 · R35 → T10

## Implementation verification log

| Task ID | Status | Verification command | Exit code | Verified by / timestamp |
|---|---|---|---|---|
| T1 | Pass | `pytest admin-dashboard/tests/test_esquema.py` (6 passed) | 0 | Claude Code (2026-09-26) |
| T2 | Pass | `pytest admin-dashboard` (44 passed) + `curl /api/overview` contra prod: 81 usuarios, sesiones "no disponible" | 0 | Claude Code (2026-09-26) |
| T3 | Pass | `pytest admin-dashboard` (53 passed); puerto abierto en 1,3 s; prod: 520 libros, 257,68 GB; clave inválida → estado=error | 0 | Claude Code (2026-09-26) |
| T24 | Pass | captura del panel: faro con opacidad 0.1, aria-hidden, `display:none` en alto contraste | 0 | Claude Code (2026-09-26) |
| T17 | Pass | `pytest InvisionAPI-main/scripts` (5 passed); snapshot real: 538 fichas, solo cuentas demo en usuarios | 0 | Claude Code (2026-09-26) |
| T25 | Pass | `pytest test_database.py -k acentos` (3 passed); POESÍA 11 / NARRATIVA 142 / INFANTIL 52 = prod; stream 206 audio/mpeg | 0 | Claude Code (2026-09-26) |
| T26 | Pass | `eslint Home.jsx`; navegador: "A CARA DESCUBIERTA" → "SIDNEY SHELDON" | 0 | Claude Code (2026-09-26) |
| T19 | Pass | `pytest test_database.py test_routes.py` (33 passed; 1 falla previa A7); app: "Capítulo 1 de 20" reproduciendo 0:33 / 21:01 | 0 | Claude Code (2026-09-26) |
| T27 | Pass | navegador: A+ 16→18 px anunciado, tope 28 y piso 12, sin scroll horizontal a 28 px, preferencias persisten al recargar; barrido de contraste de todos los textos visibles: 0 bajo AA en estándar y en alto contraste (se corrigieron 2 etiquetas, 5 botones sobre amarillo, `--accent-emerald` 3,77→5,48 y `--text-muted` 4,16→4,97 en hover) | 0 | Claude Code (2026-09-26) |
| T28 | Pass | navegador: 1er Tab = "Saltar al contenido principal"; bienvenida anunciada; 1-6 cambian sección con anuncio y aria-current; "3" en un campo o Ctrl+1 no navegan; H/? abre la ayuda (modal centrado, foco adentro, foco devuelto al cerrar); S enfoca el buscador; Espacio real reproduce/pausa con anuncio; flecha derecha +15 s; Esc cierra el reproductor; sonido de foco: 1 oscilador con señales, 0 sin señales. Cubre T16 (aria-current). | 0 | Claude Code (2026-09-26) |
| T29 | Pass | axe-core 4.10 (WCAG 2.0/2.1/2.2 A+AA): panel 0 violaciones en 6 secciones y en alto contraste (antes 1 seria: tabla de usuarios sin acceso por teclado); sitio 0 violaciones; con A+ al máximo, 74 de 74 textos del catálogo escalan (antes 17 botones fijos en 13,3 px), sin scroll horizontal | 0 | Claude Code (2026-09-26) |
