# Tasks — 005-administracion-sin-ver

> `PYTEST_API` = `docker exec invision_local sh -c "cd /app && python -m pytest -q"` (SQLite de prueba, nunca producción).
> `UNIT` = `node --test frontend/tests/unit/*.test.js` · `SITIO` = `cd frontend && npm run test:a11y` (con `INVISION_ADMIN_*` en el entorno).
> Todo test nuevo se ve fallar antes de implementar (P5). Commits: `tipo(T#): descripción [R#]`.

**Status:** analyzed  **Date:** 2026-09-26
**Orden:** grupo A (aprobado): T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8 → T9 → T10 → T11 → T12. Grupos B y C: esperan Gate 1.

## Group A — Reparaciones de la auditoría [P1] (checkpoint)

### T1 [Story P1] — Subida segura
- **Satisfies:** R3
- **Depends on:** none
- **Parallel:** sequential
- **Files:** `InvisionAPI-main/audiobooks/validacion_pistas.py`, `InvisionAPI-main/audiobooks/routes.py`, `InvisionAPI-main/audiobooks/test_admin_sin_ver.py`
- **Verification command:** `PYTEST_API`
- **Commit message:** `fix(T1): subida de capitulos sin rutas ni sobrescritura [R3]`
- **Acceptance:** V3; cierra T1 del spec 004.

### T2 [Story P1] — Ingesta deshabilitada y sin progreso inventado
- **Satisfies:** R1, R2
- **Depends on:** T1
- **Parallel:** sequential
- **Files:** `InvisionAPI-main/audiobooks/routes.py`, `InvisionAPI-main/audiobooks/sharepoint.py`, `InvisionAPI-main/audiobooks/test_admin_sin_ver.py`, `frontend/src/pages/Admin/components/ExcelImporter.jsx`, `frontend/package.json`
- **Verification command:** `PYTEST_API` + `grep -c startProgressSimulation` = 0
- **Commit message:** `fix(T2): ingesta simulada deshabilitada, sin escritura ni progreso falso [R1, R2]`
- **Acceptance:** V1, V2.

### T3 [Story P1] — Roles y auditoría legibles en la API
- **Satisfies:** R11, R12
- **Depends on:** T2
- **Parallel:** sequential
- **Files:** `InvisionAPI-main/audiobooks/schemas.py`, `InvisionAPI-main/audiobooks/routes.py`, `InvisionAPI-main/audiobooks/test_admin_sin_ver.py`
- **Verification command:** `PYTEST_API`
- **Commit message:** `fix(T3): roles en usuarios y persona en la auditoria [R11, R12]`
- **Acceptance:** V9 y la parte de datos de V10.

### T4 [Story P1] — Narrador y "En Memoria" sin tocar el esquema existente
- **Satisfies:** R6, R7, R28
- **Depends on:** T3
- **Parallel:** sequential
- **Files:** `InvisionAPI-main/audiobooks/models_extras.py`, `InvisionAPI-main/audiobooks/routes.py`, `InvisionAPI-main/audiobooks/schemas.py`, `InvisionAPI-main/audiobooks/habilitar_local.py`, `aprobaciones/2026-09-29_narrador_en_memoria.md`, `InvisionAPI-main/audiobooks/test_admin_sin_ver.py`
- **Verification command:** `PYTEST_API` (con y sin la tabla; `Base.metadata` no la contiene)
- **Commit message:** `feat(T4): narrador y En Memoria en tabla aparte con aprobacion [R6, R7, R28]`
- **Acceptance:** V6 (API) y parte de V16.

### T5 [Story P1] — Consola ordenada y errores urgentes
- **Satisfies:** R4, R13, R14
- **Depends on:** T4
- **Parallel:** sequential
- **Files:** `frontend/src/App.jsx`, `frontend/src/pages/Admin/AdminPanel.jsx`, `frontend/src/pages/Admin/components/AuditLogs.jsx`
- **Verification command:** `SITIO`
- **Commit message:** `fix(T5): consola con estructura sonora y errores urgentes [R4, R13, R14]`
- **Acceptance:** V11 y V10 (tabla de auditoría, dos regiones vivas).

### T6 [Story P1] — Libros: un control por fila y ficha en diálogo
- **Satisfies:** R4, R8, R9, R10, R6
- **Depends on:** T5
- **Parallel:** sequential
- **Files:** `frontend/src/pages/Admin/components/ContentManagement.jsx`, `frontend/src/pages/Admin/components/FichaLibro.jsx`
- **Verification command:** `SITIO`
- **Commit message:** `feat(T6): ficha de libro accesible con un control por fila [R4, R6, R8, R9, R10]`
- **Acceptance:** V7, V8 y V6 desde la interfaz.

