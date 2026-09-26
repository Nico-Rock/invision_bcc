# Tasks — 002-conformidad-accesibilidad

> Atómicas, ordenadas, verificables. Cada grupo es un punto de control.
> `PYTEST` = `.venv/bin/python -m pytest admin-dashboard -q` · `NODETEST` = `node --test admin-dashboard/tests/js/*.test.js` · `MEDIR` = inyectar `verificacion/a11y/medir.js` en la app y correr `await Medir.todo({ app })`.
> Commits: `tipo(T#): descripción [R#]`. Todo test nuevo se ve fallar antes de implementar (P5).

**Status:** analyzed  **Date:** 2026-09-26
**Orden:** T1‖T2‖T3 → T4 → T5‖T6 → T7 → T8 → T9, T10‖T11 → T12 (punto de control P1, para el 29/09) → grupo C → grupo D → grupo E.

## Group A — Historias 1, 2 y 3 [P1]: panel al 200 %, dos canales, AAA (checkpoint)

### T1 [Story P1] — Herramienta de medición y línea de base
- **Satisfies:** R22, R24
- **Depends on:** none
- **Parallel:** [P]
- **Files:** `verificacion/a11y/medir.js`, `verificacion/a11y/vendor/axe.min.js` (versión fijada), `verificacion/a11y/informes/2026-09-26-linea-base-panel.json`
- **Verification command:** `node --check verificacion/a11y/medir.js` + MEDIR en el panel actual
- **Commit message:** `feat(T1): herramienta de medicion a11y y linea de base [R22, R24]`
- **Acceptance:** el JSON de línea de base registra las fallas conocidas: tope 175 %, 3 regiones vivas, 16 textos bajo AAA, 6 objetivos bajo 48, foco 1,35:1 sobre blanco. El barrido compone el faro y los fondos con alfa.

### T2 [Story P1] — Lógica pura y fuente única de atajos
- **Satisfies:** R1, R15, R39
- **Depends on:** none
- **Parallel:** [P]
- **Files:** `admin-dashboard/static/a11y-logica.js`, `admin-dashboard/tests/js/a11y_logica.test.js`, `admin-dashboard/tests/test_js.py`
- **Verification command:** `NODETEST && PYTEST`
- **Commit message:** `feat(T2): logica a11y pura con tests node [R1, R15, R39]`
- **Acceptance:** casos de texto 30→32→32 (límite) y 17→16/18 redondeado al paso; volumen 0,5→0,6 y límites en 0 y 1; pista vecina con extremos en `null`; tabla única de secciones y atajos, de la que salen los textos de ayuda.

### T3 [Story P1] — Test estático de estructura (en rojo)
- **Satisfies:** R4, R8, R18, R19, R25, R39
- **Depends on:** none
- **Parallel:** [P]
- **Files:** `admin-dashboard/tests/test_a11y_estatico.py`
- **Verification command:** `PYTEST` (casos de tareas futuras con `xfail(strict=True)` y el id de la tarea)
- **Commit message:** `test(T3): estructura a11y del panel en rojo [R4, R8, R18, R19, R25, R39]`
- **Acceptance:** cada caso cita su V#: 2 regiones vivas; 0 colores de texto literales fuera de los tokens; `#D34500` solo en `--brand-orange`; `nav` con nombre; `footer`; nombre accesible = texto visible; `aria-keyshortcuts` válidos.

### T4 [Story P1] — Tokens AAA en modo estándar y alto contraste
- **Satisfies:** R7, R8, R9, R10, R25
- **Depends on:** T1, T3
- **Parallel:** sequential
- **Files:** `admin-dashboard/static/index.html`
- **Verification command:** `PYTEST` + MEDIR (contraste) en los dos modos y las 6 secciones
- **Commit message:** `feat(T4): tokens AAA estandar y alto contraste del marco [R7, R8, R9, R10, R25]`
- **Acceptance:** V6 y V7 en 0; ningún texto usa `#D34500`; tarjetas `#121212` con borde; placeholders con token; el caso V18 del test estático en verde.

