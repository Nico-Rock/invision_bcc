# Tasks — 004-consola-unica

> Atómicas, ordenadas y verificables. Cada grupo es un punto de control y una fase.
> `PYTEST_API` = `docker exec invision_local sh -c "cd /app && python -m pytest -q"` (API local con SQLite, nunca producción).
> `PYTEST_PANEL` = `.venv/bin/python -m pytest admin-dashboard -q` · `SITIO` = `cd frontend && npm run test:a11y`.
> Todo test nuevo se ve fallar antes de implementar (P5). Commits: `tipo(T#): descripción [R#]`.

**Status:** analyzed  **Date:** 2026-09-26
**Orden:** T1 (primero: vulnerabilidad) → T2 → T3 → (T4 ‖ T5) → T6 → T7 → T8 → (T9 ‖ T10 ‖ T11) → T12 → T13 → T14.

## Group A — Fase 1: la API (checkpoint)

### T1 [Story P1] — Corregir `presign-upload`
- **Satisfies:** R11, R9
- **Depends on:** none
- **Parallel:** sequential
- **Files:** `InvisionAPI-main/audiobooks/validacion_pistas.py`, `InvisionAPI-main/audiobooks/routes.py`, `InvisionAPI-main/audiobooks/test_routes.py`
- **Verification command:** `PYTEST_API`
- **Commit message:** `fix(T1): presign-upload sin rutas ni sobrescritura [R9, R11]`
- **Acceptance:** V7 sobre `presign-upload`; el SAS pasa a `c` sin `w` y 15 minutos; los tests muestran el `../` rechazado antes y después.

### T2 [Story P1] — Router de operación con rol único
- **Satisfies:** R13, R16
- **Depends on:** T1
- **Parallel:** sequential
- **Files:** `InvisionAPI-main/audiobooks/admin_ops.py`, `InvisionAPI-main/audiobooks/main.py`, `InvisionAPI-main/audiobooks/test_admin_ops.py`
- **Verification command:** `PYTEST_API` (un test recorre todas las rutas del router sin sesión y sin rol)
- **Commit message:** `feat(T2): router /admin/ops con rol Admin verificado una vez [R13, R16]`
- **Acceptance:** V9; ninguna respuesta de error trae detalle interno (V10, parte).

### T3 [Story P1] — Índice de audio y resumen en la API
- **Satisfies:** R1, R2, R3, R17
- **Depends on:** T2
- **Parallel:** sequential
- **Files:** `InvisionAPI-main/audiobooks/indice_blob.py`, `InvisionAPI-main/audiobooks/admin_ops.py`, `InvisionAPI-main/audiobooks/test_admin_ops.py`, `admin-dashboard/tests/test_paridad_api.py`
- **Verification command:** `PYTEST_API && PYTEST_PANEL`
- **Commit message:** `feat(T3): resumen e indice de audio en la API [R1, R2, R3, R17]`
- **Acceptance:** V1 (paridad), V2 y V12 (límite de refresco).

### T4 [Story P1] — Explorador y escucha previa
- **Satisfies:** R4, R5, R6, R14
- **Depends on:** T3
- **Parallel:** [P]
- **Files:** `InvisionAPI-main/audiobooks/admin_ops.py`, `InvisionAPI-main/audiobooks/test_admin_ops.py`
- **Verification command:** `PYTEST_API`
- **Commit message:** `feat(T4): explorador paginado y escucha previa de solo lectura [R4, R5, R6, R14]`
- **Acceptance:** V3, V4, V5 y V10.

### T5 [Story P1] — Permiso de subida y confirmación
- **Satisfies:** R7, R8, R9, R10, R14, R17
- **Depends on:** T3
- **Parallel:** [P]
- **Files:** `InvisionAPI-main/audiobooks/admin_ops.py`, `InvisionAPI-main/audiobooks/validacion_pistas.py`, `InvisionAPI-main/audiobooks/test_admin_ops.py`
- **Verification command:** `PYTEST_API`
- **Commit message:** `feat(T5): subida directa con permiso de solo creacion y confirmacion [R7-R10, R14, R17]`
- **Acceptance:** V6 (del lado de la API, con el contenedor simulado) y V7.

### T6 [Story P1] — Registro de operaciones
- **Satisfies:** R15, R25
- **Depends on:** T5
- **Parallel:** sequential
- **Files:** `InvisionAPI-main/audiobooks/models_operaciones.py`, `InvisionAPI-main/audiobooks/admin_ops.py`, `InvisionAPI-main/scripts/habilitar_operaciones.py`, `InvisionAPI-main/audiobooks/test_admin_ops.py`
- **Verification command:** `PYTEST_API` (con la tabla registra en la base; sin la tabla registra en el log y la operación sigue; `Base.metadata` no contiene la tabla)
- **Commit message:** `feat(T6): registro de operaciones de administracion [R15, R25]`
- **Acceptance:** V11 y V18 (degradación).

## Group B — Fase 2: la consola en el sitio (checkpoint)

### T7 [Story P1] — Pestañas Resumen y Gobernanza
- **Satisfies:** R1, R2, R12, R22
- **Depends on:** T6
- **Parallel:** sequential
- **Files:** `frontend/src/pages/Admin/AdminPanel.jsx`, `frontend/src/pages/Admin/components/Resumen.jsx`, `frontend/src/pages/Admin/components/Gobernanza.jsx`, `frontend/tests/a11y/consola.spec.js`
- **Verification command:** `SITIO`
- **Commit message:** `feat(T7): resumen y gobernanza en la consola del sitio [R1, R2, R12, R22]`
- **Acceptance:** V8 y V16 para las dos pestañas; el estado del índice se muestra sin falso éxito.