### T7 [Story P1] — Capítulos desde la ficha
- **Satisfies:** R5
- **Depends on:** T6
- **Parallel:** sequential
- **Files:** `frontend/src/pages/Admin/components/CapitulosLibro.jsx`, `frontend/src/lib/capitulos.js`, `frontend/tests/unit/capitulos.test.js`
- **Verification command:** `UNIT` + `SITIO` (permiso y `PUT` simulados)
- **Commit message:** `feat(T7): subida guiada de capitulos desde la ficha [R5]`
- **Acceptance:** V5.

### T8 [Story P1] — Vocabulario con sugerencias y parecidos
- **Satisfies:** R15
- **Depends on:** T6
- **Parallel:** [P]
- **Files:** `frontend/src/lib/vocabulario.js`, `frontend/tests/unit/vocabulario.test.js`, `frontend/src/pages/Admin/components/FichaLibro.jsx`
- **Verification command:** `UNIT` + `SITIO`
- **Commit message:** `feat(T8): sugerencias y aviso de valores parecidos [R15]`
- **Acceptance:** V12.

### T9 [Story P1] — Usuarios: ficha, roles y contraseñas
- **Satisfies:** R4, R8, R9, R10, R11, R17
- **Depends on:** T5
- **Parallel:** [P]
- **Files:** `frontend/src/pages/Admin/components/UserManagement.jsx`, `frontend/src/lib/contrasena.js`, `frontend/tests/unit/contrasena.test.js`
- **Verification command:** `UNIT` + `SITIO`
- **Commit message:** `feat(T9): usuarios con ficha, roles visibles y contrasenas dictables [R4, R8-R11, R17]`
- **Acceptance:** V7, V8, V9 y V14 en usuarios.

### T10 [Story P1] — Contraste AAA de la consola
- **Satisfies:** R16
- **Depends on:** T9
- **Parallel:** sequential
- **Files:** `frontend/src/index.css`
- **Verification command:** `SITIO`
- **Commit message:** `fix(T10): contraste AAA en la consola [R16]`
- **Acceptance:** V13 (contraste).

### T11 [Story P1] — Arnés de la consola
- **Satisfies:** R16, R29, R4
- **Depends on:** T10
- **Parallel:** sequential
- **Files:** `frontend/tests/a11y/consola.spec.js`, `frontend/tests/a11y/ayudas.js`
- **Verification command:** `SITIO`
- **Commit message:** `test(T11): arnes de accesibilidad de la consola [R4, R16, R29]`
- **Acceptance:** V4, V7 a V14 automatizados.

### T12 [Story P1] — Punto de control del grupo A
- **Satisfies:** R29, R30
- **Depends on:** T11
- **Parallel:** sequential
- **Files:** `.specops/specs/005-administracion-sin-ver/tasks.md`
- **Verification command:** `PYTEST_API && UNIT && SITIO && .venv/bin/python -m pytest admin-dashboard -q`
- **Commit message:** `docs(T12): registro de verificacion del grupo A [R29, R30]`
- **Acceptance:** V16; fila por tarea en el registro.

## Group B — Mejoras [P2] (pendiente de Gate 1)

### T13 [Story P2] — Inicio con pendientes y estado de publicación
- **Satisfies:** R18, R19
- **Depends on:** T12
- **Parallel:** sequential
- **Files:** `InvisionAPI-main/audiobooks/routes.py`, `frontend/src/pages/Admin/components/Inicio.jsx`
- **Verification command:** `PYTEST_API && SITIO`
- **Commit message:** `feat(T13): inicio con pendientes y estado de publicacion [R18, R19]`
- **Acceptance:** V15 (R18, R19).

### T14 [Story P2] — Verificación de audio
- **Satisfies:** R20
- **Depends on:** T13
- **Parallel:** [P]
- **Files:** `InvisionAPI-main/audiobooks/verificacion_audio.py`
- **Verification command:** `PYTEST_API`
- **Commit message:** `feat(T14): verificacion automatica de pistas [R20]`
- **Acceptance:** V15 (R20).

### T15 [Story P2] — Tareas con estado real e importador que valida
- **Satisfies:** R21, R22
- **Depends on:** T13
- **Parallel:** [P]
- **Files:** `InvisionAPI-main/audiobooks/tareas.py`, `frontend/src/pages/Admin/components/Importador.jsx`
- **Verification command:** `PYTEST_API && SITIO`
- **Commit message:** `feat(T15): tareas con estado real e importador con validacion [R21, R22]`
- **Acceptance:** V15 (R21, R22).

