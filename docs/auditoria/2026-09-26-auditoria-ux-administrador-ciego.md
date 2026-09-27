# Auditoría de uso: la administración de Invision operada por una persona ciega

**Fecha:** 2026-09-26 · **Método:** skill *designing-interfaces*, modo Review. Código de cada pantalla, más recorrido en el navegador con sesión de administrador: árbol de accesibilidad, axe WCAG 2.2 AA, teclado real y conteo de pasos. · **Base auditada:** rama `feat/aniversario-biblioteca-actualizada` (`e173fec`), API y sitio locales con el catálogo real copiado.

## A quién tiene que servirle

En el mundo de Invision, **quien administra es una persona ciega total**. Registra y mantiene el contenido para socios con discapacidades visuales de todo tipo: ceguera total, baja visión, visión en túnel, personas mayores que no usan lector de pantalla. Trabaja con lector de pantalla (NVDA, JAWS o VoiceOver) y teclado, nunca con mouse, y no puede "echar un vistazo" a la pantalla.

Eso cambia las preguntas de la revisión:

| Pregunta de la skill | Cómo se traduce para un administrador ciego |
|---|---|
| ¿Qué es lo más importante de la pantalla? | ¿Qué escucha primero y qué tarea puede completar sin ayuda? |
| ¿Cómo se relacionan los elementos? | ¿Los títulos y regiones permiten saltar directo a lo que busca? |
| ¿Qué hace cada elemento? | ¿Cada control dice qué hace y sobre qué objeto? |
| ¿Qué pasa cuando el contenido cambia? | 538 fichas hoy, más de 1.200 cuando se carguen los ~700 restantes |
| ¿Aguanta pantallas angostas? | ¿Aguanta texto al 200 % y un lector que lee todo en orden? |
| ¿Es accesible? | Y además: **¿lo que escucha es verdad?** Sin vista, lo que anuncia el sistema es su única evidencia |

## Diagnóstico

El sitio para socios quedó sólido con el spec 002: axe en 0, contraste AAA, atajos y ayuda funcionando. **La consola de administración no pasó por ese trabajo**, y es la parte que usa quien más depende del lector de pantalla.

El problema de fondo no es visual: es de **confianza y de flujo**.
- Hay pantallas que anuncian éxitos que no ocurrieron.
- Las tareas principales (dar de alta un libro con su audio y su narrador) no se pueden completar desde el sitio.
- Las listas grandes obligan a recorrer cientos de controles uno por uno.

## Hallazgos

Cada hallazgo indica: qué se observó → qué principio viola → cuál es la corrección.

### Crítico — bloquean el trabajo o destruyen datos

**C1. La "Ingesta Masiva" escribe audio falso en el almacenamiento real.** `sharepoint.py`, en `ingest_audiobook_files`, es un simulacro: por cada fila con enlace sube `Capitulo 1.mp3` con el contenido `dummy mp3 content` y `overwrite=True`. Si la planilla trae un título que ya existe, **el capítulo 1 real queda reemplazado por 17 bytes**.
- **Viola:** integridad del contenido (P12, "nunca pisar una pista").
- **Corrección:** desactivar ya la pestaña y la ruta `/admin/importar-lote` hasta tener la transferencia real. Hasta entonces, la carga de los ~700 libros sigue por el pipeline verificado.

**C2. El progreso de la ingesta es inventado.** `ExcelImporter.jsx`, en `startProgressSimulation`, anuncia cada 2 segundos "Transferido: [título]. Progreso al N por ciento" y al final "Ingesta masiva finalizada con éxito. Todos los archivos transferidos", **sin consultar al servidor**. El servidor tampoco ofrece forma de hacerlo: responde "iniciada en segundo plano" y nunca informa el resultado.
- **Viola:** "lo que escucha es verdad". Para una persona ciega es la única evidencia.
- **Corrección:** tareas con estado real, consultable (encolada, en curso, terminada, fallida por libro), y anuncios solo de lo que el servidor confirma.

