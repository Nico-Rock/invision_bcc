# Spec — 001-biblioteca-actualizada

> QUÉ y POR QUÉ. Sin stack, sin estructura de archivos, sin detalle de implementación.
> Sin dudas abiertas (fase Clarify cerrada el 2026-09-26). Cada requisito tiene un ID estable (R#).

**Status:** clarified (2026-09-26; D1 y D2 quedan para el board el 29/09)  **Author:** Nico (vía Claude Code)  **Date:** 2026-09-26  **Target delivery:** demo en la reunión tripartita del 2026-09-29; despliegue a producción solo tras la aprobación BCC (P12)

## Resumen ejecutivo e intención

Invision cumple un año. El catálogo en producción tiene 538 títulos, pero el catálogo y el audio no coinciden: **42 libros aparecen en el catálogo sin audio** y **24 carpetas de audio no tienen ficha**. Vienen unos 700 títulos más, y hoy el único camino para cargarlos es manual (un INSERT a la vez, más un script con los títulos escritos a mano), un camino que ya produjo un incidente en producción. El panel operativo, que debería mostrar todo esto, muestra un error en su primera pantalla.

**Hoy:** cargar un libro es artesanal, el catálogo tiene huecos que nadie ve y el panel falla al abrirse → **Después:** un proceso de carga por lotes que valida antes de escribir, un catálogo reconciliado y un panel que dice la verdad sobre el estado de la biblioteca.

## 0. Story — Historia

**Antes:** Un socio ciego de la BCC busca por voz un título que le recomendaron, lo encuentra en el catálogo y le da reproducir. No pasa nada: el libro tiene ficha pero no tiene audio (es uno de los 42). No hay forma de saber si es un error suyo o de la biblioteca. Mientras tanto, la bibliotecaria tiene en un disco 700 audiolibros nuevos listos para compartir y ninguna forma segura de subirlos sin pedirle a Nico que escriba SQL a mano, libro por libro. Cuando por fin se suben 4, una fila mal cargada tumba el listado de usuarios del panel durante días.

**Después:** La bibliotecaria prepara una planilla con los títulos del lote. La herramienta de carga la revisa completa antes de tocar nada y le dice, en lenguaje claro y por voz, qué 12 filas tienen problemas y por qué (título demasiado largo, género fuera de la lista, carpeta sin audio, pista cortada). Corrige, vuelve a revisar, y con la aprobación registrada el lote sube. Si se corta internet a la mitad, retoma donde quedó. El socio que buscaba ese título lo encuentra y lo escucha. Y el panel muestra, para el aniversario, cuántos libros hay, cuántas horas de audio y cuántos quedan pendientes de reconciliar.

## 1. Resultados (Outcomes) — historias de usuario priorizadas

### Historia 1 [P1 — núcleo MVP] — Panel operativo confiable
**Como** equipo operativo de Invision, **quiero** que el panel abra siempre y muestre el estado real de la biblioteca, **para** poder operarlo y mostrarlo sin que falle frente al equipo BCC.

**Requisitos**
- **R1.** El Resumen Ejecutivo abre sin error contra la base de producción real, aunque falten tablas que el modelo local sí tiene. La métrica que no se puede calcular aparece como "no disponible en esta base", junto con el motivo, y no como un error que tumba la vista.
- **R2.** La sección Registros de Acceso distingue "esta base no registra sesiones" de "hubo un error", y lo comunica en texto y a lectores de pantalla.
- **R3.** El panel queda disponible aunque Azure Blob Storage tarde o falle. Mientras el catálogo de audio se indexa, el panel lo informa, y si la indexación falla lo dice. Nunca informa éxito si falló.
- **R4.** El índice del catálogo de audio se puede refrescar a pedido, y un fallo parcial no deja un índice vacío que se presente como válido.

**Criterios de aceptación**
- [ ] Abrir el panel contra producción nunca muestra una traza de error de SQL en ninguna sección.
- [ ] Con Blob inaccesible, el panel igual abre y anuncia "catálogo de audio no disponible".

### Historia 2 [P1 — núcleo MVP] — Reconciliación del catálogo
**Como** bibliotecaria de la BCC, **quiero** ver qué libros del catálogo no tienen audio y qué audio no tiene ficha, **para** que ningún socio encuentre un libro que no suena.

**Requisitos**
- **R5.** Existe un informe de reconciliación que cruza las fichas del catálogo con las carpetas de audio y lista tres grupos: ficha sin audio, audio sin ficha y coincidencias.
- **R6.** Para cada ficha sin audio, el informe propone la carpeta de audio más parecida, con un nivel de confianza, para detectar nombres truncados o con diferencias de tildes o signos (p. ej. `BESTIARIO Y TODOS LOS FUEGO` ↔ `BESTIARIO Y TODOS LOS FUEGOS`).
- **R7.** El informe es de solo lectura y se puede exportar como planilla para que la BCC decida cada corrección. Ninguna corrección se aplica sin que alguien la apruebe (P12).
- **R8.** El informe también señala los problemas de calidad del catálogo que afectan a la navegación: géneros escritos de dos formas distintas para la misma categoría y libros sin género.

**Criterios de aceptación**
- [ ] El informe contra producción reproduce los conteos conocidos al 2026-09-26 (538 fichas, 520 carpetas, 42 fichas sin audio, 24 carpetas sin ficha) o explica la diferencia.
- [ ] Generar el informe no escribe nada ni en la base ni en Blob.

### Historia 3 [P1 — núcleo MVP] — Carga por lotes que valida antes de escribir
**Como** operador de la carga, **quiero** cargar un lote de cientos de audiolibros desde una planilla, validado completo antes de escribir nada, **para** incorporar los ~700 títulos pendientes sin repetir los incidentes de los INSERT manuales.

**Requisitos**
- **R9.** El lote se describe con una planilla (manifiesto): una fila por libro, con título, autor, editorial, género, descripción, narrador (opcional) y la ubicación de su carpeta de audio dentro de la carpeta de SharePoint/OneDrive de la BCC sincronizada en el equipo que ejecuta la carga. No hay títulos escritos en el código.
- **R10.** Cada fila se valida con las mismas reglas que aplica la API al leer y escribir (P7): campos obligatorios, largos máximos de las columnas de producción (título y autor hasta 255 caracteres, género hasta 100). Un género que no existe en el catálogo **se acepta con advertencia** y el informe lo destaca como "género nuevo" para que se revise, también cuando se parece a uno existente (p. ej. difiere solo en tildes o en una palabra).
- **R11.** La validación también revisa el audio: la carpeta existe, tiene pistas de audio válidas, ninguna está vacía o truncada, **todas están descargadas en el equipo** (no son archivos "solo en la nube" de OneDrive) y el orden de las pistas se puede determinar sin ambigüedad.
- **R12.** Un libro que ya existe en el catálogo (mismo título **y** mismo autor, comparados sin distinguir mayúsculas, tildes ni signos) no se duplica: se informa y se omite. Un título que ya existe con **otro** autor o narrador es un libro distinto y legítimo: la validación lo marca como "título repetido" y exige un nombre distintivo para su ficha y su carpeta de audio antes de cargarlo (ver R31).
- **R13.** La simulación es el modo por defecto: produce el informe completo de qué se crearía, qué se omitiría y qué falla, sin escribir nada. Escribir en producción exige una acción explícita, distinta de la simulación, y **una aprobación oficial del lote registrada en el repositorio de Invision** (ver R32). Sin esa aprobación, la ejecución real se rechaza (P12).
- **R14.** La carga es retomable: si se interrumpe, al volver a ejecutarla continúa donde quedó, sin duplicar fichas ni volver a subir el audio que ya estaba completo.
- **R15.** Al terminar cada lote queda un informe persistente: fichas creadas, pistas subidas, omitidos, fallos y motivos. Es la evidencia para la BCC.
- **R16.** Una ficha nunca queda visible para los socios sin su audio completo. Doble garantía: (a) **el audio de un libro se sube completo antes de crear su ficha**, así que un fallo de audio nunca deja una ficha huérfana; y (b) el catálogo incorpora un **estado de publicación explícito** por libro, de modo que un libro puede existir sin estar visible. La parte (b) es un cambio aditivo del esquema de producción: se propone como migración en un PR y solo se aplica con la aprobación BCC (P12). Mientras no se apruebe, la parte (a) sostiene la promesa sola.

**Criterios de aceptación**
- [ ] Un manifiesto de prueba con filas válidas e inválidas produce, en simulación, un informe que identifica cada fila inválida con su motivo, y no escribe nada.
- [ ] Interrumpir una carga a mitad de camino y volver a ejecutarla termina el lote sin duplicados.

### Historia 4 [P2 — mejora] — Interfaz de administración mejorada
**Como** bibliotecaria (posiblemente con discapacidad visual), **quiero** operar la carga y la revisión desde el panel, con teclado y lector de pantalla, **para** no depender de una persona técnica para cada lote.

**Requisitos**
- **R17.** El formulario de carga individual del panel usa los campos que existen en producción (incluida la editorial, sin categoría) y valida los largos antes de enviar, con mensajes comprensibles leídos por voz.
- **R18.** El panel permite subir un manifiesto de lote y ver su informe de validación (R10–R12) en una vista accesible, navegable por teclado y con resumen anunciado.
- **R19.** El panel muestra el informe de reconciliación (R5–R8) en una vista accesible.
- **R20.** La navegación del panel anuncia en qué sección está uno parado.
- **R40.** El panel adopta las herramientas de accesibilidad visual del sitio público rediseñado (pedido de Nico, 2026-09-26), con el mismo comportamiento: una barra superior siempre visible con aumentar y disminuir el texto (de 12 a 28 px, de 2 en 2), alto contraste (negro, amarillo y cian) y señales de audio encendidas o apagadas. Cada cambio se anuncia por voz y en la región viva. Las preferencias se recuerdan en el equipo. Todo el panel escala con el tamaño de texto elegido, sin cortes ni superposiciones.
- **R41.** El panel incorpora las ayudas al usuario del mockup accesible (`mockup_accessible.html`, pedido de Nico, 2026-09-26): (a) un enlace "Saltar al contenido principal" como primer elemento al tabular; (b) una bienvenida anunciada al entrar, que indica cómo escuchar los atajos; (c) atajos de teclado: 1 a 6 para las secciones, S para el buscador de audios, ? o H para escuchar la ayuda, Esc para cerrar, y Espacio y flechas (±15 s) para el reproductor; (d) una ventana de ayuda con la tabla de atajos, que toma el foco y lo devuelve al cerrarse; (e) un sonido sutil al pasar el foco por cada elemento interactivo, que respeta el interruptor de señales; (f) dictado por voz en el buscador de audios. Los atajos nunca se disparan mientras se escribe en un campo ni con Ctrl, Cmd o Alt apretados.
- **R37.** El panel lleva de fondo la ilustración del faro (identidad del aniversario, pedido de Nico el 2026-09-26) con un 90 % de transparencia. Es puramente decorativa: los lectores de pantalla la ignoran, no reduce el contraste del texto por debajo de WCAG AA y desaparece en el modo de alto contraste.

**Criterios de aceptación**
- [ ] Con VoiceOver, una persona puede ir de la navegación a la validación de un manifiesto y escuchar el resumen sin usar el mouse.

### Historia 5 [P2 — mejora] — Catálogo real en el entorno local
**Como** desarrollador y presentador de la demo, **quiero** que la aplicación local muestre el catálogo real, **para** mostrar el rediseño visual con datos verdaderos sin conectar el entorno local a producción.

**Requisitos**
- **R21.** Existe una forma repetible de copiar el catálogo de producción (fichas y géneros) al entorno local leyendo producción solo con consultas de lectura.
- **R38.** En el entorno local, la búsqueda y el filtro por género se comportan como en producción: sin distinguir mayúsculas, **incluidas las letras acentuadas** (`POESÍA` = `poesía`). Hallado el 2026-09-26: la base local no pliega mayúsculas acentuadas y dejaba vacíos los géneros con tilde. Además, **el streaming de audio funciona igual que en producción**: la base local no admite por defecto que la API la use desde varios hilos, y cada reproducción daba error 500.
- **R22.** La copia local no incluye datos personales de los socios (correos, nombres, teléfonos, progreso de escucha). El acceso local usa cuentas de demostración creadas para ese fin (P9).

**Criterios de aceptación**
- [ ] Después de la copia, el frontend local lista los mismos géneros y títulos que producción.
- [ ] La base local no contiene ningún correo de un socio real.

### Historia 6 [P2 — mejora] — Deuda estructural que puede volver a romper producción
**Como** equipo de Invision, **quiero** cerrar las trampas conocidas del código, **para** que un dato raro no vuelva a tumbar una pantalla completa.

**Requisitos**
- **R23.** Los listados de usuarios no fallan por completo porque una fila tenga un correo que el validador de entrada rechazaría. La validación de formato de correo aplica a la entrada, no a la salida.
- **R24.** El número de capítulo de cada pista se obtiene del nombre del archivo sin confundirlo con la extensión, y el orden resultante es el correcto para nombres como `Pista 1 … Pista 20`. **No es benigno** (corrección del 2026-09-26): con el índice repetido, el orden cae a orden alfabético (`Pista 1, Pista 10 … Pista 2`) y la app muestra "Capítulo 1 de 1".
- **R39.** El catálogo del frontend muestra el autor real de cada libro. Hallado el 2026-09-26: la búsqueda entrega el autor en otro campo y la app mostraba "Autor Desconocido" en todos los libros.
- **R42.** En el sitio, **todo** el texto escala con A+ y A-, incluidos los botones de género y las tarjetas del catálogo. Hallado en la auditoría del 2026-09-26: 17 botones quedaban fijos en 13,3 px, el tamaño por defecto del navegador para los botones.
- **R25.** Los géneros que muestra el frontend salen del catálogo, no de una lista fija en el código (P2).

**Criterios de aceptación**
- [ ] Una base de prueba con un usuario de correo `.local` devuelve el listado completo sin error.
- [ ] Un libro con 20 pistas devuelve los índices 1 a 20 en orden.

### Historia 8 [P2 — mejora] — "En Memoria": la voz de quien narró
**Como** BCC, **quiero** que cada audiolibro registre quién lo narró, **para** preservar en el tiempo a las personas que prestaron su voz a la biblioteca. Algunas grabaciones son muy antiguas y pueden ser el último registro en vida de su narrador.

**Requisitos**
- **R30.** Cada audiolibro puede registrar a su narrador. El dato es opcional: una grabación antigua puede tener narrador desconocido, y eso se registra explícitamente como "desconocido", distinto de "sin informar".
- **R31.** Dos audiolibros pueden compartir título si difieren en autor o narrador. Cada uno tiene un nombre de ficha y una carpeta de audio únicos que los distinguen de forma legible por voz (p. ej. "Título, narrado por X").
- **R33.** Existe un informe "En Memoria" con los libros sin narrador identificado, para que la BCC pueda investigarlos y completarlos con el tiempo.
- **R34.** Guardar el narrador requiere un cambio aditivo del esquema de producción, que se propone por PR con la aprobación BCC (P12). Mientras no se apruebe, el narrador informado en el manifiesto queda registrado en el informe del lote para no perderlo.

**Criterios de aceptación**
- [ ] Un manifiesto con dos filas de igual título y distinto narrador produce dos libros distinguibles, o un rechazo que pide el nombre distintivo.
- [ ] El informe "En Memoria" lista los libros cuyo narrador es desconocido o no fue informado.

### Historia 9 [P1 — núcleo MVP] — Aprobaciones oficiales en el repositorio
**Como** equipo tripartito, **quiero** que toda escritura en producción (carga de un lote, corrección de reconciliación, migración de esquema) se apruebe mediante un PR revisable en el repositorio de Invision, **para** tener un registro oficial, fechado y auditable de quién aprobó qué.

**Requisitos**
- **R32.** Cada operación sobre producción tiene un documento de aprobación versionado en el repositorio: qué se va a hacer (el informe de simulación), quién aprueba por la BCC y cuándo. La aprobación vale cuando su PR se integra a la rama principal.
- **R35.** La herramienta de carga y la de correcciones verifican, antes de escribir, que exista la aprobación integrada correspondiente a ese lote o corrección exacta. Si el lote cambió después de aprobado, la aprobación deja de valer.

**Criterios de aceptación**
- [ ] Un intento de ejecución real con una aprobación inexistente, no integrada o de un lote modificado se rechaza con un mensaje claro.

### Historia 7 [P3 — opcional] — Cifras del aniversario
**Como** equipo de Invision, **quiero** cifras reales del año (títulos, horas de audio, socios activos), **para** comunicar el aniversario con datos verificables.
- **R26.** El Resumen Ejecutivo muestra las horas totales de audio y los socios con actividad de escucha, además de los totales que ya muestra.

## 2. Límites de alcance (Scope boundaries)

**Dentro del alcance**
- Panel operativo (`admin-dashboard`), la herramienta de carga por lotes, el informe de reconciliación, la copia local del catálogo, las correcciones puntuales de API y frontend de la Historia 6.

**Fuera del alcance** (explícito)
- **Modificar el esquema de producción** (crear `categorias`, `clasificaciones`, `sesiones_acceso` o `categoria_id`): es la Opción C del módulo 13 y requiere su propio proyecto y la decisión del board.
- **Aplicar correcciones de reconciliación o cargar lotes en producción durante esta entrega.** Esta entrega construye y demuestra en simulación; la ejecución real espera la aprobación BCC (P12).
- **Desplegar la API ni el frontend a producción.** La API de producción es una versión vieja; actualizarla es una decisión aparte.
- Ingesta real desde SharePoint (hoy es un mock), refresh tokens, el Bibliotecario Digital con IA.
- Rediseño visual adicional del frontend más allá de R25.

## 3. Restricciones (Constraints)
- **R27.** Ninguna operación de esta entrega escribe en producción sin aprobación registrada. Todo lo que puede escribir en producción arranca en simulación.
- **R28.** Toda interfaz nueva o modificada cumple WCAG 2.1 AA y se opera entera con teclado (P14).
- **R36.** La copia local del catálogo (Historia 5) es **exclusivamente para la demo y el desarrollo**. Nada de lo que se integre por PR cambia a qué datos apuntan la app y el panel en su despliegue: con la configuración real, ambos leen los datos reales de producción. La copia local no puede activarse por accidente: requiere una configuración explícita de demo.
- **R29.** El proceso de carga tolera archivos de audio de cientos de MB y lotes de cientos de libros sin agotar la memoria del equipo que lo ejecuta (P11).

## 4. Decisiones previas (Prior decisions)
- **El esquema de producción manda** (P13, Opción A del módulo 13, recomendada): la ficha de un audiolibro es `nombre, autor, editorial, genero, descripcion`. Se construye sobre la Opción A; su confirmación formal es la decisión D1 del board (29/09).
- **Convención de audio:** las pistas viven en Blob bajo `{nombre exacto de la ficha}/{archivo}.mp3`. El nombre de la carpeta debe coincidir exactamente con el campo `nombre`. Esta coincidencia es la que hoy está rota en 42/24 casos.
- **La API de producción no se usa como intermediaria** para la carga (no tiene los endpoints de admin). El panel y la herramienta de carga escriben directo, con las validaciones de la API replicadas (P7).
- **Las aprobaciones son PRs** (2026-09-26, decisión de Nico): toda aprobación de escritura en producción se registra como documento en el repositorio `Nico-Rock/invision_bcc` y vale al integrarse su PR. Los PRs se revisan en las reuniones del equipo.
- **Origen de los ~700 títulos:** SharePoint/OneDrive de la BCC. Se trabaja sobre la carpeta sincronizada localmente por el cliente de OneDrive. La integración vía Microsoft Graph queda fuera de alcance.
- **Géneros nuevos se aceptan con advertencia** (2026-09-26): no se bloquea la carga por un género nuevo, pero se reporta para revisión.
- **Iniciativa "En Memoria"** (2026-09-26): registrar y preservar al narrador de cada audiolibro. Los títulos repetidos son legítimos cuando cambia el autor o el narrador.
- **El usuario admin temporal (id=92)** se mantiene para las cargas; su correo ya se corrigió a un dominio real.
- **El CSV `Catalogo digital Audioteca 2025(disponibles).csv` ya está cargado** (533 de 536 títulos presentes en producción). No es la fuente de los ~700 pendientes.

## 5. Lógica de decisión (Decision logic)

```
CUANDO se procesa una fila del manifiesto
  ¿faltan campos obligatorios o superan el largo de producción?   → sí: fila inválida, motivo, no se escribe nada de ella
  ¿el género no existe en el catálogo?                             → sí: se acepta con advertencia "género nuevo" (nunca en silencio)
  ¿ya existe un libro con el mismo título Y autor (normalizados)?  → sí: se omite e informa "ya existe"; no es un error
  ¿el título existe con otro autor/narrador y sin nombre distintivo? → sí: fila inválida, "título repetido: indicar nombre distintivo"
  ¿alguna pista está solo en la nube (sin descargar)?              → sí: fila inválida, "descargar la carpeta desde OneDrive" 
  ¿la carpeta de audio falta, está vacía o tiene pistas truncadas? → sí: fila inválida, motivo
  ¿el orden de pistas es ambiguo?                                  → sí: fila inválida, "orden no determinable"
  ¿es simulación?                                                  → sí: se informa lo que se haría; FIN
  ¿hay una aprobación integrada al repositorio para ESTE lote exacto? → no: se rechaza la ejecución real
ENTONCES se sube todo el audio de la fila (salteando pistas ya completas) y, solo cuando está completo, se crea su ficha

CUANDO el panel pide un dato que depende de una tabla que no existe en la base
  → la métrica se informa como "no disponible en esta base" con el motivo; el resto de la vista funciona

CUANDO la indexación de audio falla
  → el panel sigue atendiendo, informa el fallo y conserva el último índice válido (si lo hay), marcado con su fecha
```

**Promesas** (invariantes):
- **Cero escrituras en simulación.** Una ejecución en modo simulación no crea, modifica ni borra nada en la base ni en Blob.
- **Nunca un duplicado.** Ejecutar el mismo lote dos veces produce el mismo catálogo que ejecutarlo una vez.
- **Nunca un libro visible sin audio completo** como resultado de una carga.
- **Nunca una escritura en producción sin un PR de aprobación integrado** que corresponda exactamente a lo que se escribe.
- **Nunca se pierde un narrador informado:** si no se puede guardar en la base, queda en el informe del lote.
- **Nunca se pisa audio existente.** Una pista que ya está completa en Blob no se reemplaza.
- **Una fila mala no tumba una colección.** Ningún listado del panel ni de la API falla entero por una fila individual.
- **El panel nunca reporta éxito si falló.**

## 6. Desglose de tareas (Task breakdown, alto nivel)
- Resiliencia del panel ante el esquema de producción y la indexación de Blob.
- Motor de reconciliación catálogo ↔ audio, más su informe.
- Validador de manifiesto con las reglas de la API.
- Ejecutor de lotes retomable con simulación por defecto y registro de aprobación.
- Vistas accesibles del panel para validación de lotes y reconciliación, más el ajuste del formulario individual.
- Copia local del catálogo sin datos personales.
- Correcciones puntuales de API y frontend (correo en la salida, capítulos, géneros).
- Registro de aprobaciones en el repositorio y su verificación antes de escribir.
- Captura del narrador ("En Memoria") y propuesta de migración aditiva (estado de publicación + narrador).

## 7. Criterios de verificación (Verification criteria)
- **V1 (R1).** Contra producción, `/api/overview` responde sin error y marca las métricas sin tabla como no disponibles.
- **V2 (R2).** Contra producción, Registros de Acceso muestra "esta base no registra sesiones" y no un error SQL.
- **V3 (R3).** Con credenciales de Blob inválidas, el panel abre en menos de 5 s y reporta el fallo de indexación. No imprime ni muestra "indexado correctamente".
- **V4 (R4).** Si el refresco falla después de un índice válido, se conserva el anterior, marcado con su fecha.
- **V5 (R5, R6).** El informe contra producción lista las 42 fichas sin audio y las 24 carpetas sin ficha (o explica la diferencia con fecha), con sugerencias de coincidencia para los casos truncados conocidos.
- **V6 (R7).** Un test confirma que generar el informe no ejecuta escrituras.
- **V7 (R8).** El informe lista las variantes de género y los libros sin género.
- **V8 (R9, R10).** Un manifiesto de prueba con un título de 256 caracteres, un género fuera de la lista y un campo obligatorio vacío produce exactamente esos tres rechazos con su motivo.
- **V9 (R11).** Un manifiesto que apunta a una carpeta vacía, a una pista de 0 bytes o a pistas sin orden determinable produce los rechazos correspondientes.
- **V10 (R12).** Un título existente con otra capitalización o sin tildes se informa como "ya existe" y no se crea.
- **V11 (R13, R27).** Un test confirma que la simulación no ejecuta escrituras, y que la ejecución real sin aprobación registrada se rechaza.
- **V12 (R14).** Un test interrumpe un lote a mitad de camino, lo reanuda y verifica que no hay duplicados ni re-subidas de pistas completas.
- **V13 (R15).** Cada ejecución deja un informe persistente con creados, subidos, omitidos y fallos.
- **V14 (R16).** Un test con fallo de audio en un libro verifica que su ficha no se crea. La migración de estado de publicación existe como propuesta revisable (script más reversión), probada contra una copia local.
- **V23 (R30, R31).** Un test con dos filas de igual título y distinto narrador verifica que se crean dos fichas distinguibles o que se rechaza la fila sin nombre distintivo.
- **V24 (R33).** El informe "En Memoria" lista los libros con narrador desconocido o no informado.
- **V25 (R34).** Sin la migración aplicada, el narrador del manifiesto aparece en el informe del lote.
- **V26 (R32, R35).** Tests: la ejecución real se rechaza sin aprobación, con una aprobación de otro lote o con el lote modificado después de aprobado, y se permite con la aprobación correcta.
- **V27 (R11).** Un test con un archivo "solo en la nube" (marcador sin contenido local) produce el rechazo "descargar desde OneDrive".
- **V15 (R17).** El formulario individual envía editorial, no pide categoría, y rechaza un título de 256 caracteres con un mensaje anunciado.
- **V16 (R18, R19, R20, R28).** Verificación manual con VoiceOver: navegación con sección actual anunciada, validación de un manifiesto y lectura del informe de reconciliación, todo con teclado.
- **V17 (R21, R22).** Después de la copia local, el frontend muestra los géneros y títulos de producción, y una consulta sobre la base local no encuentra correos de socios.
- **V18 (R23).** Test de API: con un usuario de correo `.local` en la base, `GET /users/` responde 200 con todos los usuarios.
- **V19 (R24).** Test: un libro con pistas `Pista 1 … Pista 20` devuelve los índices 1 a 20 en orden.
- **V20 (R25).** El frontend no contiene nombres de género fijos en el código y muestra los que devuelve la API.
- **V21 (R26).** El Resumen muestra las horas de audio y los socios activos, con los cálculos documentados.
- **V28 (R36).** Revisión del diff del PR: ninguna configuración versionada apunta a la base local; sin la variable explícita de demo, la API y el panel usan la base real (test de la resolución de configuración).
- **V29 (R37).** El faro se ve detrás del contenido con opacidad 0,1; tiene `aria-hidden`; no aparece en alto contraste; el contraste del texto sobre el fondo se mantiene ≥ 4,5:1.
- **V30 (R38).** Con la copia local, `GET /books-by-genre/POESÍA` devuelve los mismos 11 libros que producción; en producción no cambia nada (el ajuste solo aplica a conexiones SQLite). `GET /stream-audio-simple/...` responde 200 con audio en local.
- **V31 (R39).** En la app local con la copia del catálogo, "A CARA DESCUBIERTA" muestra "SIDNEY SHELDON".
- **V32 (R40).** En el navegador: A+ lleva el texto de 16 a 18 px y se anuncia; se topa en 28 y en 12; el alto contraste pone fondo negro con texto blanco o amarillo y oculta el faro; con las señales apagadas no suena ningún earcon; al recargar se conservan las tres preferencias; a 28 px no hay scroll horizontal.
- **V33 (R41).** En el navegador: el primer Tab enfoca "Saltar al contenido principal"; las teclas 1 a 6 cambian de sección, la anuncian y la marcan con `aria-current`; escribir "3" en un campo del formulario no cambia de sección; ? abre la ayuda con el foco adentro, y Esc la cierra devolviendo el foco; con el reproductor abierto, Espacio pausa y la flecha derecha adelanta 15 s; con las señales apagadas, el foco no suena; el botón de micrófono existe y, si el navegador no soporta dictado, lo anuncia.
- **V34 (R28, R42).** Auditoría automática con axe-core (WCAG 2.0, 2.1 y 2.2, niveles A y AA): 0 violaciones en las 6 secciones del panel, en alto contraste y en el catálogo del sitio; con A+ al máximo, ningún texto del sitio queda en su tamaño original.
- **V22 (R29).** Subir una pista de más de 200 MB no eleva la memoria del proceso por encima de un margen acotado (el streaming se verifica en un test).

## Casos borde
1. **El mismo título de dos autores o narradores distintos:** es legítimo (R31). La carpeta de audio debe ser única, así que la fila exige un nombre distintivo.
2. **Nombres de carpeta con caracteres no válidos** en Blob o en un sistema de archivos (`/`, `?`, `#`): la validación los rechaza con motivo.
3. **Pistas con nombres sin número** o con numeración mixta (`Pista 1`, `Pista 1b`): orden ambiguo, la fila se rechaza.
4. **Planilla con codificación distinta** (el CSV actual viene en Windows-1252 con `;`): la lectura acepta ese formato y no corrompe tildes ni eñes.
5. **Corte de red a la mitad de una pista:** la pista incompleta no queda como válida y se vuelve a subir al retomar.
6. **Dos personas ejecutando el mismo lote a la vez:** no puede producir duplicados. Como la aprobación es por lote y la verificación de existencia se repite justo antes de cada escritura, una segunda ejecución solo encuentra elementos ya existentes y los omite. Además, se documenta que se ejecuta un lote a la vez.
7. **Grabación antigua sin narrador conocido:** se registra como "desconocido" y aparece en el informe "En Memoria".

## Aclaraciones abiertas
Resueltas el 2026-09-26: origen de los 700 (OneDrive/SharePoint sincronizado), visibilidad (doble garantía, R16), géneros (se aceptan con advertencia), títulos repetidos ("En Memoria", R31), concurrencia (caso borde 6), canal de aprobación (PR, R32).

Quedan para el board el 29/09. No bloquean la construcción, porque todo corre en simulación hasta entonces:
- **D1.** Confirmar la Opción A del módulo 13 (el esquema de producción manda).
- **D2.** Nombrar quién aprueba por la BCC los PRs de aprobación.
- **D3.** Aprobar o no la migración aditiva (estado de publicación + narrador).