### T5 [Story P1] — Estado sin depender solo del color
- **Satisfies:** R11
- **Depends on:** T4
- **Parallel:** [P]
- **Files:** `admin-dashboard/static/index.html`
- **Verification command:** revisión V8 con capturas de los dos modos
- **Commit message:** `feat(T5): indicadores de estado con texto o icono [R11]`
- **Acceptance:** V8.

### T6 [Story P1] — Explorador construido con nodos y contexto de reproducción
- **Satisfies:** R2, R5, R15, R35
- **Depends on:** T4
- **Parallel:** [P]
- **Files:** `admin-dashboard/static/index.html` (`renderBooks`, `playAudioTrack`, `closeAudioPlayer`)
- **Verification command:** `PYTEST` + navegador: un título con `'` y `<b>` se muestra literal; "Probar" reproduce; un error de audio va al canal urgente (sin `alert`)
- **Commit message:** `refactor(T6): explorador sin innerHTML y contexto de reproduccion [R2, R5, R15, R35]`
- **Acceptance:** 0 `innerHTML` con datos en el explorador; nombres largos en varias líneas; `reproduccion = { libro, indice, disparador }`.

### T7 [Story P1] — Texto al 200 % como proporción y reacomodo
- **Satisfies:** R1, R2, R3, R37
- **Depends on:** T2, T4, T6
- **Parallel:** sequential
- **Files:** `admin-dashboard/static/a11y.js`, `admin-dashboard/static/index.html` (script en `<head>`, `html.high-contrast`, `--font-factor`, `texto-amplio`, wraps y grillas)
- **Verification command:** `NODETEST` + MEDIR a 16, 24 y 32 px con 1280 px de ancho, y a 640 px
- **Commit message:** `feat(T7): texto al 200% proporcional y sin cortes [R1, R2, R3, R37]`
- **Acceptance:** V1, V2, V3 y V28; los 3 botones del encabezado visibles en las 6 secciones; una preferencia de navegador de 20 px no se pisa.

### T8 [Story P1] — Dos canales de aviso y "Lectura en voz"
- **Satisfies:** R4, R5, R6, R28, R38
- **Depends on:** T2, T3
- **Parallel:** sequential
- **Files:** `admin-dashboard/static/index.html`, `admin-dashboard/static/a11y.js`, `admin-dashboard/static/ayuda.js`, `admin-dashboard/static/carga.js`
- **Verification command:** `PYTEST` (conteo = 2) + navegador: error → urgente; cambio de sección → cortés; recarga → solo bienvenida; dos corteses seguidos llegan completos; con voz apagada, `speechSynthesis.speak` = 0 llamadas
- **Commit message:** `feat(T8): canal cortes y urgente, voz propia opcional [R4, R5, R6, R28, R38]`
- **Acceptance:** V4, V5, V20 y V29; se quita el `role="status"` de `#estado-indice-audio`; el índice `listo` no se anuncia al cargar.

## Group B — Historia 10 [P1]: defectos de la revisión de 001 (checkpoint)

### T9 [Story P1] — Dictado que no se escucha a sí mismo
- **Satisfies:** R34
- **Depends on:** T8
- **Parallel:** [P]
- **Files:** `admin-dashboard/static/ayuda.js`, `admin-dashboard/tests/js/dictado.test.js`
- **Verification command:** `NODETEST` (reconocedor y voz simulados: `start()` solo después del fin de la voz; segundo clic → `abort()`; `not-allowed` → aviso de permiso) + prueba manual con parlantes
- **Commit message:** `fix(T9): el dictado no captura la voz del panel [R34]`
- **Acceptance:** V25.

### T10 [Story P1] — Foco y guardas de los atajos
- **Satisfies:** R35, R36, R39
- **Depends on:** T2, T6, T8
- **Parallel:** [P]
- **Files:** `admin-dashboard/static/ayuda.js`, `admin-dashboard/static/index.html` (`switchTab`, emojis con `aria-hidden`, `aria-keyshortcuts="H ?"`)
- **Verification command:** navegador con teclas reales (V26, V27) + `PYTEST` (V30 estático)
- **Commit message:** `fix(T10): atajos sin foco perdido ni teclas secuestradas [R35, R36, R39]`
- **Acceptance:** V26, V27 y la parte de atajos de V30; "Reproduciendo" solo tras un `play()` exitoso.

