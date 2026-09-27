# Tasks — 003-catalogo-atajos

> Atómicas, ordenadas y verificables. Cada grupo es un punto de control.
> `PYTEST_API` = `docker exec invision_local sh -c "cd /app && python -m pytest test_atajos.py test_routes.py -q"` (API local con SQLite, nunca producción).
> `SITIO` = `cd frontend && npm run test:a11y`.
> Todo test nuevo se ve fallar antes de implementar (P5). Commits: `tipo(T#): descripción [R#]`.

**Status:** analyzed  **Date:** 2026-09-26
**Orden:** T1 → T2 → T3 → T4 → (T5 ‖ T8) → T6 → T7 → T9 → T10 → T11 → T12.

## Group A — Historia 4 y 1 [P1]: catálogo y reglas (checkpoint)

### T1 [Story P1] — Catálogo por defecto y casos de reglas
- **Satisfies:** R1, R2, R14, R15, R17, R18
- **Depends on:** none
- **Parallel:** sequential
- **Files:** `InvisionAPI-main/audiobooks/atajos_catalogo.json`, `InvisionAPI-main/audiobooks/atajos_casos.json`
- **Verification command:** `python3 -m json.tool` sobre los dos archivos
- **Commit message:** `feat(T1): catalogo de acciones por defecto y casos de reglas [R1, R2, R14, R15, R17, R18]`
- **Acceptance:** están todas las acciones actuales del sitio y las de la consola del spec 004, con valores por defecto conformes a D3; la lista de reservadas nombra quién usa cada combinación; hay al menos un caso que viola y uno que cumple cada regla.

### T2 [Story P1] — Reglas en Python puro
- **Satisfies:** R5, R14, R15, R16, R17, R18, R25
- **Depends on:** T1
- **Parallel:** sequential
- **Files:** `InvisionAPI-main/audiobooks/atajos.py`, `InvisionAPI-main/audiobooks/test_atajos.py`
- **Verification command:** `PYTEST_API`
- **Commit message:** `feat(T2): reglas del catalogo de atajos [R5, R14-R18, R25]`
- **Acceptance:** V4 contra `atajos_casos.json`; `texto_hablado` y `combinar` probados; el módulo no importa FastAPI ni SQLAlchemy.

## Group B — Historias 5, 6 y 7: almacenamiento y API (checkpoint)

### T3 [Story P2] — Tablas fuera del create_all, script local y aprobación
- **Satisfies:** R19, R21, R24, R22
- **Depends on:** T2
- **Parallel:** sequential
- **Files:** `InvisionAPI-main/audiobooks/models_atajos.py`, `InvisionAPI-main/scripts/habilitar_atajos.py`, `aprobaciones/2026-09-29_catalogo_atajos.md`, `InvisionAPI-main/audiobooks/test_atajos.py`
- **Verification command:** `PYTEST_API` (test: `Base.metadata` no contiene las tablas del catálogo; el script se niega a una URL que no sea SQLite)
- **Commit message:** `feat(T3): tablas del catalogo con aprobacion para produccion [R19, R21, R22, R24]`
- **Acceptance:** V11; el documento de aprobación trae el DDL para Azure SQL, la reversión y la tabla de firmas.

### T4 [Story P1] — Rutas de la API
- **Satisfies:** R1, R3, R5, R9, R20, R22, R23, R25
- **Depends on:** T3
- **Parallel:** sequential
- **Files:** `InvisionAPI-main/audiobooks/routes.py`, `InvisionAPI-main/audiobooks/schemas.py`, `InvisionAPI-main/audiobooks/test_routes.py`
- **Verification command:** `PYTEST_API`
- **Commit message:** `feat(T4): API del catalogo de atajos con rol Admin e historial [R1, R3, R5, R9, R20, R22, R23, R25]`
- **Acceptance:** V1, V2, V4 (vía HTTP), V8 (503 sin tabla), V13, V14 y V15 (del lado de la API).

## Group C — Historias 2 y 1: sitio (checkpoint)

### T5 [Story P1] — Biblioteca de atajos del sitio y catálogo cargado
- **Satisfies:** R7, R8, R9, R10, R25
- **Depends on:** T4
- **Parallel:** [P]
- **Files:** `frontend/src/lib/atajos.js`, `frontend/src/lib/atajos-defecto.json`, `frontend/src/context/AtajosContext.jsx`, `frontend/src/hooks/useKeyboardShortcuts.js`, `frontend/src/App.jsx`, `frontend/tests/unit/atajos.test.js`
- **Verification command:** `node --test frontend/tests/unit/` (casos compartidos + prueba de sincronía del JSON) y `SITIO`
- **Commit message:** `feat(T5): el sitio toma sus atajos del catalogo [R7-R10, R25]`
- **Acceptance:** V6, V7, V8 y V9 en el sitio; la ayuda y el `aria-keyshortcuts` se generan del catálogo.

