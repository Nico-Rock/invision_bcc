# Spec — 005-administracion-sin-ver

> QUÉ y POR QUÉ. Sin tecnología: eso va en el plan.
> Constitución: `.specops/constitution.md` v1.2.0 (P8 seguridad, P10 nunca un falso éxito, P12 nada en producción sin aprobación BCC, P13 el esquema de producción manda, P14 WCAG 2.2, P17 la accesibilidad decide).
> Origen: [auditoría del 2026-09-26](../../../docs/auditoria/2026-09-26-auditoria-ux-administrador-ciego.md). Los IDs C#, A#, M# y O# de la auditoría se citan en cada requisito.

**Status:** draft (grupo A aprobado por Nico: "repara todos los problemas"; grupos B y C pendientes de Gate 1)  **Author:** Nico (vía Claude Code)  **Date:** 2026-09-26  **Target delivery:** grupo A local para la reunión del 29/09; B y C por fases; producción solo con PR aprobado

## Executive summary & intent

**Today:** quien administra Invision es una persona ciega total. La consola del sitio le anuncia éxitos que no ocurrieron, puede destruir audio real con una "ingesta" simulada y no le deja subir el audio de un libro ni registrar a su narrador. Además, la obliga a recorrer 1.077 botones para encontrar una ficha.  →  **After:** puede dar de alta un libro completo (datos, narrador, audio) sin ayuda y sin ver. Todo lo que escucha es verdad, nada se borra ni se pisa por un error de teclado, y el sistema le dice qué necesita atención.

## 0. Story

**Before:** Julio, administrador de la BCC, es ciego total y usa NVDA. Abre la consola y cae en "Ingesta Masiva". Carga una planilla, escucha "Ingesta finalizada con éxito" y se va tranquilo. Al día siguiente un socio avisa que el capítulo 1 de un libro "no suena": la ingesta lo había reemplazado por un archivo falso. Para cargar el audio de un libro nuevo, Julio tiene que pedirle a Nico que lo haga desde el panel en su computadora.

**After:** Julio entra y escucha "Libros, 538". Busca un título, escucha "3 resultados" y abre "Gestionar". Carga el narrador y marca "En Memoria". Sube las 12 pistas y escucha una por una cómo entran; una pista repetida se saltea sin pisar nada. Si se equivoca y presiona "Eliminar", el diálogo le explica qué va a pasar y el foco está en "Cancelar".

## 1. Outcomes — Prioritized user stories

### Story 1 [P1 — MVP core] — Nada destruye datos ni anuncia mentiras
**As a** administrador ciego, **I want to** que la consola nunca escriba contenido falso ni me anuncie un resultado que no ocurrió, **so that** pueda confiar en lo que escucho, que es mi única evidencia.

**Requirements**
- **R1.** La ingesta masiva desde SharePoint queda deshabilitada mientras no exista la transferencia real: no escribe nada en el almacenamiento, y la consola lo explica en lugar de ofrecer la carga (C1).
- **R2.** Ningún progreso ni éxito se anuncia sin confirmación del servidor (C2, M6).
- **R3.** La ruta de subida de capítulos rechaza nombres con rutas o que no sean MP3, y entrega un permiso de **solo creación**, que no puede sobrescribir un archivo existente (hallazgo E1 del spec 004).
- **R4.** Todos los errores, validaciones y bloqueos de la consola se anuncian por el canal urgente, y el campo con error queda marcado (C5).

### Story 2 [P1 — MVP core] — Un libro completo: datos, narrador y audio
**As a** administrador ciego, **I want to** registrar el narrador y subir los capítulos desde la ficha del libro, **so that** no queden fichas vacías ni dependa de otra persona u otra computadora.

**Requirements**
- **R5.** Desde la ficha de un libro se suben sus capítulos. El orden de reproducción es visible y se anuncia; cada pista se sube de a una con aviso de resultado; una pista que ya existe se saltea sin pisarla; una que falla se puede reintentar sin repetir las demás (C3).
- **R6.** El alta y la edición registran el narrador y la marca "En Memoria"; el listado y la ficha los muestran. El narrador se sugiere a partir de los ya cargados (C4).
- **R7.** El narrador se guarda sin modificar las tablas que ya existen en producción. Si la base todavía no lo tiene habilitado, el campo lo dice y el resto de la ficha funciona (P12, P13).