### T11 [Story P1] — Nombres accesibles iguales al texto visible
- **Satisfies:** R19
- **Depends on:** T3
- **Parallel:** [P]
- **Files:** `admin-dashboard/static/index.html`, `admin-dashboard/static/a11y.js`
- **Verification command:** `PYTEST` (caso de nombre accesible del test estático en verde)
- **Commit message:** `fix(T11): nombre accesible igual al texto visible en la barra [R19]`
- **Acceptance:** V13 (parte de nombres) en el panel.

### T12 [Story P1] — Punto de control P1 (demo del 29/09)
- **Satisfies:** R24
- **Depends on:** T4, T5, T6, T7, T8, T9, T10, T11
- **Parallel:** sequential
- **Files:** `verificacion/a11y/informes/2026-09-XX-panel-p1.json`, `.specops/specs/002-conformidad-accesibilidad/tasks.md`
- **Verification command:** `PYTEST && NODETEST` + MEDIR en los dos modos, las 6 secciones, a 32 px y a 640 px + axe WCAG 2.2 AA en 0 (V17) + revisión de R37, R40 y R41 de 001
- **Commit message:** `docs(T12): informe del punto de control P1 del panel [R24]`
- **Acceptance:** informe fechado; fila en el registro de verificación.

## Group C — Historias 4 a 7 [P2]: panel (checkpoint)

### T13 [Story P2] — Foco unificado con doble anillo
- **Satisfies:** R13, R26, R27
- **Depends on:** T12
- **Parallel:** sequential
- **Files:** `admin-dashboard/static/index.html`
- **Verification command:** `PYTEST` (0 `outline: none`) + recorrido real con Tab en los dos modos (MEDIR paso de foco)
- **Commit message:** `feat(T13): anillo de foco 4/4 con contraste en ambos modos [R13, R26, R27]`
- **Acceptance:** V10 (anillo) y V19.

### T14 [Story P2] — Foco nunca tapado
- **Satisfies:** R14
- **Depends on:** T13
- **Parallel:** [P]
- **Files:** `admin-dashboard/static/index.html`
- **Verification command:** Tab hasta el final de Carga y Usuarios con el reproductor abierto, a 32 px
- **Commit message:** `fix(T14): el reproductor fijo no tapa el foco [R14]`
- **Acceptance:** V10 (siempre a la vista).

### T15 [Story P2] — Objetivos de 48 px
- **Satisfies:** R12
- **Depends on:** T13
- **Parallel:** [P]
- **Files:** `admin-dashboard/static/index.html`
- **Verification command:** MEDIR (objetivos a 12 y 16 px)
- **Commit message:** `feat(T15): controles de al menos 48 px [R12]`
- **Acceptance:** V9.

### T16 [Story P2] — Atajos del reproductor ↑↓, N/P y M
- **Satisfies:** R15, R16
- **Depends on:** T2, T6, T10
- **Parallel:** sequential
- **Files:** `admin-dashboard/static/ayuda.js`, `admin-dashboard/static/index.html` (tabla de ayuda generada desde la fuente única)
- **Verification command:** `NODETEST` + teclas reales (↑ 50→60 anunciado; N → pista 2; M silencia; "n" en el buscador se escribe)
- **Commit message:** `feat(T16): volumen, pista y silencio por teclado [R15, R16]`
- **Acceptance:** V11 y los casos borde 3 y 4.

### T17 [Story P2] — Movimiento reducido y faro con colores forzados
- **Satisfies:** R17, R39
- **Depends on:** T12
- **Parallel:** [P]
- **Files:** `admin-dashboard/static/index.html`
- **Verification command:** MEDIR con `prefers-reduced-motion` y `forced-colors` emulados
- **Commit message:** `feat(T17): movimiento reducido y faro oculto con colores forzados [R17, R39]`
- **Acceptance:** V12 y la parte del faro de V30.