### T16 [Story P2] — Papelera, deshacer y fusión de valores
- **Satisfies:** R23, R24
- **Depends on:** T13
- **Parallel:** [P]
- **Files:** `InvisionAPI-main/audiobooks/routes.py`, `frontend/src/pages/Admin/components/Papelera.jsx`
- **Verification command:** `PYTEST_API && SITIO`
- **Commit message:** `feat(T16): papelera, deshacer y fusion de valores [R23, R24]`
- **Acceptance:** V15 (R23, R24).

### T17 [Story P2] — Perfil de accesibilidad del socio
- **Satisfies:** R25
- **Depends on:** T13
- **Parallel:** [P]
- **Files:** `InvisionAPI-main/audiobooks/routes.py`, `frontend/src/context/AudioContext.jsx`, `frontend/src/pages/Admin/components/UserManagement.jsx`
- **Verification command:** `PYTEST_API && SITIO`
- **Commit message:** `feat(T17): perfil de accesibilidad inicial por socio [R25]`
- **Acceptance:** V15 (R25).

## Group C — Rendición de cuentas [P3] (pendiente de Gate 1)

### T18 [Story P3] — Auditoría de contenido e informe del día
- **Satisfies:** R26, R27
- **Depends on:** T16
- **Parallel:** sequential
- **Files:** `frontend/src/pages/Admin/components/AuditLogs.jsx`, `frontend/src/pages/Admin/components/InformeDia.jsx`
- **Verification command:** `SITIO`
- **Commit message:** `feat(T18): auditoria de contenido e informe del dia [R26, R27]`
- **Acceptance:** V15 (R26, R27).

---

## Coverage check
- R1 → T2 · R2 → T2 · R3 → T1 · R4 → T5, T6, T9, T11 · R5 → T7 · R6 → T4, T6 · R7 → T4
- R8 → T6, T9 · R9 → T6, T9 · R10 → T6, T9 · R11 → T3, T9 · R12 → T3 · R13 → T5 · R14 → T5
- R15 → T8 · R16 → T10, T11 · R17 → T9
- R18 → T13 · R19 → T13 · R20 → T14 · R21 → T15 · R22 → T15 · R23 → T16 · R24 → T16 · R25 → T17
- R26 → T18 · R27 → T18 · R28 → T4 · R29 → T11, T12 · R30 → T12

## Implementation verification log

| Task ID | Status | Verification command | Exit code | Verified by / timestamp |
|---|---|---|---|---|
| T1 | done | `PYTEST_API` (8 casos de subida vistos en rojo) | 0 | Claude Code, 2026-09-26 |
| T2 | done | `PYTEST_API` (2 casos + test viejo de ingesta actualizado a 503); `xlsx` quitado del sitio | 0 | Claude Code, 2026-09-26 |
| T3 | done | `PYTEST_API` (roles y persona en la auditoría) | 0 | Claude Code, 2026-09-26 |
| T4 | done | `PYTEST_API` (con y sin tabla; fuera del create_all) + `pytest InvisionAPI-main/scripts` 18/18; tabla habilitada en la SQLite local de la demo | 0 | Claude Code, 2026-09-26 |
| T5 | done | `SITIO` V11, V10 | 0 | Claude Code, 2026-09-26 |
| T6 | done | `SITIO` V4, V7, V8 | 0 | Claude Code, 2026-09-26 |
| T7 | done | `UNIT` + `SITIO` V5 (permiso y PUT simulados: pista repetida salteada, fallida reintentada) | 0 | Claude Code, 2026-09-26 |
| T8 | done | `UNIT` + `SITIO` V12. Hallazgo con datos reales: el catálogo ya tiene variantes con y sin tilde; la vista ofrece todas | 0 | Claude Code, 2026-09-26 |
| T9 | done | `UNIT` + `SITIO` V9, V14 | 0 | Claude Code, 2026-09-26 |
| T10 | done | `SITIO` V13 (axe 0, AAA, 48 px en 4 pestañas y 2 modos). Además: la regla de foco pasa a `!important`, porque reglas más específicas dejaban el anillo viejo | 0 | Claude Code, 2026-09-26 |
| T11 | done | `SITIO` 8 casos de la consola | 0 | Claude Code, 2026-09-26 |
| T12 | done | `UNIT` 9/9 · `SITIO` 21/21 · panel y scripts 88/88 · API 49/50 (la falla `test_stream_audio_simple_with_mock` es anterior a la rama) | 0 | Claude Code, 2026-09-26 |