### Story 3 [P1 — MVP core] — Encontrar y operar sin recorrer cientos de controles
**As a** administrador ciego, **I want to** llegar a una ficha, un usuario o un evento sin recorrer toda la tabla, y no poder borrar algo por un Enter de más, **so that** el trabajo diario sea rápido y seguro.

**Requirements**
- **R8.** Cada fila de libros y de usuarios tiene un solo control, "Gestionar [nombre]", que abre la ficha con todas las acciones. Cada lista tiene título con su total, y el buscador anuncia cuántos resultados encontró (A2).
- **R9.** Eliminar pide confirmación en un diálogo que explica las consecuencias y abre con el foco en "Cancelar" (A3; la papelera completa es R23).
- **R10.** Todos los formularios y confirmaciones de la consola son diálogos que retienen y devuelven el foco (A4).
- **R11.** La lista de usuarios dice el rol de cada cuenta en texto (A1).
- **R12.** La auditoría es una tabla con persona, correo, evento y fecha legibles; no es una región viva ni tiene filas enfocables sin acción (A6).
- **R13.** Estructura sonora: la consola tiene su propia navegación (sin la barra de géneros de los socios), un título por pestaña, un solo anuncio al cambiar de pestaña con el nombre visible, e Inicio y Fin en las pestañas (M1, M2, M3).
- **R14.** La consola abre en "Libros", no en la ingesta (A5; el "Inicio" con pendientes es R18).

### Story 4 [P1 — MVP core] — Vocabulario sin variantes
**As a** administrador ciego, **I want to** que al escribir un género, un autor o un narrador el sistema me sugiera los existentes y me avise de los parecidos, **so that** no se creen "CUENTO" y "CUENTOS" como si fueran distintos.

**Requirements**
- **R15.** Género, autor y narrador sugieren los valores existentes. Antes de guardar un valor nuevo parecido a uno existente (mismas letras sin tildes, mayúsculas ni plural), se pregunta si es el mismo (A7; la fusión de valores ya duplicados es R24).

### Story 5 [P1 — MVP core] — Legible también con resto visual
**As a** administrador con baja visión, **I want to** que la consola cumpla el mismo contraste y las mismas ayudas que el sitio, **so that** no haya zonas de segunda.

**Requirements**
- **R16.** La consola pasa las verificaciones del spec 002 (axe en 0, contraste AAA, 48 px, dos regiones vivas) en los dos modos, y el arnés automático la cubre (A9).

### Story 6 [P1 — MVP core] — Alta de socios sin escribir a ciegas
**As a** administrador ciego, **I want to** poder escuchar la contraseña que escribo o generar una fácil de dictar, **so that** pueda entregársela al socio sin errores.

**Requirements**
- **R17.** El campo de contraseña se puede mostrar u ocultar con un botón. Hay un botón que genera una contraseña legible (palabras y números) y la anuncia (M5).

### Story 7 [P2 — Enhancement] — Qué necesita atención
**As a** administrador ciego, **I want to** escuchar al entrar qué fichas y cargas necesitan atención, **so that** sepa por dónde empezar sin recorrer la pantalla.

**Requirements**
- **R18.** Un "Inicio" resume los pendientes (fichas sin audio, sin narrador, valores parecidos, cargas con errores), cada uno enlazado a su lista filtrada (O2).
- **R19.** Cada libro tiene estado de publicación (borrador, sin audio, listo, publicado); los socios solo ven lo publicado (O3; decisión D6 del PRD).

### Story 8 [P2 — Enhancement] — El sistema escucha por mí
**As a** administrador ciego, **I want to** que el sistema verifique el audio subido, **so that** no publique pistas vacías o dañadas que no puedo detectar mirando.

**Requirements**
- **R20.** Después de subir, cada pista informa duración y problemas (vacía, dañada, silencio largo) y el libro resume la duración total (O5).

### Story 9 [P2 — Enhancement] — Cargas largas con estado real
**As a** administrador ciego, **I want to** consultar en cualquier momento el estado real de una carga masiva y que me avise al terminar, **so that** no dependa de una barra que no veo.

