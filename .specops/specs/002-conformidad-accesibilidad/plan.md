# Plan — 002-conformidad-accesibilidad

> CÓMO. Cada decisión cita el requisito (R#) o el principio (P#) que la justifica.
> Constitución: `.specops/constitution.md` v1.2.0 (P14: WCAG 2.2 AA + AAA de contraste de texto; P17: la accesibilidad decide sobre la marca).
> Insumos: la auditoría del sitio contra el marco, la revisión de código de T24–T29, la auditoría de seguridad de la rama, el borrador y la adenda del agente Plan (integrados y revisados, no copiados) y las mediciones propias del 2026-09-26. Método de diseño: skills *designing-interfaces* (modo Review, entregable dashboard) y *uiux-design*.

**Status:** constitution-checked  **Author:** Nico (vía Claude Code)  **Date:** 2026-09-26

## Hallazgos que condicionan el plan (verificados)
1. Hay una tercera región viva implícita: `#estado-indice-audio` tiene `role="status"` (`index.html:1076`). Si queda, V4 ("exactamente dos") no se cumple.
2. `pintarEstadoIndice` anuncia "Catálogo de audio al día" cuando termina la indexación de fondo, con Resumen activo al cargar, y pisa la bienvenida (contradice R6).
3. `playAudioTrack` reporta sus errores con `alert()` modal (`index.html:1526` y `:1529`).
4. `--focus-ring-outline` se resuelve en `:root`, así que el override de alto contraste no surte efecto (R27). Además `.btn` y `.search-input` tienen `outline: none` (`:242` y `:440`).
5. Los placeholders usan el gris del navegador y no alcanzan AAA.
6. Sitio: `announceText` es urgente por defecto y además habla (`AudioContext.jsx:125-139`); `adjustTextScale` anuncia dentro del actualizador de estado (se anuncia dos veces en StrictMode); las preferencias salen de `localStorage` sin acotar (un volumen `NaN` o mayor que 1 lanza `IndexSizeError`, CWE-20); `App.css` no se importa (código muerto).

## Arquitectura

| # | Decisión | Justifica |
|---|---|---|
| D1 | Todo color pasa por tokens. Se separan `--brand-orange` (`#D34500`, solo sin texto), `--accent-orange` (texto AAA) y `--accent-orange-fill` (relleno con texto encima). Se agregan `--text-on-accent`, `--bg-card`, `--player-*`, `--barra-*`, `--border-control` y `--focus-ring-inner`. | R7, R8, R10, R25, P17 |
| D2 | El hover de relleno es el mismo tono, más oscuro (`#6B2300`). El blanco encima sigue por arriba de 8:1 porque el fondo es aún más oscuro. | R7, R8 |
| D3 | Las etiquetas de estado llevan fondo del color de página, texto y borde del color de estado, y un ícono con texto alternativo vacío: el color nunca es la única señal. | R7, R11 |
| D4 | El tamaño de texto se guarda como **factor** del tamaño del navegador: `html { font-size: calc(100% * var(--font-factor)) }`, con factor de 0,75 a 2 (200 %). Las preferencias guardadas se acotan y se redondean al paso. | R1, R21, R39 |
| D5 | Con texto grande, la barra de accesibilidad pone la clase `texto-amplio` en `<html>`, que reutiliza las reglas de pantalla angosta (una columna, barra lateral no fija). Además hay `flex-wrap` en el encabezado, sus acciones y el reproductor; grillas `minmax(min(100%, Xrem), 1fr)`; y nada de `nowrap` ni `line-clamp` en texto esencial. Los media queries no reaccionan a A+, por eso hace falta la clase. | R2, R3 |
| D6 | Dos regiones fijas: `#a11y-cortes` (`polite`, cada aviso es un `<p>` que se agrega, con tope de 5; así los avisos se suceden sin cortarse) y `#a11y-urgente` (`assertive`, se reemplaza el contenido). Un urgente vacía la cortés. Se quita el `role="status"` de `#estado-indice-audio`. | R4, R5, R38 |
| D7 | Preferencia `voz` ("Lectura en voz", persistida). La síntesis de voz del panel habla solo si está encendida, encolando los avisos corteses y cancelando ante los urgentes. **Valor por defecto: decisión A3 de la reunión**; queda como constante única y provisoriamente encendida en el primer uso, con aviso de cómo apagarla. Las regiones vivas funcionan siempre. | R28 |
| D8 | Una sola regla global de foco: `:focus-visible { outline: 4px solid var(--focus-ring); outline-offset: 4px; box-shadow: 0 0 0 4px var(--focus-ring-inner) }`. El anillo oscuro interior (`#111827` en modo estándar, `#000` en alto contraste) garantiza 3:1 contra cualquier fondo, y el verde `#00FF66` se conserva en los dos modos. Se eliminan `--focus-ring-outline`, el override de alto contraste y todos los `outline: none`. | R13, R26, R27 |
| D9 | Foco no tapado: un `ResizeObserver` sobre la barra del reproductor escribe `--alto-reproductor`, que usan `scroll-padding-bottom` y `padding-bottom`. | R14 |
| D10 | La lógica pura (límites de texto y volumen, pista vecina, textos de atajos y secciones) va en `static/a11y-logica.js` (JS sin framework, funciona en el navegador y en Node) y se prueba con `node --test` (Node 22 ya instalado, sin dependencias). Un wrapper de pytest lo incluye en el comando del panel. Es **la fuente única** de textos de atajos (R39). | P1, P3, P5, R39 |
| D11 | Test estático en pytest con `html.parser`. Comprueba: exactamente 2 regiones vivas; ningún color de texto literal fuera de los bloques de tokens; `#D34500` solo en `--brand-orange`; `nav` con nombre; `footer` presente; texto visible contenido en el nombre accesible; `aria-keyshortcuts` válidos. | V4, V13, V18, V30 |
| D12 | Herramienta de medición `verificacion/a11y/medir.js`, script de navegador sin dependencias, con axe fijado localmente (copia versionada con SRI, sin CDN abierto: CWE-829). Mide: barrido de contraste componiendo fondos con alfa (incluido el faro), objetivos, reflow, conteo de regiones vivas, movimiento reducido y paso de foco. Tiene dos corredores, cada uno en el idioma de su app: **panel** con pytest y Playwright para Python (marca `navegador`, se saltea con motivo si no está instalado); **sitio** con `@playwright/test` + `@axe-core/playwright` como dependencias de desarrollo (`npm run test:a11y`), sin tocar el `vite build`. Se descarta jsdom porque no calcula layout ni contraste. | R22, R33, P1 |
| D13 | El explorador se reescribe con `createElement` (sin `innerHTML`, que además cierra el XSS de ese sumidero; `loadUsers` va por el T30 de 001). `playAudioTrack(libro, indice)` guarda `reproduccion = { libro, indice, disparador }`, que habilita N/P y la devolución del foco. Los `alert()` pasan al canal urgente. | R15, R35, R5, P8 |
| D14 | Atajos: una tabla única en `a11y-logica.js` alimenta el manejador, la ventana de ayuda, los anuncios y los `aria-keyshortcuts`. Guardas: nunca con modificadores, mientras se escribe (**incluido Esc**), con el foco en `AUDIO`/`VIDEO`, en una región desplazable enfocable ni dentro de un `dialog`. Se ignoran las repeticiones (`e.repeat`). Después de un atajo que oculta el elemento enfocado, el foco va a `#contenido-principal` o al disparador guardado. | R15, R16, R35, R36 |
| D15 | Dictado: el panel no habla mientras el micrófono escucha (el aviso se emite antes, se espera el `onend` de la voz si está encendida y recién entonces empieza la escucha; la señal durante la escucha es el sonido de dictado y el nombre del botón). La instancia se guarda a nivel de módulo: un segundo clic llama a `abort()`, con un temporizador de resguardo porque Safari puede no disparar `onend` después de `abort()`. `A11yLogica.mensajeDictado(codigo)` da mensajes distintos para `not-allowed`/`service-not-allowed` (urgente, menciona el permiso del micrófono), `no-speech` (urgente) y `aborted` (cortés). | R34 |
| D16 | `a11y-logica.js` se carga en `<head>` antes del `<style>`, y `A11yLogica.aplicarTemprano(document.documentElement)` pone clase y factor en `<html>` antes del primer pintado. `A11y.cargar()` usa **la misma** función de validación (acota, redondea al paso y acepta solo números y booleanos; ante cualquier falla deja los valores por defecto sin lanzar error). Todos los selectores `body.high-contrast` pasan a `.high-contrast`. Si `guardar()` falla, se avisa una sola vez que las preferencias valen solo para esta sesión. | R37, R39 |
| D17 | Regiones: la barra de accesibilidad pasa a `<section aria-label>` en las dos apps (deja de anular el encabezado); `nav aria-label="Secciones del panel"`; `<footer>` siempre presente con versión y mandato de gobernanza; íconos y emojis con `aria-hidden`. En los botones de la barra, el nombre accesible es el texto visible (sin `aria-label`). Los interruptores siguen el patrón ARIA de botón de alternar: **texto fijo** ("Alto Contraste", "Señales de Audio", "Lectura en voz") con `aria-pressed` y un ✓ visible oculto al lector cuando están activos. | R18, R19, R31, R39 |
| D18 | Sitio: la barra lateral carga `/genres` y muestra `NavLink` con `?genero=`; `Home` lee `useSearchParams`; se borran las 2 categorías fijas, el `role="menu"` y el bloque `sr-only`. Los modales pasan a `<dialog>` con `showModal()`, y su `onClose` es la única fuente de verdad del estado. `chapters` sube al contexto para N/P. | R20, R29, R30, P2 |
| D19 | Movimiento reducido: una media query global que anula animaciones y transiciones, más `transform: none` en los hovers. El faro se oculta también con `@media (forced-colors: active)`. | R17, R39 |

## Tokens (panel `index.html:11-58`; sitio `index.css:1-45`, mismos nombres)

| Token | Estándar (antes → después) | Alto contraste (antes → después) |
|---|---|---|
| `--bg-primary` | `#FFFFFF` = | `#000000` = |
| `--bg-surface` | `#FAF6F2` = | `#000000` → `#121212` |
| `--bg-surface-hover` | `#F3EDE6` = | `#111111` → `#1F1F1F` (se confirma con el barrido) |
| `--bg-card` (nuevo) | `#FFFFFF` | `#121212` + borde |
| `--brand-orange` (nuevo, solo sin texto) | `#D34500` | `#FFE600` |
| `--accent-orange` (texto) | `#D34500` → `#8F2F00` | `#FFFF00` → `#FFE600` |
| `--accent-orange-fill` (nuevo) | `#8F2F00` | `#FFE600` |
| `--accent-orange-hover` | `#B03A00` → `#6B2300` | `#FFFFFF` = |
| `--text-on-accent` (nuevo) | `#FFFFFF` | `#000000` |
| `--accent-blue` / `--status-info` | `#0A58CA` → `#084AAB` | `#00FFFF` = |
| `--status-ok` (antes `--accent-emerald`) | `#047857` → `#035B42` | `#00FF66` = |
| `--status-warn` (antes `--accent-amber`) | `#D97706` → `#784203` | `#FFFF00` → `#FFE600` |
| `--status-error` (antes `--accent-rose`) | `#DC2626` → `#9C1919` | (no existía) → `#FF7171` |
| `--text-primary` | `#111827` = | `#FFFFFF` = |
| `--text-secondary` | `#4B5563` → `#47505E` | `#FFFF00` → `#E0E0E0` |
| `--text-muted` | `#5F6673` → `#4A4F59` | `#FFFFFF` → `#E0E0E0` |
| `--border` (decorativo) | `#E5E7EB` = | `#FFFFFF` = |
| `--border-control` (nuevo, 1.4.11) | `#4A4F59` | `#FFFFFF` |
| `--focus-ring` | `#00FF66` = | se elimina el override: `#00FF66` |
| `--focus-ring-inner` (nuevo) | `#111827` | `#000000` |
| `--focus-ring-outline` | se elimina (causa de R27) | se elimina |

Medición de referencia (2026-09-26): cada texto AAA da ≥ 7,0:1 sobre `#FFFFFF`, `#FAF6F2` y `#F3EDE6`; el blanco sobre cada relleno da ≥ 8,1:1; `#FF7171` da 7,85:1 sobre `#000` y 7,01:1 sobre `#121212`; `#FFE600` sobre `#000` da 16,6:1.

## Contratos
- `A11y.anunciar(texto, { urgente = false } = {})`. Si es urgente, vacía la cortés, escribe en la urgente y, con voz encendida, cancela y habla. Si no, agrega un `<p>` a la cortés y, con voz encendida, encola. `anunciarEstado` de `carga.js` reenvía las opciones. Hay un `A11y.alternarVoz()` nuevo.
- En el sitio, `announceText(text, { urgente })` sigue el mismo contrato, con cortés por defecto.
- Clasificación: cada llamada existente se etiqueta en la tarea que la toca. **Solo errores, fallas de validación y bloqueos van por el canal urgente.** Ejemplos: `carga.js` validación, error del servidor, pista fallida y carga interrumpida → urgente; progreso y pasos → cortés. En el reproductor, `alert()` → urgente. Índice `listo` → sin aviso, salvo refresco pedido por el usuario. Índice `error` → urgente solo si Resumen o Explorador están a la vista.
- Atajos nuevos (con reproductor abierto): **↑/↓** volumen ±10 % anunciado (en el límite dice "Volumen al máximo, 100 %"); **N/P** "Pista 2 de 12: nombre" (en los extremos dice "No hay pista siguiente"); **M** "Silenciado" o "Sonido restaurado, volumen 60 %".
- Marcado: `<section class="a11y-header" aria-label="Ajustes de accesibilidad visual y auditiva">`; `<nav aria-label="Secciones del panel">`; `<footer class="pie-panel">` con versión y mandato de gobernanza.

## Dependencias
- Node 22 (existe) para `node --test`. Playwright para Python como dependencia de desarrollo del panel (opcional: el test se saltea con motivo si falta). `@playwright/test` y `@axe-core/playwright` como devDependencies del sitio, con versiones fijadas. Una copia versionada de `axe-core` (MPL-2.0) en `verificacion/a11y/vendor/`.

## Mitigación de riesgos y compuerta de seguridad (CWE)
- **CWE-79:** el explorador se construye con nodos (D13). `loadUsers` va por T30 de 001. No se introduce ningún `innerHTML` nuevo.
- **CWE-20:** las preferencias de `localStorage` se validan por tipo y se acotan en las dos apps (D4).
- **CWE-829:** axe se carga de una copia local fijada, nunca de un CDN sin SRI (D12).
- **CWE-209:** los errores anunciados son legibles y no llevan detalle interno; el detalle va a la consola (se alinea con R45 de 001).
- **Rendimiento:** el `ResizeObserver` y la cola de avisos con tope de 5 son de costo despreciable.

## Chequeo de constitución (Constitution check)
- **P1:** cumple. Panel en JS sin framework y Python; sitio en React; sin frameworks ni pasos de build nuevos. Las herramientas de prueba son solo de desarrollo.
- **P2:** cumple. Los géneros salen de la API (D18).
- **P3, P5:** cumple. Lógica pura con `node --test`, estructura con pytest, y medición en el navegador con informe fechado.
- **P4:** cumple. El barrido de contraste y el test estático incluyen casos "envenenados" (texto con `<b>` y `'` en títulos).
- **P6, P9:** cumple. Las credenciales demo del arnés del sitio salen de `.env`, que no se versiona. Sin dominios reservados.
- **P8:** cumple. Ver CWE.
- **P12:** cumple. Nada se despliega; los cambios son locales y van por PR.
- **P14:** cumple. Es el objeto del spec.
- **P16:** cumple. Los defectos de 001 se corrigen desde requisitos (Historia 10), no con parches sueltos.
- **P17:** cumple. `#D34500` queda solo en elementos sin texto (D1) y cada decisión de la tabla cita el requisito accesible que la motiva.

## Riesgos y preguntas abiertas
- **Voz por defecto (A3):** es una decisión del board. El código la deja como una constante única.
- **Flechas ↑↓ y el scroll de página:** se mitiga con las guardas de D14. Si en la prueba con lectores de pantalla resulta molesto, se limita al foco dentro del reproductor.
- **Verde repetido en alto contraste:** `--status-ok` es igual al anillo de foco; se distinguen por forma. Si la prueba con usuarios lo marca, el estado correcto pasa a `#00FFFF`.
- **Umbral de `texto-amplio`:** 24 px es una estimación; la medición de 16 a 32 px a 1280 px lo ajusta.
- **Playwright:** hay que fijar versiones para que coincida el Chromium en caché. Los casos con login necesitan la API local; si falta, se saltean con motivo explícito, nunca en silencio.
- **Plazo:** para el 29/09 alcanzan el grupo A y la Historia 10 del panel (hasta el punto de control P1).
