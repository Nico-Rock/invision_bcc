# 10 — Accesibilidad

> Estado: 90% | Producción

---

## 1. Descripción funcional

Sistema de accesibilidad integral diseñado para usuarios con discapacidad visual (WCAG 2.1 AA/AAA). Cubre cuatro pilares: soporte para screen readers (ARIA), navegación por teclado completa, feedback auditivo no-visual (earcons), y personalización visual (contraste, tamaño de texto). La accesibilidad no es un add-on — está integrada en cada componente desde el diseño.

---

## 2. Funciones

### 2.1 Screen reader support (ARIA)
- **Qué hace:** ARIA labels, roles semánticos, y live regions para que screen readers (NVDA, JAWS, VoiceOver) interpreten la interfaz correctamente.
- **Implementación:**
  - `aria-label` en todos los botones e inputs
  - `aria-labelledby` / `aria-describedby` para relaciones contextuales
  - `role="tablist"`, `role="tab"`, `role="tabpanel"` en admin
  - `role="button"`, `role="main"`, `role="complementary"` semánticos
  - HTML5 semántico: `<main>`, `<nav>`, `<header>`, `<footer>`
- **Live regions:**
  - `<div id="srAnnouncer" aria-live="assertive">` para anuncios urgentes
  - `aria-live="polite"` para actualizaciones no-urgentes
  - Anuncios: resultados de búsqueda, cambios de página, estado de reproducción, errores

### 2.2 Text-to-Speech (TTS)
- **Qué hace:** Anuncia eventos importantes por voz usando Web Speech Synthesis API.
- **Función:** `announceText(text, assertive=true)` en `AudioContext.jsx`
- **Idioma:** `utterance.lang = 'es-ES'`
- **Eventos anunciados:**
  - Navegación: "Navegando al catálogo"
  - Reproducción: "Reproduciendo capítulo 3 de 10"
  - Búsqueda: "5 resultados encontrados"
  - Errores: "Credenciales incorrectas"
  - Settings: "Contraste alto activado"
- **Fallback:** Si speech synthesis no disponible, solo usa live region de ARIA.

### 2.3 Earcons (audio cues)
- **Qué hace:** Tonos sonoros cortos para feedback no-visual de eventos UI.
- **Implementación:** Web Audio API con osciladores y gain nodes.
- **Tipos de earcon:**

| Cue | Frecuencia | Forma de onda | Duración | Uso |
|-----|-----------|---------------|----------|-----|
| `focus` | 523.25 Hz (C5) | sine | 80ms | Foco en elemento interactivo |
| `success` | 440→880 Hz (A4→A5) | triangle | staggered | Acción exitosa |
| `error` | 180 Hz | sawtooth | 300ms | Error o fallo |
| `action` | 659.25 Hz (E5) | sine | 100ms | Acción ejecutada |
| `voiceStart` | 880 Hz | sine | 150ms | Micrófono activado |

- **Toggle:** ON/OFF via A11yBar, persiste en localStorage
- **Volumen:** 0.08 base con decay exponencial (no intrusivo)