**Requirements**
- **R21.** Las tareas largas tienen estado real por libro (encolada, en curso, terminada, fallida), consultable a pedido, con aviso cortés al terminar y urgente si falla (O7).
- **R22.** El importador de planillas anuncia qué columna tomó para qué campo, resume los problemas antes de importar, ofrece una lista navegable de errores por fila y pide confirmación con el total (O8, A8).

### Story 10 [P2 — Enhancement] — Deshacer
**As a** administrador ciego, **I want to** recuperar lo que borré o cambié por error, **so that** un error de teclado no sea definitivo.

**Requirements**
- **R23.** Eliminar mueve a una papelera durante 30 días; cada edición guarda el valor anterior y se puede deshacer (O9).
- **R24.** Los valores duplicados existentes (géneros, autores, narradores) se pueden unir, con vista previa hablada de cuántas fichas cambian (O6).

### Story 11 [P2 — Enhancement] — Cada socio llega adaptado
**As a** administrador, **I want to** registrar el perfil de accesibilidad de cada socio al darlo de alta, **so that** su primer ingreso ya esté adaptado a su discapacidad.

**Requirements**
- **R25.** El perfil (usa lector de pantalla, baja visión, ceguera parcial, persona mayor sin lector) define las preferencias iniciales del socio: voz propia, contraste y tamaño de texto (O10; reemplaza la decisión A3 del PRD por una elección por persona).

### Story 12 [P3 — Optional / nice to have] — Rendición de cuentas
**As a** BCC, **I want to** saber quién cambió qué y recibir un resumen del día, **so that** la gestión del patrimonio sea verificable.

**Requirements**
- **R26.** La auditoría registra y muestra los cambios de contenido (quién creó, editó, subió o eliminó qué) con filtros (O11).
- **R27.** Un informe del día, accesible e imprimible, resume lo publicado, lo subido y lo pendiente (O12).

## 2. Scope boundaries
**In scope**
- Grupo A (Historias 1 a 6): reparación de todos los hallazgos de la auditoría.
- Grupos B y C (Historias 7 a 12): las mejoras O2 a O12, especificadas y pendientes de aprobación.

**Out of scope** (explicit — this is what stops the agent over-building)
- La transferencia real desde SharePoint: la ingesta queda deshabilitada (R1). Su implementación es otro spec, que parte de R21 y R22.
- La experiencia de escucha del socio (seguir escuchando, tarjetas con narrador y duración): se propone como spec 006.
- El renombre de `InvisionAPI-main` y de los nombres Docker: tarea de mantenimiento aparte.
- Aplicar cambios de esquema en producción: se entregan como documentos de aprobación.

## 3. Constraints
- **R28.** Nada toca producción sin aprobación BCC (P12). La API sigue funcionando con el esquema real de producción: lo nuevo que requiera tablas degrada con aviso si la tabla falta y nunca se crea solo al desplegar (P13).
- **R29.** Las verificaciones de los specs 001 y 002 no retroceden: tests de la API y del panel, y arnés del sitio en verde.
- **R30.** Todo dato que escribe el administrador se valida en el servidor (CWE-20) y se muestra como texto (CWE-79). Las rutas de administración verifican el rol en el servidor (CWE-862).

## 4. Prior decisions
- El administrador es una persona ciega total; toda decisión de diseño se justifica desde ese perfil (Nico, 2026-09-26, P17).
- "Spec 005 y repara todos los problemas" (Nico, 2026-09-26): el grupo A se implementa ya; los grupos B y C esperan Gate 1.
- La consola única (spec 004) y el catálogo de atajos (spec 003) siguen vigentes: este spec se construye sobre la consola del sitio.
- La carga guiada del panel (`carga.js`) es el modelo de interacción para subir capítulos (acierto B5 de la auditoría).

## 5. Decision logic

