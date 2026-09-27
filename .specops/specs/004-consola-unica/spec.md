# Spec — 004-consola-unica

> QUÉ y POR QUÉ. Sin tecnología: eso va en el plan.
> Constitución: `.specops/constitution.md` v1.2.0 (P8 seguridad, P12 nada en producción sin aprobación BCC, P13 el esquema de producción manda, P14 WCAG 2.2, P17 la accesibilidad decide).

**Status:** draft  **Author:** Nico (vía Claude Code)  **Date:** 2026-09-26  **Target delivery:** propuesta en la reunión del 29/09; implementación por fases después, producción solo con PR aprobado

## Executive summary & intent

**Today:** hay dos aplicaciones de administración sobre la misma infraestructura. El panel operativo (:8888, servidor propio que entra con credenciales directas a la base y al almacenamiento de audio) y el administrador del sitio (/admin, que usa la API). Cinco funciones están repetidas y cuatro existen solo en el panel.  →  **After:** una sola consola dentro del sitio. Todo pasa por la API, con el mismo inicio de sesión, los mismos permisos, las mismas ayudas de accesibilidad y el mismo catálogo de atajos. El panel se retira cuando la consola lo reemplaza en producción.

## 0. Story

**Before:** para cargar un libro, Marcela abre el panel en la computadora de Nico, porque solo ahí está configurado. Para dar de alta a un socio abre el sitio en otra pestaña, con otro usuario. Los botones de accesibilidad son distintos en cada lado y un cambio en uno no llega al otro.

**After:** Marcela entra al sitio con su cuenta de administración y encuentra todo en el mismo lugar: resumen, explorador de audios, carga guiada, usuarios, contenido y auditoría. Usa las mismas teclas y las mismas herramientas de accesibilidad que conoce, desde cualquier computadora.

## 1. Outcomes — Prioritized user stories

### Story 1 [P1 — MVP core] — Resumen operativo en la consola
**As a** administrador, **I want to** ver en la consola del sitio las cifras del catálogo de audio y el estado de los servicios, **so that** no necesite el panel para saber cómo está la biblioteca.

**Requirements**
- **R1.** La consola muestra audiolibros, pistas, almacenamiento y usuarios, con las mismas cifras que hoy da el panel.
- **R2.** El estado del índice de audio (sin indexar, indexando, al día, con error) se muestra tal cual. Nunca se dice "al día" después de un fallo, y el último índice válido se conserva.
- **R3.** Abrir el resumen nunca espera al listado completo del almacenamiento: el índice se arma en segundo plano y las cifras aparecen cuando están.

### Story 2 [P1 — MVP core] — Explorador de audios con escucha previa
**As a** administrador, **I want to** buscar cualquier título del almacenamiento y escuchar sus pistas, **so that** pueda verificar una carga sin salir de la consola.

**Requirements**
- **R4.** La búsqueda cubre todo el catálogo de audio, no una primera página.
- **R5.** Las pistas se muestran y se reproducen en orden de capítulo.
- **R6.** La escucha previa usa un permiso de solo lectura, válido pocos minutos y solo para un archivo que existe en el contenedor.

### Story 3 [P1 — MVP core] — Carga guiada accesible, con las protecciones del panel
**As a** persona del equipo que carga audiolibros con lector de pantalla, **I want to** crear un libro y subir sus pistas desde la consola con el mismo flujo guiado del panel, **so that** la carga de los títulos restantes no dependa de una computadora en particular.