**C3. Desde el sitio no se puede agregar audio a un libro.** La pestaña "Libros" crea y edita fichas, pero no tiene forma de subir capítulos. La ruta existe en la API (`presign-upload`) y no tiene pantalla. El único camino es el panel operativo, en otra computadora.
- **Resultado:** fichas sin audio que los socios ven y no pueden escuchar. Medido: **538 fichas, 481 escuchables, 57 vacías**.
- **Viola:** la tarea principal tiene que poder completarse de punta a punta.
- **Corrección:** alta de libro guiada en un solo flujo (ver O1).

**C4. No existe el campo narrador.** Ni en el alta, ni en la edición, ni en la planilla. Es el dato de la iniciativa "En Memoria" y lo que distingue "Cumbres borrascosas versión 1" de la "versión 2".
- **Viola:** el modelo de datos no representa el contenido real.
- **Corrección:** narrador como dato propio, con autocompletado de narradores existentes. Ya está como decisión D6 del PRD.

**C5. Los errores de la administración ya no interrumpen, y esto lo introduje yo.** En el spec 002 cambié el valor por defecto de `announceText` a "cortés". Las pantallas del administrador que no toqué (importador, libros, usuarios) mandan sus errores sin la marca de urgente, como "El título del audiolibro es obligatorio" o "Error al eliminar el usuario". Ahora esperan a que el lector termine, y pueden quedar detrás de otros avisos.
- **Viola:** solo los errores interrumpen, y siempre.
- **Corrección:** marcar como urgentes todos los errores de las cuatro pestañas y agregar al arnés un caso por pestaña.

### Alto — frustración o confusión evidente

**A1. El administrador se ve "Sin Rol".** `/users/` no devuelve los roles y la tabla muestra "Sin Rol" para todas las cuentas, incluida la del administrador. No hay forma de saber, escuchando, quién tiene permisos.
- **Corrección:** que la API devuelva los roles y que la tabla los diga en texto.

**A2. Una tabla de 538 filas con 1.077 botones.** Cada fila tiene "Editar" y "Eliminar". Llegar con Tab al libro 300 son unas 600 pulsaciones. El buscador filtra, pero no dice cuántos resultados encontró ni hay filtros por estado.
- **Viola:** densidad pensada para la vista.
- **Corrección:** un solo control por fila ("Gestionar [título]") que abre la ficha; conteo anunciado al filtrar; filtros "sin audio", "sin narrador" y "por género"; título de sección con el total ("Libros, 538").

**A3. "Eliminar" está al lado de "Editar", sin red de seguridad.** Se confirma con `window.confirm` y el borrado es definitivo. Con el foco saltando de a dos botones por fila, un Enter de más borra un libro.
- **Corrección:** papelera de 30 días. El diálogo de confirmación explica las consecuencias ("dejará de verse para los socios; el audio no se borra") y arranca con el foco en "Cancelar".

**A4. Los formularios de Libros no retienen el foco.** Medido: después de 12 Tab dentro de "Registrar Audiolibro", el foco salió a "Alto Contraste", fuera del formulario. Son `div role="dialog"`, no `<dialog>`; en el spec 002 solo se convirtieron los de Usuarios.
- **Corrección:** usar el componente `Dialogo` que ya existe.

**A5. La pestaña que se abre primero es la más peligrosa.** El administrador aterriza en "Ingesta Masiva" (C1, C2).
- **Viola:** lo primero que se escucha tiene que ser lo más útil.
- **Corrección:** abrir en un "Inicio" con los pendientes (ver O2).

**A6. La auditoría habla en números.** Dice "Usuario ID: 5, inicio de sesión", sin nombre ni correo. Además usa `role="log"`, una tercera región viva que rompe la regla de dos del spec 002. Cada fila es enfocable sin ser un control.
- **Corrección:** tabla con encabezados (persona, correo, evento, fecha), sin región viva y con filtros por persona y fecha.

**A7. Géneros, autores y clasificaciones son texto libre.** Así nacieron las 17 variantes de géneros y el "AMPUERO" cargado como autor, que en realidad parece ser el narrador. Una persona ciega no detecta a simple vista un "CUENTO" junto a "CUENTOS".
- **Corrección:** listas con autocompletado de los valores existentes y aviso de parecidos ("ya existe CUENTOS, ¿es el mismo?").