### T8 [Story P1] — Explorador de audios con escucha previa
- **Satisfies:** R4, R5, R6, R22
- **Depends on:** T7
- **Parallel:** sequential
- **Files:** `frontend/src/pages/Admin/components/ExploradorAudios.jsx`, `frontend/src/components/AudioPlayer.jsx`, `frontend/tests/a11y/consola.spec.js`
- **Verification command:** `SITIO`
- **Commit message:** `feat(T8): explorador de audios en la consola [R4, R5, R6, R22]`
- **Acceptance:** V3 y V4 desde la interfaz; V16.

### T9 [Story P1] — Carga guiada
- **Satisfies:** R7, R8, R9, R10, R22
- **Depends on:** T8
- **Parallel:** [P]
- **Files:** `frontend/src/pages/Admin/components/CargaGuiada.jsx`, `frontend/src/lib/subida.js`, `frontend/tests/a11y/consola.spec.js`
- **Verification command:** `SITIO` (Blob simulado con `page.route`: pista repetida, corte y reintento)
- **Commit message:** `feat(T9): carga guiada accesible en la consola [R7-R10, R22]`
- **Acceptance:** V6 de punta a punta; los avisos por pista van por el canal correcto (errores urgentes, progreso cortés).

### T10 [Story P1] — Atajos de la consola
- **Satisfies:** R23
- **Depends on:** T8
- **Parallel:** [P]
- **Files:** `InvisionAPI-main/audiobooks/atajos_catalogo.json`, `frontend/src/pages/Admin/AdminPanel.jsx`
- **Verification command:** `SITIO`
- **Commit message:** `feat(T10): acciones de la consola en el catalogo de atajos [R23]`
- **Acceptance:** V17 (requiere el spec 003; si no está, la tarea deja las acciones declaradas y los atajos por defecto).

### T11 [Story P2] — Paridad y no retroceso
- **Satisfies:** R18, R26
- **Depends on:** T9
- **Parallel:** [P]
- **Files:** `verificacion/a11y/informes/2026-XX-XX-consola.json`
- **Verification command:** `PYTEST_PANEL && PYTEST_API && SITIO`
- **Commit message:** `docs(T11): informe de paridad panel y consola [R18, R26]`
- **Acceptance:** V13; recorrido del panel sin retroceso.

## Group C — Fase 3: aprobación y retiro (checkpoint)

### T12 [Story P2] — Documento de aprobación del despliegue
- **Satisfies:** R19, R24
- **Depends on:** T11
- **Parallel:** sequential
- **Files:** `aprobaciones/2026-09-29_consola_unica.md`
- **Verification command:** revisión del documento
- **Commit message:** `docs(T12): aprobacion del despliegue de la consola unica [R19, R24]`
- **Acceptance:** V14: rutas nuevas, DDL de `operaciones_admin`, CORS de Blob, variables sin valores, reversión y tabla de firmas.

### T13 [Story P2] — Lista y criterio de retiro del panel
- **Satisfies:** R20, R21
- **Depends on:** T12
- **Parallel:** sequential
- **Files:** `aprobaciones/retiro_panel.md`
- **Verification command:** revisión del documento
- **Commit message:** `docs(T13): criterio de retiro del panel operativo [R20, R21]`
- **Acceptance:** V15: tabla función por función (resumen, registros, explorador, usuarios, gobernanza, carga) con equivalente, verificación en producción y firma, más el destino de cada test.

### T14 [Story P2] — Retiro (solo con T13 firmado)
- **Satisfies:** R20, R21, R18
- **Depends on:** T13
- **Parallel:** sequential
- **Files:** `admin-dashboard/` (se borra), `InvisionAPI-main/audiobooks/test_indice_blob.py`, `frontend/tests/a11y/consola.spec.js`
- **Verification command:** `PYTEST_API && SITIO`
- **Commit message:** `chore(T14): retiro del panel operativo, reemplazado por la consola [R18, R20, R21]`
- **Acceptance:** V15; no se ejecuta sin la firma de la BCC en T13.

---

## Coverage check
- R1 → T3, T7 · R2 → T3, T7 · R3 → T3 · R4 → T4, T8 · R5 → T4, T8 · R6 → T4, T8
- R7 → T5, T9 · R8 → T5, T9 · R9 → T1, T5, T9 · R10 → T5, T9 · R11 → T1
- R12 → T7 · R13 → T2 · R14 → T4, T5 · R15 → T6 · R16 → T2 · R17 → T3, T5
- R18 → T11, T14 · R19 → T12 · R20 → T13, T14 · R21 → T13, T14
- R22 → T7, T8, T9 · R23 → T10 · R24 → T12 · R25 → T6 · R26 → T11

## Implementation verification log

| Task ID | Status | Verification command | Exit code | Verified by / timestamp |
|---|---|---|---|---|
| T1 | done (vía spec 005, T1) | `PYTEST_API`: `../`, `a/b.mp3`, `.wav` rechazados; SAS de solo creación por 15 min; no se firma si la pista existe | 0 | Claude Code, 2026-09-26 |