### T18 [Story P2] — Regiones con nombre y pie
- **Satisfies:** R18
- **Depends on:** T11
- **Parallel:** [P]
- **Files:** `admin-dashboard/static/index.html`
- **Verification command:** `PYTEST` + axe (reglas de regiones)
- **Commit message:** `feat(T18): regiones con nombre y pie de gobernanza [R18]`
- **Acceptance:** V13 (regiones).

### T19 [Story P2] — Punto de control P2 del panel
- **Satisfies:** R24, R39
- **Depends on:** T13, T14, T15, T16, T17, T18
- **Parallel:** sequential
- **Files:** `verificacion/a11y/informes/2026-XX-XX-panel-p2.json`
- **Verification command:** igual que T12, más V9–V13, V19 y V30 completo
- **Commit message:** `docs(T19): informe del punto de control P2 del panel [R24, R39]`
- **Acceptance:** informe fechado.

## Group D — Historia 8: el sitio (checkpoint)

> Verificación base del grupo: `cd frontend && npx eslint <archivos tocados> && npm run build` (lint acotado por el hallazgo A11 de 001).

### T20 [Story P2] — Arnés automático del sitio
- **Satisfies:** R33
- **Depends on:** T1
- **Parallel:** [P]
- **Files:** `frontend/package.json`, `frontend/playwright.config.js`, `frontend/tests/a11y/*.spec.js`
- **Verification command:** `cd frontend && npm run test:a11y`
- **Commit message:** `test(T20): arnes axe y playwright del sitio [R33]`
- **Acceptance:** V24; el `vite build` no cambia; los casos con login se saltean con motivo si falta la API local.

### T21 [Story P2] — Tokens, factor de texto y código muerto del sitio
- **Satisfies:** R21
- **Depends on:** T4, T20
- **Parallel:** sequential
- **Files:** `frontend/src/index.css`, `frontend/src/context/AudioContext.jsx`, `frontend/src/App.css` (se borra)
- **Verification command:** base del grupo + `npm run test:a11y` + MEDIR en el sitio
- **Commit message:** `feat(T21): tokens AAA y texto al 200% en el sitio [R21]`
- **Acceptance:** V14 (V1–V3, V6, V7); preferencias acotadas (CWE-20).

### T22 [Story P2] — Géneros reales visibles
- **Satisfies:** R20
- **Depends on:** T21
- **Parallel:** [P]
- **Files:** `frontend/src/App.jsx`, `frontend/src/pages/Home.jsx`
- **Verification command:** base del grupo + MEDIR (0 enfocables dentro de `.sr-only`)
- **Commit message:** `fix(T22): filtro de generos real y visible [R20]`
- **Acceptance:** V14. Cierra T20 y A12 del spec 001.

### T23 [Story P2] — Dos canales, voz opcional y nombres en el sitio
- **Satisfies:** R21, R28, R19
- **Depends on:** T21
- **Parallel:** [P]
- **Files:** `frontend/index.html`, `frontend/src/context/AudioContext.jsx`, `frontend/src/components/A11yBar.jsx`, `frontend/src/pages/Home.jsx`, `frontend/src/pages/Login.jsx`, `frontend/src/pages/Admin/components/ExcelImporter.jsx`
- **Verification command:** `npm run test:a11y` (conteo = 2; espía de `speechSynthesis`)
- **Commit message:** `feat(T23): canales de aviso y lectura en voz en el sitio [R21, R28, R19]`
- **Acceptance:** V14 (V4, V5), V20 y V13 (nombres) en el sitio.

### T24 [Story P2] — Atajos del sitio corregidos y del reproductor
- **Satisfies:** R29, R15
- **Depends on:** T23
- **Parallel:** sequential
- **Files:** `frontend/src/hooks/useKeyboardShortcuts.js`, `frontend/src/App.jsx`, `frontend/src/pages/Home.jsx`, `frontend/src/context/AudioContext.jsx`, `frontend/src/components/AudioPlayer.jsx`
- **Verification command:** `npm run test:a11y` con teclas reales
- **Commit message:** `fix(T24): atajos del sitio que funcionan y sin secuestrar teclas [R29, R15]`
- **Acceptance:** V21 y V11 en el sitio.

