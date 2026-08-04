# 06 — Reproductor de Audio

> Estado: 90% | Producción

---

## 1. Descripción funcional

Reproductor flotante (dock en footer) con controles completos de playback: play/pause, seek ±15s, navegación por capítulos, velocidad de reproducción (0.75x-2x), y volumen. Integrado con sistema de accesibilidad (earcons, TTS, shortcuts de teclado).

---

## 2. Funciones

### 2.1 Controles de playback
- **Qué hace:** Play/pause, skip adelante/atrás 15s, capítulo anterior/siguiente.
- **Frontend:** `AudioPlayer.jsx` — barra flotante en footer
- **Controles:**
  - Play/Pause (toggle)
  - Skip -15s / +15s
  - Capítulo anterior (disabled en capítulo 1)
  - Capítulo siguiente (disabled en último capítulo)
- **Estado:** Gestionado en `AudioContext.jsx` (currentBook, currentChapterIndex, isPlaying, currentTime, duration)

### 2.2 Barra de progreso (seek)
- **Qué hace:** Slider que muestra posición actual y permite seek a cualquier punto del capítulo.
- **Frontend:** Input range (0-100%) en `AudioPlayer.jsx`
- **Lógica:** Cambia `currentTime` del elemento Audio → trigger HTTP range request al nuevo offset.

### 2.3 Control de velocidad
- **Qué hace:** Selector de velocidad de reproducción.
- **Opciones:** 0.75x, 1.0x, 1.25x, 1.5x, 1.75x, 2.0x
- **Frontend:** Dropdown en `AudioPlayer.jsx`
- **Persistencia:** No se persiste (reset a 1.0x al recargar)

### 2.4 Control de volumen
- **Qué hace:** Slider de volumen 0-100%.
- **Frontend:** Input range en `AudioPlayer.jsx`
- **Persistencia:** Se guarda en localStorage (persiste entre sesiones)

### 2.5 Navegación por capítulos
- **Qué hace:** Botones anterior/siguiente que cambian de capítulo. Auto-advance al terminar un capítulo.
- **Lógica:**
  1. Cambiar `currentChapterIndex`
  2. Construir nueva URL de streaming
  3. Cargar nuevo audio
  4. Auto-play si estaba reproduciendo
- **Announce:** TTS anuncia "Capítulo X de Y" al cambiar

### 2.6 Shortcuts de teclado
- **Qué hace:** Atajos globales para control rápido sin mouse.
- **Implementación:** `useKeyboardShortcuts.js` — event listener global en `document`
- **Shortcuts:**
  - `Space` — play/pause
  - `←` / `→` — skip ±15s
  - `S` / `Shift+S` — focus en búsqueda
  - `1` — ir a perfil
  - `2` — ir a catálogo
  - `3` — ir a admin (si admin)
  - `4` / `G` — focus en géneros
  - `?` / `H` — mostrar ayuda de teclado
  - `Esc` — cerrar modal/player

---

## 3. Estado actual

| Función | Implementada | Tests | Bugs |
|---------|-------------|-------|------|
| Play/Pause | Si | No (frontend) | — |
| Skip ±15s | Si | No | — |
| Seek (slider) | Si | No | — |
| Velocidad | Si | No | No persiste entre sesiones |
| Volumen | Si | No | — |
| Navegación capítulos | Si | No | — |
| Shortcuts teclado | Si | No | Conflicto con inputs de texto |
| Auto-advance | Si | No | — |

**Gaps principales:**
- Sin bookmarks/marcadores dentro de un capítulo
- Sin funcionalidad A/B repeat (repetir segmento)
- Sin sleep timer (apagar después de X minutos)
- Sin ecualizador o efectos de audio
- Sin visualización de audio (waveform)
- Velocidad no persiste en localStorage
- Skip solo de 15s fijos (no configurable)
- Sin preview de capítulo (título, duración) antes de navegar
- Shortcuts pueden interferir cuando se está escribiendo en inputs

---

## 4. Ruta de escalabilidad

### Corto plazo
- Persistir velocidad de reproducción en localStorage
- Agregar guard en shortcuts: ignorar cuando focus está en input/textarea
- Mostrar duración y título del capítulo actual en el player
- Hacer skip configurable (5s, 10s, 15s, 30s) con botón de settings

### Mediano plazo
- **Bookmarks:** Tabla `bookmarks` (usuario_id, audiolibro_id, chapter_index, time_seconds, nota). Botón "marcar" en player. Lista de bookmarks accesible. TTS anuncia "Marcador guardado en minuto X".
- **Sleep timer:** Countdown que pausa reproducción después de 15/30/60 min o al final del capítulo. Earcon de aviso 1 minuto antes. Persist en sesión.
- **Mini-player:** Versión compacta del player para navegación (solo play/pause + título). Se expande al hacer click/focus. Reduce espacio visual en móvil.
- **Cola de reproducción:** Lista de audiolibros/capítulos en cola. Drag & drop para reordenar. "Agregar a cola" desde catálogo.

### Largo plazo
- **Transcripción sincronizada:** Mostrar texto del audiolibro sincronizado con audio (tipo karaoke). Requiere archivos de transcripción con timestamps (SRT/VTT). Beneficio enorme para accesibilidad — usuarios pueden leer y escuchar simultáneamente.
- **Modo conducción:** UI simplificada con botones extra grandes y solo controles esenciales. Detección de Bluetooth para auto-activar.
- **Integración con asistentes:** Control via Siri Shortcuts o Google Assistant. "Hey Siri, continúa mi audiolibro en Invision".
- **Player nativo (PWA):** Media Session API para controles en lock screen y notificaciones del OS. Background audio que no se detiene al cambiar de tab.

---

## 5. Dependencias

| Dependencia | Tipo | Crítica |
|-------------|------|---------|
| HTML5 Audio API | Frontend | Si |
| AudioContext (React) | Frontend | Si |
| Web Audio API | Frontend | Si (earcons) |
| Web Speech API | Frontend | No (TTS announcements) |
| localStorage | Frontend | Si (volumen) |
| useKeyboardShortcuts | Frontend | Si |
