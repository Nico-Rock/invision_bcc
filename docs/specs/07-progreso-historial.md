# 07 — Progreso & Historial de Escucha

> Estado: 95% | Producción

---

## 1. Descripción funcional

Sistema de tracking que guarda automáticamente la posición de escucha del usuario (capítulo + porcentaje) y permite reanudar desde el último punto. Incluye endpoint de "mis audiolibros" que lista libros comenzados ordenados por último acceso.

---

## 2. Funciones

### 2.1 Guardado de progreso
- **Qué hace:** Registra capítulo actual y porcentaje de avance dentro del capítulo. Se guarda automáticamente durante la reproducción.
- **Endpoint:** `POST /guardar-progreso`
- **Body:** `{ usuario_id, audiolibro_id, chapter_index, progreso (0-100) }`
- **Modelo:** `ProgresoAudiolibro` (id, usuario_id, audiolibro_id, chapter_index, progreso, ultima_reproduccion)
- **Comportamiento:** Upsert — si existe registro para ese usuario+libro, actualiza. Si no, crea nuevo.
- **Trigger:** Frontend envía progreso periódicamente via `timeupdate` event del Audio element.

### 2.2 Recuperación de progreso
- **Qué hace:** Obtiene último progreso guardado para un usuario+libro. Permite reanudar desde donde quedó.
- **Endpoint:** `GET /obtener-progreso/{usuario_id}/{audiolibro_id}`
- **Respuesta:** `{ chapter_index, progreso, ultima_reproduccion }`
- **Frontend:** Al abrir un libro, consulta progreso y posiciona el player en el capítulo y segundo correspondiente.

### 2.3 Biblioteca personal ("Mis audiolibros")
- **Qué hace:** Lista todos los audiolibros que el usuario ha comenzado a escuchar, ordenados por último acceso (más reciente primero).
- **Endpoint:** `GET /mis-audiolibros/{usuario_id}`
- **Query:** JOIN Audiolibro + ProgresoAudiolibro, filtrado por usuario_id, ORDER BY ultima_reproduccion DESC
- **Respuesta:** Lista con metadata del libro + progreso actual (capítulo, porcentaje, fecha)
- **Frontend:** No tiene componente dedicado en UI actualmente.

### 2.4 Autorización de progreso
- **Qué hace:** Verifica que el usuario solo pueda leer/escribir su propio progreso.
- **Lógica:** `usuario_id` en URL/body debe coincidir con `id` en JWT decodificado.

---

## 3. Estado actual

| Función | Implementada | Tests | Bugs |
|---------|-------------|-------|------|
| Guardar progreso | Si | Si | Guardado silencioso (sin feedback si falla) |
| Recuperar progreso | Si | Si | — |
| Mis audiolibros | Si | Si | Sin UI en frontend |
| Autorización | Si | Si | — |

**Gaps principales:**
- "Mis audiolibros" no tiene componente frontend (endpoint existe pero no se consume)
- Sin indicador de progreso visible en cards del catálogo (no se ve % antes de abrir)
- Sin sincronización cross-device (progreso solo en el servidor que se consultó)
- Sin notificación de "libro completado"
- Sin estadísticas de tiempo escuchado
- Sin streak/racha de escucha
- Sin export de historial
- Progreso no se limpia al completar un libro

---

## 4. Ruta de escalabilidad

### Corto plazo
- Crear componente `MyLibrary.jsx` que consuma `GET /mis-audiolibros/{id}` con cards de libros + barra de progreso visual
- Mostrar indicador de progreso (%) en cards del catálogo para libros ya comenzados
- Agregar feedback visual/sonoro cuando el progreso se guarda exitosamente
- Agregar estado "completado" cuando progreso = 100% del último capítulo

### Mediano plazo
- **Estadísticas de escucha:** Tabla `estadisticas_escucha` (usuario_id, fecha, minutos_escuchados, libros_activos). Endpoint `GET /user/stats` con totales. Dashboard personal: "Has escuchado X horas este mes, Y libros completados".
- **Historial detallado:** Tabla `historial_reproduccion` (usuario_id, audiolibro_id, chapter_index, inicio, fin, duracion_seg). Registra cada sesión de escucha (no solo último punto). Permite analytics por sesión.
- **Notificaciones de hitos:** Al completar un libro, capítulo 50%, racha de 7 días → notificación/badge. Announce por TTS. Gamification ligera que motiva uso.
- **"Continuar escuchando":** Sección destacada en Home con el último libro activo y botón de play directo. Un click para reanudar.

### Largo plazo
- **Sync cross-device:** WebSocket o polling que sincroniza progreso en tiempo real entre dispositivos. Conflicto resolution: gana el timestamp más reciente.
- **Export/portabilidad:** Endpoint `GET /user/export` que genera JSON/CSV con todo el historial del usuario. Cumplimiento de GDPR/derecho a portabilidad de datos.
- **Recomendaciones basadas en historial:** Motor que analiza patrones de escucha (géneros completados, autores preferidos, horarios) y sugiere libros. "Usuarios que escucharon X también escucharon Y".
- **Social features:** Compartir progreso, listas públicas de "favoritos", badges de logros. Evaluación cuidadosa de privacidad para usuarios con discapacidad.

---

## 5. Dependencias

| Dependencia | Tipo | Crítica |
|-------------|------|---------|
| SQLAlchemy ORM | Backend | Si |
| Audio timeupdate event | Frontend | Si |
| AudioContext state | Frontend | Si |
| JWT (usuario_id) | Backend | Si |