### T25 [Story P2] — Modales con `<dialog>`
- **Satisfies:** R30
- **Depends on:** T23
- **Parallel:** [P]
- **Files:** `frontend/src/App.jsx`, `frontend/src/pages/Admin/components/ContentManagement.jsx`, `frontend/src/pages/Admin/components/UserManagement.jsx`, `frontend/src/index.css`
- **Verification command:** `npm run test:a11y` (Tab con la ayuda cerrada nunca llega a "Entendido"; con la ayuda abierta queda adentro; el foco vuelve al disparador)
- **Commit message:** `fix(T25): modales nativos con foco atrapado y devuelto [R30]`
- **Acceptance:** V22.

### T26 [Story P2] — Regiones y errores del sitio
- **Satisfies:** R31, R32
- **Depends on:** T23, T25
- **Parallel:** sequential
- **Files:** `frontend/src/components/A11yBar.jsx`, `frontend/src/pages/Login.jsx`, `frontend/src/components/AudioPlayer.jsx`, `frontend/src/App.jsx`, `frontend/src/pages/Home.jsx`, `frontend/src/pages/Admin/components/ContentManagement.jsx`, `frontend/src/pages/Admin/components/UserManagement.jsx`
- **Verification command:** `npm run test:a11y` (`/genres` forzado a 500 → urgente; login inválido → `aria-invalid`)
- **Commit message:** `fix(T26): regiones validas y errores anunciados en el sitio [R31, R32]`
- **Acceptance:** V23.

### T27 [Story P2] — Foco, objetivos y movimiento en el sitio
- **Satisfies:** R21, R26, R27
- **Depends on:** T21
- **Parallel:** [P]
- **Files:** `frontend/src/index.css`
- **Verification command:** `npm run test:a11y` + MEDIR
- **Commit message:** `feat(T27): foco 4/4, 48 px y movimiento reducido en el sitio [R21, R26, R27]`
- **Acceptance:** V14 (V9, V10, V12) y V19 en el sitio.

## Group E — Historia 9 [P3]: verificable, no declarada

### T28 [Story P3] — Procedimiento repetible
- **Satisfies:** R22
- **Depends on:** T19, T27
- **Parallel:** sequential
- **Files:** `verificacion/a11y/README.md`, `verificacion/a11y/matriz-lectores.md`, `admin-dashboard/tests/test_a11y_navegador.py`
- **Verification command:** `PYTEST -m navegador` y `npm run test:a11y`, **corridos por alguien que no los escribió**
- **Commit message:** `docs(T28): procedimiento de verificacion a11y repetible [R22]`
- **Acceptance:** V15 (informe fechado y con nombre de quien lo corrió); matriz VoiceOver, NVDA y TalkBack con columnas de quién y cuándo.

### T29 [Story P3] — Corrección del marco del vault
- **Satisfies:** R23
- **Depends on:** T28
- **Parallel:** sequential
- **Files:** `BrainVault/01 VibeCode/01 Proyectos Activos/Invision/Invision - Accesibilidad y Discapacidad Visual.md`, `frontend/src/index.css` (comentario del contraste)
- **Verification command:** diff de la nota contra el JSON del último informe
- **Commit message:** `docs(T29): marco de accesibilidad con cifras medidas [R23]`
- **Acceptance:** V16. Se corrigen el naranja (4,54:1), el rojo `#FF3333` (5,77:1) por `#FF7171`, `@axe-core/react` no instalado, el estado medido por app y la fecha.

---