**A8. El importador adivina las columnas en silencio.** `mapHeadersToKeys` asigna columnas por palabras sueltas: una columna "Nombre del narrador" se toma como título. Sin columna de título, todas las filas pasan a "Audiolibro sin título" y se fusionan en una sola ficha. La vista previa es una tabla con todas las filas y ningún resumen de problemas.
- **Corrección:** antes de importar, anunciar qué columna se tomó para qué campo, más un resumen de validación hablado ("700 filas: 690 listas, 6 sin autor, 4 ya existen") y una lista navegable de problemas por fila. Recién entonces se pide confirmación.

**A9. El botón Eliminar no se lee bien con baja visión.** Blanco sobre `#EF4444` da **3,76:1** (axe: 538 fallas), que no llega ni a AA. El administrador puede tener resto visual.
- **Corrección:** tokens AAA del spec 002.

### Medio — mejoras notables

- **M1. Estructura de títulos.** En `/admin`, los títulos "Menú" y "Géneros" (barra lateral de socios) se leen antes del título principal, y Libros y Usuarios no tienen título de sección. **Corrección:** una barra lateral propia del administrador y un título por pestaña.
- **M2. Anuncios duplicados.** Al cambiar de pestaña se anuncia "Mostrando pestaña de Gestión de Contenido" y al montar "Sección de Gestión de Contenido cargada", además de lo que dice el lector ("Libros, pestaña, seleccionada"). El nombre anunciado no coincide con el visible. **Corrección:** un solo anuncio, con el nombre visible.
- **M3. Pestañas sin Inicio ni Fin.** Las flechas funcionan, pero faltan Inicio y Fin del patrón ARIA.
- **M4. La zona para arrastrar la planilla.** Es un `div role="button"` con un nombre distinto del texto visible y un campo de archivo oculto. Arrastrar no aplica a quien no ve. **Corrección:** un `<input type="file">` visible y con etiqueta.
- **M5. Contraseñas al dar de alta a un socio.** El administrador las escribe a ciegas, sin "mostrar contraseña" ni forma accesible de entregarla. **Corrección:** mostrar u ocultar, generar una contraseña leíble y, más adelante, invitación por correo.
- **M6. El progreso inventado inunda al lector.** Además de ser falso (C2), llega cada 2 segundos por una región `assertive` propia. **Corrección:** progreso cortés por hitos (cada 10 % o por libro) y consultable a pedido.

### Lo que está bien

- **B1.** El **patrón de pestañas** del administrador es correcto: `tablist`, foco itinerante con flechas y `aria-controls`.
- **B2.** Los **nombres de las acciones por fila** incluyen el objeto ("Eliminar audiolibro AFRODITA"), así que el lector sabe qué va a borrar.
- **B3.** Los **formularios tienen etiquetas** visibles y asociadas, y el título es obligatorio.
- **B4.** El **cambio de contraseña de otro usuario** manda el `user_id` y la API verifica el rol: está bien resuelto.
- **B5.** La **carga guiada del panel operativo** (`carga.js`) ya es el modelo a seguir: paso a paso, orden de reproducción visible, reintento por pista, reanudación sin duplicar y foco explícito en cada paso. Hay que llevarla al sitio (spec 004), no reinventarla.

## Oportunidades: qué agregar para una administración sin ver

**O1. Alta de libro de punta a punta, en un solo flujo guiado.** Datos → narrador → audio (carga guiada de B5) → verificación escuchando las primeras pistas → publicar. Cada paso anuncia dónde está y qué falta. Reemplaza el alta actual (C3, C4).

**O2. Un "Inicio" que dice qué necesita atención.** Al entrar se escucha, por ejemplo: "Hay 57 fichas sin audio, 12 sin narrador, 4 géneros parecidos entre sí y 1 carga con errores". Cada punto es un enlace a la lista filtrada. Es la respuesta a "¿qué es lo más importante?" para quien no puede recorrer la pantalla con la vista.

**O3. Estado de publicación visible y controlado.** Borrador, sin audio, listo o publicado. Los socios solo ven lo publicado; hoy ven 57 fichas que no pueden escuchar. Ya está como decisión D6 del PRD.