```
WHEN el administrador pide una ingesta masiva
  ¿existe la transferencia real?                  → no: se explica que está deshabilitada; nada se escribe
THEN (cuando exista) se encola con estado real consultable (R21)

WHEN se sube una pista desde la ficha
  ¿el nombre trae una ruta o no es MP3?           → sí: se rechaza antes de pedir permiso
  ¿ya existe ese archivo?                         → sí: se saltea y se avisa
  ¿el permiso permite sobrescribir?               → nunca: es de solo creación
THEN se sube, se anuncia el resultado y se sigue con la próxima

WHEN el administrador guarda un género, autor o narrador nuevo
  ¿es parecido a uno existente?                   → sí: se pregunta si es el mismo antes de guardar
THEN se guarda el valor elegido

WHEN el administrador elige "Eliminar"
THEN se abre un diálogo con las consecuencias y el foco en "Cancelar"; solo "Eliminar" confirma

WHEN algo falla
THEN se anuncia por el canal urgente y, si hay un campo responsable, queda marcado y con el foco
```

**Promises:**
- Nunca un éxito anunciado sin confirmación del servidor.
- Nunca un archivo de audio pisado.
- Nunca un borrado sin un diálogo que arranque en "Cancelar".
- Nunca un error sin aviso urgente.
- Nunca un cambio de esquema en producción sin aprobación.

## 6. Task breakdown (high level)
- Grupo A: subida segura, ingesta deshabilitada, roles y auditoría legibles, narrador, consola ordenada (estructura, diálogos, un control por fila), subida de capítulos en la ficha, vocabulario con sugerencias, contraseñas, contraste y arnés de la consola.
- Grupo B: Inicio y estado de publicación, verificación de audio, tareas con estado real e importador, papelera y fusión, perfiles de socio.
- Grupo C: auditoría de contenido e informe del día.

## 7. Verification criteria
- **V1 (R1).** La ruta de ingesta no escribe en el almacenamiento y responde que está deshabilitada; la pestaña lo explica y no ofrece cargar.
- **V2 (R2).** No hay ningún anuncio de progreso o éxito de ingesta en el código ni en la pantalla.
- **V3 (R3).** `../x.mp3`, `a/b.mp3` y `x.wav` se rechazan; el permiso entregado no incluye escritura sobre existentes.
- **V4 (R4).** Cada pestaña tiene un caso de error que llega al canal urgente con el campo marcado.
- **V5 (R5).** Una carga simulada con una pista repetida y una fallida termina con la repetida salteada, la fallida reintentable y el orden anunciado.
- **V6 (R6, R7).** Un libro guardado con narrador y "En Memoria" los muestra al volver a abrirlo; sin la tabla del narrador, la ficha se guarda igual y el campo dice que no está habilitado.
- **V7 (R8).** Libros y usuarios tienen un control por fila, un título con el total y un conteo anunciado al buscar.
- **V8 (R9, R10).** Eliminar abre un diálogo con el foco en "Cancelar"; Tab no sale de ningún diálogo de la consola y Esc devuelve el foco.
- **V9 (R11).** La cuenta de administración se lista con el rol "Admin".
- **V10 (R12).** La auditoría es una tabla con encabezados, sin región viva; la página tiene exactamente dos regiones vivas.
- **V11 (R13, R14).** En `/admin` no está la barra de géneros; cada pestaña tiene título; cambiar de pestaña produce un solo aviso; Inicio y Fin funcionan; la consola abre en "Libros".
- **V12 (R15).** Escribir "cuento" cuando existe "CUENTOS" produce la pregunta antes de guardar.
- **V13 (R16).** El arnés del sitio cubre las pestañas de la consola: axe en 0, contraste AAA y 48 px en los dos modos.
- **V14 (R17).** La contraseña se puede mostrar y ocultar, y la generada se anuncia.
- **V15 (R18–R27).** Cada requisito de los grupos B y C tiene su caso de prueba al implementarse.
- **V16 (R28, R29, R30).** Tests de la API, del panel y arnés en verde; ninguna tabla nueva en `Base.metadata`; entradas validadas en el servidor.

## Edge cases
1. Un libro cuyo título tiene barra ("A/B"): el permiso de subida usa el nombre del libro como carpeta y el nombre de la pista validado por separado.
2. Se sube una pista mientras otra persona sube la misma: la segunda recibe "ya existe" y no pisa nada.
3. La sesión vence en medio de la carga: aviso urgente; al volver, el reintento sigue donde quedó.
4. Narrador con tildes o mayúsculas distintas de uno existente: se sugiere el existente (R15).

## Open clarifications
- Sin preguntas bloqueantes para el grupo A.