## Coverage check
- R1 → T2, T7 · R2 → T6, T7 · R3 → T7 · R4 → T3, T8 · R5 → T6, T8 · R6 → T8
- R7 → T4 · R8 → T3, T4 · R9 → T4 · R10 → T4 · R11 → T5
- R12 → T15 · R13 → T13 · R14 → T14 · R15 → T2, T6, T16, T24 · R16 → T16 · R17 → T17
- R18 → T3, T18 · R19 → T3, T11, T23 · R20 → T22 · R21 → T21, T23, T27 · R22 → T1, T28 · R23 → T29
- R24 → T1, T12, T19 · R25 → T3, T4 · R26 → T13, T27 · R27 → T13, T27 · R28 → T8, T23
- R29 → T24 · R30 → T25 · R31 → T26 · R32 → T26 · R33 → T20
- R34 → T9 · R35 → T6, T10 · R36 → T10 · R37 → T7 · R38 → T8 · R39 → T2, T3, T10, T17, T19

## Implementation verification log

| Task ID | Status | Verification command | Exit code | Verified by / timestamp |
|---|---|---|---|---|
| T1 | done | MEDIR sobre el panel en 8de28f7 → `informes/2026-09-26-linea-base-panel.json` | 0 | Claude Code, 2026-09-26 |
| T2 | done | `node --test admin-dashboard/tests/js/*.test.js` (10 casos). Nota: el primer "rojo" no valía (node no acepta una carpeta); el comando correcto usa el glob | 0 | Claude Code, 2026-09-26 |
| T3 | done | `PYTEST` — 11 casos vistos en rojo por la razón esperada antes de implementar; sin xfail porque se implementó en la misma sesión | 0 | Claude Code, 2026-09-26 |
| T4–T8 | done | `PYTEST` 68 passed + recorrido 48/48 sin problemas, axe 0 | 0 | Claude Code, 2026-09-26 |
| T9 | done | `NODETEST` 18 casos. Hallazgo en navegador: "Illegal invocation" al detener (temporizador no envuelto); test que imita al navegador, visto en rojo, corregido | 0 | Claude Code, 2026-09-26 |
| T10–T11 | done | Teclas reales en el panel: 1–6, S, H/?, Esc, Espacio, ←→, ↑↓, N/P, M; foco devuelto; ayuda retiene el foco (hallazgo: salía a `<body>`, corregido) | 0 | Claude Code, 2026-09-26 |
| T12 | done | `informes/2026-09-26-panel-p1.json` | 0 | Claude Code, 2026-09-26 |
| T13–T18 | done | Incluidos en el recorrido (foco 4/4 + anillo interior, 48 px, ResizeObserver del reproductor, reducción de movimiento y forced-colors cargados, regiones y pie). Movimiento y colores forzados: reglas verificadas en CSSOM, no emulados | 0 | Claude Code, 2026-09-26 |
| T19 | done | Mismo informe de T12 (4 tamaños, 2 modos, 6 secciones, 1280/640/320 px) | 0 | Claude Code, 2026-09-26 |
| T20–T27 | done | `cd frontend && npm run test:a11y` → 13 passed; lint de archivos tocados limpio; `vite build` ok | 0 | Claude Code, 2026-09-26 |
| T28 | parcial | README y matriz escritos. Falta: que lo corra alguien que no lo escribió, y la prueba con lectores reales (A2). `test_a11y_navegador.py` no se creó: Playwright para Python no está instalado; el recorrido del panel se corre desde la consola (README §1) | — | pendiente persona |
| T29 | done | Nota del vault corregida con las cifras de los informes; comentario de contraste del sitio corregido | 0 | Claude Code, 2026-09-26 |

Hallazgos de la prueba no previstos en el spec (corregidos): JS del panel en caché mezclado con HTML nuevo (`Cache-Control: no-cache`); búsqueda del explorador limitada a los primeros 100 libros de 520 (pasa al servidor); pistas en orden alfabético (1, 10, 2); "Audio listo" ante un archivo inexistente; flechas del sitio bloqueadas sobre botones.
Observación no reproducida: en una pestaña de desarrollo con recarga en caliente se vio un bucle de `GET /audio-by-id` (~3/s); en carga limpia con Playwright no aparece (0 llamadas en 10 s de reproducción).