**O4. "En Memoria" como parte del flujo.** Narrador con autocompletado, datos de la grabación (fecha, lugar si se conoce) y marca "En Memoria". Búsqueda "libros narrados por…" para socios y administración.

**O5. El sistema verifica el audio, porque la persona no puede mirar una forma de onda.** Duración de cada pista, detección de archivos vacíos, silencios largos o corruptos, y resumen hablado ("12 pistas, 7 horas 40 minutos, sin problemas").

**O6. Vocabulario controlado con fusión.** Géneros, autores y clasificaciones con autocompletado, aviso de parecidos y herramienta de fusión ("unir CUENTO en CUENTOS: 14 fichas"), con vista previa hablada antes de aplicar (A7).

**O7. Tareas largas con estado real y aviso al terminar.** Una sección "Tareas" consultable en cualquier momento, con estado por libro. Aviso cortés y señal sonora cuando termina, y urgente si falla. Reemplaza el progreso simulado (C2, M6).

**O8. Importador que valida y explica antes de actuar** (A8). Mapeo de columnas anunciado y editable, resumen de problemas, lista navegable de errores por fila, confirmación con el total, informe final descargable y accesible. Aceptar también CSV.

**O9. Papelera y deshacer** (A3). Eliminar pasa a "mover a la papelera" durante 30 días. Cada edición guarda su valor anterior y se puede deshacer desde el historial.

**O10. Perfil de accesibilidad del socio, cargado por el administrador.** Al dar de alta a un socio se elige su perfil: usa lector de pantalla, baja visión, ceguera parcial o persona mayor sin lector. Con eso, el primer ingreso ya llega adaptado: voz propia apagada para quien usa lector, alto contraste y texto grande para baja visión, voz encendida para personas mayores. **Resuelve la decisión A3 persona por persona**, en lugar de un único valor para todos.

**O11. Auditoría útil.** Quién, qué y cuándo en lenguaje claro, tanto para accesos como para cambios de contenido (quién editó o subió qué), con filtros. Se conecta con el registro de operaciones del spec 004.

**O12. Informe del día para la BCC.** "Hoy se publicaron 8 libros, se subieron 96 pistas y quedaron 3 pendientes", en una página accesible e imprimible.

### Del lado de los socios (para quienes trabaja el administrador)

**S1. Seguir escuchando donde quedé.** La API ya guarda el progreso (`/guardar-progreso`, `/obtener-progreso`), pero **el sitio nunca lo usa**. Una persona ciega que cierra el navegador a mitad de un libro de 20 capítulos tiene que buscar el capítulo a mano. Hay que agregar "Continuar escuchando" al entrar y retomar en el segundo exacto.

**S2. Tarjetas con lo que importa para elegir.** Narrador, duración total y cantidad de capítulos, leídos en ese orden.

**S3. Ocultar las fichas sin audio** hasta que estén publicadas (O3).

## Qué mandar a desarrollar y documentar

| # | Qué | Dónde queda | Prioridad |
|---|---|---|---|
| 1 | Desactivar la ingesta simulada (C1) y su progreso inventado (C2) | Arreglo urgente por PR aparte, junto a T1 del spec 004 | **Ya** |
| 2 | Errores urgentes en las cuatro pestañas (C5), contraste (A9), diálogos (A4), `role="log"` (A6), roles visibles (A1), títulos y anuncios (M1, M2) | Cierre del spec 002 para la zona de administración, con arnés que cubra `/admin` | Alta |
| 3 | Alta guiada con narrador y audio (O1, C3, C4), estado de publicación (O3), "En Memoria" (O4), verificación de audio (O5), Inicio con pendientes (O2), tabla eficiente (A2) | **Spec 005 nuevo: "Administración sin ver"** | Alta |
| 4 | Vocabulario controlado y fusión (O6, A7), importador que valida (O8, A8), tareas con estado real (O7), papelera (O9, A3), auditoría útil (O11) | Spec 005 | Media |
| 5 | Perfil de accesibilidad del socio (O10) | Spec 005, y reemplaza la decisión A3 del PRD | Media |
| 6 | Seguir escuchando (S1), tarjetas completas (S2), ocultar fichas sin audio (S3) | Spec 006: experiencia de escucha del socio | Media |
| 7 | Renombrar `InvisionAPI-main` y los nombres de imagen y contenedor Docker para que digan Invision | Tarea de mantenimiento; revisar si afecta el despliegue en Azure antes de tocarlo | Baja |
| 8 | Informe del día (O12) | Spec 005, fase posterior | Baja |