### 2.4 Navegación por teclado
- **Qué hace:** Toda la app es navegable sin mouse. Shortcuts globales para power users.
- **Implementación:** `useKeyboardShortcuts.js` — event listener en `document`
- **Tab order:** Lógico y secuencial en toda la app
- **Focus indicators:** Ring verde neon (#00FF66) de 4px — alta visibilidad
- **Focus trapping:** Modales atrapan el foco (tab no escapa del modal)
- **Focus management:** Modal open → foco al primer input. Modal close → foco al botón que lo abrió.
- **Shortcuts:** Ver detalle en [06-reproductor.md](06-reproductor.md) sección 2.6

### 2.5 Personalización visual
- **Qué hace:** Controles para ajustar experiencia visual según necesidad del usuario.
- **Frontend:** `A11yBar.jsx` — barra en header
- **Controles:**
  - **Tamaño de texto:** Botones A+ / A- (rango 12px-28px, step 2px). CSS variable `--font-scale`.
  - **Contraste alto:** Toggle que aplica clase `high-contrast` al body. Esquema: fondo negro (#000) + texto amarillo (#FFFF00).
  - **Audio cues:** Toggle ON/OFF para earcons.
- **Persistencia:** Todas las preferencias en localStorage.
- **Fuente:** Atkinson Hyperlegible — diseñada específicamente para baja visión.

### 2.6 Búsqueda por voz
- **Qué hace:** Activa micrófono, transcribe voz a texto, ejecuta búsqueda.
- **API:** Web Speech API (`SpeechRecognition`)
- **Config:** `lang = 'es-ES'`, `continuous = false`
- **Feedback:** Earcon `voiceStart` al activar, resultado en input de búsqueda.
- **Detalle completo:** Ver [04-busqueda.md](04-busqueda.md) sección 2.3

---

## 3. Estado actual

| Función | Implementada | Tests | Bugs |
|---------|-------------|-------|------|
| ARIA labels/roles | Si | No | Algunos modales sin aria-modal |
| Live regions | Si | No | — |
| TTS | Si | No | Solo es-ES |
| Earcons | Si | No | Sin volumen independiente |
| Teclado completo | Si | No | Shortcuts activos en inputs de texto |
| Contraste alto | Si | No | Solo 1 variante (negro/amarillo) |
| Texto escalable | Si | No | Puede romper layouts en extremos |
| Búsqueda por voz | Si | No | Soporte variable por navegador |
| Atkinson Hyperlegible | Si | No | — |

**Gaps principales:**
- Sin testing con screen readers reales (NVDA, JAWS, VoiceOver)
- Sin testing de accesibilidad automatizado (axe-core, Lighthouse)
- Anuncios solo en español (sin preferencia de idioma)
- Earcons sin control de volumen independiente del media
- Solo 1 modo de alto contraste (no hay daltonismo, dark mode estándar)
- Sin ajuste de espaciado de líneas
- Sin selección de fuente (solo Atkinson Hyperlegible)
- Sin soporte para dispositivos Braille
- Shortcuts pueden interferir cuando focus está en inputs
- Sin documentación de accesibilidad para usuarios finales

---

## 4. Ruta de escalabilidad

### Corto plazo
- Agregar `aria-modal="true"` a todos los modales
- Guard en shortcuts: no ejecutar cuando `document.activeElement` es input/textarea/select
- Agregar test automatizado con axe-core en CI (plugin para React Testing Library)
- Documentar guía de accesibilidad para usuarios: qué shortcuts existen, cómo activar features

### Mediano plazo
- **Modos de contraste adicionales:**
  - Dark mode estándar (gris oscuro + texto claro)
  - Modo para daltonismo (deuteranopia, protanopia) — paletas optimizadas
  - Modo bajo contraste para fotosensibilidad
  - Selector de modo en A11yBar con dropdown
- **Personalización de earcons:**
  - Volumen independiente (slider separado de media volume)
  - Selección de set de sonidos (tonos, clicks, voz)
  - Preview de cada earcon en settings
- **Testing con screen readers:**
  - Suite de test manual con NVDA (Windows), VoiceOver (Mac/iOS), TalkBack (Android)
  - Checklist por componente: labels correctos, anuncios de cambios, orden de lectura
  - Automated testing con axe-core + cypress-axe en CI
- **Espaciado configurable:** Line-height ajustable (1.2x-2.0x). Word-spacing ajustable. Letter-spacing ajustable. Todo via CSS variables + A11yBar.

### Largo plazo
- **Soporte Braille:** Metadata semántica que los displays Braille puedan interpretar. Navegación optimizada para líneas Braille (40 celdas). Labels abreviados para Braille.
- **Personalización por perfil:** Preferencias de accesibilidad guardadas en el servidor (no solo localStorage). Al loguearse en otro dispositivo, se aplican automáticamente. Tabla `user_a11y_preferences` (font_scale, contrast_mode, earcons_enabled, tts_speed, etc.).
- **Conformidad WCAG 2.2:** Audit completo contra WCAG 2.2 AA y AAA. Documentar compliance con VPAT (Voluntary Product Accessibility Template). Certificación de accesibilidad.
- **Multi-idioma en TTS:** Detectar idioma del contenido del audiolibro. Soporte para español latinoamericano, inglés, portugués. Selector de voz preferida en settings.
- **Modo lectura simplificada:** Versión ultra-simplificada de la UI con solo las acciones esenciales. Para usuarios con discapacidad cognitiva además de visual. Menos opciones, flujo más lineal.

---

## 5. Dependencias

| Dependencia | Tipo | Crítica |
|-------------|------|---------|
| ARIA 1.2 | Estándar | Si |
| Web Speech Synthesis API | Browser | Si (TTS) |
| Web Speech Recognition API | Browser | No (búsqueda por voz, degradación graciosa) |
| Web Audio API | Browser | Si (earcons) |
| Atkinson Hyperlegible | Font | Si |
| CSS Custom Properties | Browser | Si |
| localStorage | Browser | Si (persistencia prefs) |