### T6 [Story P1] — Pantalla "Atajos de teclado" en el administrador
- **Satisfies:** R1, R4, R5, R6, R22, R23
- **Depends on:** T5
- **Parallel:** sequential
- **Files:** `frontend/src/pages/Admin/AdminPanel.jsx`, `frontend/src/pages/Admin/components/AtajosTeclado.jsx`, `frontend/src/index.css`
- **Verification command:** `SITIO` (casos nuevos: captura y texto dan el mismo valor; conflicto anunciado por el canal urgente con `aria-invalid`; historial; restaurar; axe en 0)
- **Commit message:** `feat(T6): editor accesible del catalogo de atajos [R1, R4, R5, R6, R22, R23]`
- **Acceptance:** V3, V5 (pantalla), V13 y V14 desde la interfaz, y V15 (descripción envenenada mostrada como texto).

### T7 [Story P1] — Ciclo completo en el sitio
- **Satisfies:** R7, R21
- **Depends on:** T6
- **Parallel:** sequential
- **Files:** `frontend/tests/a11y/atajos.spec.js`
- **Verification command:** `SITIO`
- **Commit message:** `test(T7): ciclo editar, recargar y usar un atajo [R7, R21]`
- **Acceptance:** V6 y V12 de punta a punta en la base local.

## Group D — Historia 3: zona de administración (checkpoint)

### T8 [Story P1] — Zona "admin" del catálogo protegida por rol
- **Satisfies:** R12, R13
- **Depends on:** T4
- **Parallel:** [P]
- **Files:** `InvisionAPI-main/audiobooks/routes.py`, `InvisionAPI-main/audiobooks/test_routes.py`
- **Verification command:** `PYTEST_API`
- **Commit message:** `feat(T8): zona admin del catalogo solo con rol Admin [R12, R13]`
- **Acceptance:** V10; el panel operativo no cambia (R13).

### T9 [Story P1] — La consola responde a la zona "admin"
- **Satisfies:** R10, R11
- **Depends on:** T8, T6
- **Parallel:** sequential
- **Files:** `frontend/src/context/AtajosContext.jsx`, `frontend/src/pages/Admin/AdminPanel.jsx`, `frontend/tests/a11y/atajos.spec.js`
- **Verification command:** `SITIO`
- **Commit message:** `feat(T9): la consola responde a los atajos de su zona [R10, R11]`
- **Acceptance:** V6, V7 y V9 en la zona de administración; las pestañas del spec 004 se suman cuando existan.

## Group E — Verificación (checkpoint)

### T10 [Story P1] — Sin retroceso del spec 002
- **Satisfies:** R26, R6
- **Depends on:** T7, T9
- **Parallel:** sequential
- **Files:** `verificacion/a11y/informes/2026-09-XX-atajos.json`
- **Verification command:** `SITIO`
- **Commit message:** `docs(T10): informe de accesibilidad con el catalogo de atajos [R6, R26]`
- **Acceptance:** V5: 0 problemas en el recorrido y el arnés en verde.

### T11 [Story P2] — Matriz de lectores y PRD
- **Satisfies:** R14, R19
- **Depends on:** T10
- **Parallel:** [P]
- **Files:** `verificacion/a11y/matriz-lectores.md`, `docs/prd/2026-09-29-accesibilidad-verificable-prd.md`
- **Verification command:** revisión de los documentos
- **Commit message:** `docs(T11): prueba de atajos con lectores y decision A5 [R14, R19]`
- **Acceptance:** la matriz agrega "cambiar un atajo desde el administrador y usarlo" y "Alt + Mayúscula no choca con el lector"; el PRD agrega la decisión A5.

### T12 [Story P3] — Verificación final
- **Satisfies:** R23, R24
- **Depends on:** T10, T11
- **Parallel:** sequential
- **Files:** `.specops/specs/003-catalogo-atajos/tasks.md`
- **Verification command:** `PYTEST_API && SITIO`
- **Commit message:** `docs(T12): registro de verificacion del catalogo de atajos [R23, R24]`
- **Acceptance:** fila por tarea en el registro; confirmación de que no se ejecutó nada en producción.

---

## Coverage check
- R1 → T1, T4, T6 · R2 → T1 · R3 → T4 · R4 → T6 · R5 → T2, T4, T6 · R6 → T6, T10
- R7 → T5, T7 · R8 → T5 · R9 → T4, T5 · R10 → T5, T9 · R11 → T9 · R12 → T8 · R13 → T8
- R14 → T1, T2, T11 · R15 → T1, T2 · R16 → T2 · R17 → T1, T2 · R18 → T1, T2
- R19 → T3, T11 · R20 → T4 · R21 → T3, T7 · R22 → T3, T4, T6 · R23 → T4, T6, T12
- R24 → T3, T12 · R25 → T2, T4, T5 · R26 → T10

## Implementation verification log

| Task ID | Status | Verification command | Exit code | Verified by / timestamp |
|---|---|---|---|---|