La consola única (spec 004) y el catálogo de atajos (spec 003) siguen vigentes: el spec 005 se construye sobre ellos. Las pantallas nuevas nacen dentro de la consola y usan el catálogo.

## Estado al 2026-09-26 (spec 005, grupo A)

| Hallazgo | Estado | Cómo |
|---|---|---|
| C1 ingesta que pisaba audio | ✅ Reparado | Ruta en 503, sin escritura; el simulacro ya no sube nada |
| C2 progreso inventado | ✅ Reparado | Eliminado; la pantalla explica y lleva a Libros |
| C3 sin subida de audio | ✅ Reparado | Capítulos desde la ficha, con la subida segura |
| C4 sin narrador | ✅ Reparado en local | Tabla aparte; producción espera la aprobación `aprobaciones/2026-09-29_narrador_en_memoria.md` |
| C5 errores sin urgencia | ✅ Reparado | Canal urgente y campos marcados en toda la consola |
| A1 "Sin Rol" | ✅ Reparado | La API devuelve roles y la tabla los dice |
| A2 1.077 botones | ✅ Reparado | Un "Gestionar" por fila, total y conteo anunciado |
| A3 borrado sin red | 🟡 Mitigado | Confirmación con consecuencias y foco en "Cancelar"; la papelera es R23 (grupo B) |
| A4 foco que escapa | ✅ Reparado | Todas las fichas con `<dialog>` |
| A5 abre en la ingesta | ✅ Reparado | Abre en Libros; el Inicio con pendientes es R18 (grupo B) |
| A6 auditoría en números | ✅ Reparado | Tabla con persona y correo, sin región viva |
| A7 texto libre | 🟡 Mitigado | Sugerencias y "¿Es el mismo?"; la fusión de duplicados es R24 (grupo B) |
| A8 importador que adivina | 🟡 Retirado | El importador se quitó con la ingesta; el nuevo es R22 (grupo B) |
| A9 contraste de Eliminar | ✅ Reparado | Tokens AAA; axe en 0 en las 4 pestañas y los 2 modos |
| M1–M6 | ✅ Reparados | Estructura, un aviso, Inicio/Fin, archivo visible, contraseñas, sin progreso falso |
| Presign inseguro (spec 004, E1) | ✅ Reparado | Nombre validado y permiso de solo creación |

### Grupos B y C (implementados el mismo día)

| Mejora | Estado |
|---|---|
| O2 Inicio con pendientes | ✅ Primera pestaña; resumen hablado y acceso a cada lista filtrada |
| O3 Estado de publicación | ✅ Fichas nuevas en borrador; publicar exige audio; los socios solo ven lo publicado |
| O5 Verificación de audio | ✅ Duración y archivos vacíos, dañados o cortados. 🟡 Silencios largos: pendiente de aprobar ffmpeg |
| O6 Fusión de valores | ✅ Desde el Inicio, con vista previa hablada y deshacer por historial |
| O7 Tareas con estado real | ✅ Consultables y con aviso al terminar desde cualquier pestaña |
| O8 Importador que valida | ✅ CSV: mapeo explícito, problemas por fila, confirmación; fichas en borrador. 🟡 Audio desde SharePoint: sigue fuera |
| O9 Papelera y deshacer | ✅ 30 días, restaurar, eliminar definitivamente con confirmación; historial con deshacer |
| O10 Perfil del socio | ✅ Lo elige la administración y se aplica en el primer ingreso de cada dispositivo |
| O11 Auditoría útil | ✅ Cambios de contenido y accesos, con filtro |
| O12 Informe del día | ✅ En el Inicio, imprimible |

Todo funciona en la base local de la demo. En producción necesita el DDL de `aprobaciones/2026-09-29_tablas_administracion.md` y el despliegue de la API nueva, ambos con aprobación de la BCC.