**Requirements**
- **R7.** El flujo guiado conserva lo que ya funciona: paso a paso, orden de reproducción visible, avisos por pista, reintento y reanudación sin volver a subir lo que ya está.
- **R8.** Una pista nunca pisa un archivo existente; si ya existe, se saltea y se avisa.
- **R9.** Se rechazan nombres con rutas (`/`, `\`, `..`), extensiones distintas de MP3, archivos vacíos o más grandes que el límite, antes de escribir nada.
- **R10.** Si la subida se corta a mitad, no queda un archivo incompleto en el almacenamiento.
- **R11.** La ruta de subida que hoy tiene la API (`presign-upload`) deja de aceptar nombres con rutas y deja de permitir sobrescribir. Corrige la vulnerabilidad detectada el 2026-09-26.

### Story 4 [P2 — Enhancement] — Gobernanza a la vista
**As a** equipo tripartito, **I want to** que la consola muestre el mandato operativo de la BCC, **so that** las reglas se vean donde se opera.

**Requirements**
- **R12.** La consola incluye la sección de gobernanza del panel, con el principio de cero riesgo en producción.

### Story 5 [P1 — MVP core] — Una consola publicada y segura
**As a** BCC, **I want to** que publicar las funciones de operación en el sitio no abra riesgos nuevos, **so that** la unificación no comprometa los datos ni el audio.

**Requirements**
- **R13.** Cada función de operación verifica el rol Admin en el servidor. Ocultar botones en la pantalla no cuenta como protección.
- **R14.** El navegador nunca recibe credenciales del almacenamiento ni de la base; solo permisos temporales acotados a un archivo.
- **R15.** Cada subida, creación de libro y refresco del índice queda registrado con quién, cuándo y qué.
- **R16.** Los mensajes de error no exponen detalles internos (nombre de cuenta, rutas, respuestas de Azure).
- **R17.** Las operaciones pesadas (refresco del índice, subidas) tienen un límite de uso por cuenta para que un error o un abuso no sature el servicio.

### Story 6 [P2 — Enhancement] — Transición sin corte y retiro del panel
**As a** equipo operativo, **I want to** seguir usando el panel hasta que la consola lo reemplace de verdad en producción, **so that** la carga de audiolibros no se detenga.

**Requirements**
- **R18.** Mientras la consola no esté en producción, el panel sigue funcionando igual.
- **R19.** La consola se habilita en producción solo con el despliegue de la API nueva aprobado por la BCC. El documento de aprobación lista las rutas nuevas y el plan de reversión.
- **R20.** El panel se retira solo cuando cada una de sus funciones tiene su equivalente verificado en la consola de producción, y esa verificación queda firmada.
- **R21.** Al retirarlo, sus pruebas útiles (índice, carga, accesibilidad) pasan a la API o al sitio; no se pierde cobertura.

### Story 7 [P1 — MVP core] — Misma accesibilidad y mismos atajos
**As a** persona del equipo que usa lector de pantalla, **I want to** que las secciones nuevas de la consola cumplan lo mismo que el resto del sitio, **so that** no haya zonas de segunda.

**Requirements**
- **R22.** Las secciones nuevas pasan las verificaciones del spec 002: axe en 0, contraste AAA, 48 px, texto al 200 %, dos regiones vivas y foco visible.
- **R23.** Las acciones de la consola forman parte del catálogo de atajos del spec 003, en su zona "admin".

## 2. Scope boundaries
**In scope**
- Llevar a la API las funciones propias del panel (resumen e índice, explorador y escucha previa, carga guiada) y a la consola del sitio sus pantallas.
- Corregir la ruta de subida existente de la API.
- Registro de operaciones y límites de uso.
- Documento de aprobación del despliegue y criterio de retiro del panel.

**Out of scope** (explicit — this is what stops the agent over-building)
- Rediseñar las pestañas que ya existen en /admin (usuarios, contenido, auditoría, ingesta masiva), salvo lo que exija la accesibilidad.
- El pipeline de carga masiva de los ~700 libros desde SharePoint: sigue su camino actual.
- Desplegar a producción: se entrega el PR y el documento de aprobación, no se ejecuta.
- Borrar el panel antes de cumplir R20.

## 3. Constraints
- **R24.** Nada llega a producción sin aprobación BCC registrada vía PR (P12). La API de producción está desactualizada: la consola depende de desplegar la API nueva, y eso es una decisión de la BCC.
- **R25.** La API sigue funcionando con el esquema real de producción (P13): una tabla que falte degrada la función que la usa, no toda la consola.
- **R26.** Las verificaciones existentes no retroceden: los tests del panel, de la API y el arnés del sitio siguen en verde durante toda la transición.

## 4. Prior decisions
- El panel debe ser parte del sitio (Nico, 2026-09-26). Se unifica en el administrador del sitio y no al revés: el sitio ya tiene inicio de sesión, roles y la mayoría de las funciones.
- Unificación por fases: primero la API, después las pantallas y al final el retiro (propuesta aceptada por Nico, 2026-09-26).
- El spec 003 se ajusta a una sola app: el catálogo tiene zona "sitio" y zona "admin".
- Del spec 002: tokens AAA, dos canales de aviso, foco 4/4, 48 px, texto proporcional y `<dialog>` nativo.
- Del spec 001: índice de audio en segundo plano sin falso éxito, orden de capítulos, carga sin pisar archivos y errores sin detalle interno.

## 5. Decision logic

```
WHEN alguien pide una función de operación
  ¿tiene sesión con rol Admin?                     → no: se rechaza, sin detalle
  ¿superó el límite de uso de esa operación?       → sí: se rechaza con "esperá un momento"
THEN se ejecuta y queda registrada (quién, cuándo, qué)

WHEN se sube una pista
  ¿el nombre trae una ruta o no es MP3?            → sí: se rechaza antes de escribir
  ¿está vacía o supera el límite?                  → sí: se rechaza antes de escribir
  ¿ya existe en el almacenamiento?                 → sí: se saltea y se avisa (no se pisa)
  ¿se cortó a mitad?                               → sí: no queda nada escrito; se puede reintentar
THEN queda guardada con su orden de capítulo

WHEN se pide escuchar una pista
  ¿el archivo existe en el contenedor?             → no: se avisa, sin permiso
THEN se entrega un permiso de lectura por pocos minutos para ese archivo

WHEN se propone retirar el panel
  ¿cada función tiene su equivalente verificado en producción? → no: el panel sigue
THEN se retira, con la verificación firmada y las pruebas trasladadas
```

**Promises:**
- Nunca credenciales en el navegador.
- Nunca una pista pisada ni un archivo a medio subir.
- Nunca "al día" después de un fallo del índice.
- Nunca una función de operación sin rol Admin verificado en el servidor.
- Nunca un retiro del panel sin reemplazo verificado.
- Nunca un cambio en producción sin aprobación.

## 6. Task breakdown (high level)
- Fase 1: rutas de operación en la API (resumen e índice, explorador, escucha previa, carga), registro y límites, más la corrección de `presign-upload`.
- Fase 2: pestañas de la consola en el sitio (Resumen, Explorador, Carga guiada, Gobernanza) con accesibilidad y atajos.
- Fase 3: documento de aprobación del despliegue, criterio y lista de retiro del panel.

## 7. Verification criteria
- **V1 (R1).** Contra los mismos datos, las cifras de la consola coinciden con las del panel.
- **V2 (R2, R3).** Con el almacenamiento fallando, el estado dice "con error", conserva el último índice y abrir el resumen responde en menos de un segundo.
- **V3 (R4).** Un título que ordena después del número 100 se encuentra en la búsqueda.
- **V4 (R5).** Las pistas "1, 2, 10" se muestran y se reproducen en ese orden.
- **V5 (R6).** El permiso de escucha es de solo lectura, vence en minutos y se niega para un archivo inexistente.
- **V6 (R7, R8, R10).** Un lote con una pista repetida y una subida cortada termina con la repetida salteada, la cortada ausente y un reintento que completa solo lo que falta.
- **V7 (R9, R11).** Nombres con `../`, `a/b.mp3`, `.wav`, archivo vacío y archivo grande se rechazan sin escribir, tanto en la carga guiada como en `presign-upload`.
- **V8 (R12).** La sección de gobernanza está en la consola con el principio de cero riesgo.
- **V9 (R13).** Cada ruta de operación responde con rechazo sin sesión y con una cuenta sin rol Admin.
- **V10 (R14, R16).** Ninguna respuesta de la API contiene la clave de la cuenta, cadenas de conexión ni errores crudos de Azure.
- **V11 (R15).** Después de una carga, el registro muestra quién subió qué y cuándo.
- **V12 (R17).** Superar el límite de refrescos devuelve un rechazo claro, y el siguiente intento después de la espera funciona.
- **V13 (R18, R26).** Durante toda la transición, el panel y sus tests siguen en verde.
- **V14 (R19, R24).** Existe el documento de aprobación con rutas nuevas y plan de reversión; no se desplegó nada.
- **V15 (R20, R21).** La lista de retiro compara función por función con su verificación, y las pruebas trasladadas corren en la API o en el sitio.
- **V16 (R22).** Las pestañas nuevas pasan el arnés del sitio (axe 0, AAA, 48 px, 200 %, dos regiones vivas) en los dos modos.
- **V17 (R23).** Las acciones de la consola aparecen en la zona "admin" del catálogo y responden a sus teclas.
- **V18 (R25).** Sin la tabla de sesiones, la auditoría muestra "no disponible" y el resto de la consola funciona.

## Edge cases
1. Dos personas suben el mismo libro a la vez: la segunda ve las pistas como "ya existen" y no pisa nada.
2. La sesión vence en medio de una carga: se avisa por el canal urgente, se conserva el lote y, al volver a entrar, el reintento sigue donde quedó.
3. Una subida muy grande excede el límite del proxy de producción: el límite se valida antes de enviar y el mensaje lo dice.
4. El índice de audio tarda minutos en la primera carga: el resumen muestra "Indexando" y se actualiza solo.

## Open clarifications
- Sin preguntas bloqueantes para el diseño. La fecha del despliegue de la API nueva la decide la BCC (R19, R24).
