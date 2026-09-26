# Spec — 001-biblioteca-actualizada

> QUÉ y POR QUÉ. Sin stack, sin estructura de archivos, sin detalle de implementación.
> Dudas marcadas inline como [NEEDS-CLARIFY]. Cada requisito tiene un ID estable (R#).

**Status:** draft  **Author:** Nico (vía Claude Code)  **Date:** 2026-09-26  **Target delivery:** demo en la reunión tripartita del 2026-09-29; despliegue a producción solo tras la aprobación BCC (P12)

## Resumen ejecutivo e intención

Invision cumple un año. El catálogo en producción tiene 538 títulos, pero el catálogo y el audio no coinciden: **42 libros aparecen en el catálogo sin audio** y **24 carpetas de audio no tienen ficha**. Vienen unos 700 títulos más, y hoy el único camino para cargarlos es manual (un INSERT a la vez, más un script con los títulos escritos a mano), un camino que ya produjo un incidente en producción. El panel operativo, que debería mostrar todo esto, muestra un error en su primera pantalla.

**Hoy:** cargar un libro es artesanal, el catálogo tiene huecos que nadie ve y el panel falla al abrirse → **Después:** un proceso de carga por lotes que valida antes de escribir, un catálogo reconciliado y un panel que dice la verdad sobre el estado de la biblioteca.

## 0. Historia

**Antes:** Un socio ciego de la BCC busca por voz un título que le recomendaron, lo encuentra en el catálogo y le da reproducir. No pasa nada: el libro tiene ficha pero no tiene audio (es uno de los 42). No hay forma de saber si es un error suyo o de la biblioteca. Mientras tanto, la bibliotecaria tiene en un disco 700 audiolibros nuevos listos para compartir y ninguna forma segura de subirlos sin pedirle a Nico que escriba SQL a mano, libro por libro. Cuando por fin se suben 4, una fila mal cargada tumba el listado de usuarios del panel durante días.

**Después:** La bibliotecaria prepara una planilla con los títulos del lote. La herramienta de carga la revisa completa antes de tocar nada y le dice, en lenguaje claro y por voz, qué 12 filas tienen problemas y por qué (título demasiado largo, género fuera de la lista, carpeta sin audio, pista cortada). Corrige, vuelve a revisar, y con la aprobación registrada el lote sube. Si se corta internet a la mitad, retoma donde quedó. El socio que buscaba ese título lo encuentra y lo escucha. Y el panel muestra, para el aniversario, cuántos libros hay, cuántas horas de audio y cuántos quedan pendientes de reconciliar.

## 1. Resultados — historias de usuario priorizadas

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
- **R9.** El lote se describe con una planilla (manifiesto): una fila por libro, con título, autor, editorial, género, descripción y la ubicación de su carpeta de audio. No hay títulos escritos en el código.
- **R10.** Cada fila se valida con las mismas reglas que aplica la API al leer y escribir (P7): campos obligatorios, largos máximos de las columnas de producción (título y autor hasta 255 caracteres, género hasta 100) y género dentro de la lista vigente del catálogo.
- **R11.** La validación también revisa el audio: la carpeta existe, tiene pistas de audio válidas, ninguna está vacía o truncada y el orden de las pistas se puede determinar sin ambigüedad.
- **R12.** Un título que ya existe en el catálogo (comparado sin distinguir mayúsculas, tildes ni signos) no se duplica: se informa y se omite.
- **R13.** La simulación es el modo por defecto: produce el informe completo de qué se crearía, qué se omitiría y qué falla, sin escribir nada. Escribir en producción exige una acción explícita, distinta de la simulación, que queda registrada con quién la aprobó y cuándo (P12).
- **R14.** La carga es retomable: si se interrumpe, al volver a ejecutarla continúa donde quedó, sin duplicar fichas ni volver a subir el audio que ya estaba completo.
- **R15.** Al terminar cada lote queda un informe persistente: fichas creadas, pistas subidas, omitidos, fallos y motivos. Es la evidencia para la BCC.
- **R16.** Una ficha nunca queda visible para los socios sin su audio completo. Si el audio de un libro falla, ese libro no queda como "ficha sin audio". [NEEDS-CLARIFY: ¿se crea la ficha solo al final, cuando el audio está completo, o se crea antes y se marca como no publicada? Producción no tiene un campo de estado de publicación.]

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

**Criterios de aceptación**
- [ ] Con VoiceOver, una persona puede ir de la navegación a la validación de un manifiesto y escuchar el resumen sin usar el mouse.

### Historia 5 [P2 — mejora] — Catálogo real en el entorno local
**Como** desarrollador y presentador de la demo, **quiero** que la aplicación local muestre el catálogo real, **para** mostrar el rediseño visual con datos verdaderos sin conectar el entorno local a producción.

**Requisitos**
- **R21.** Existe una forma repetible de copiar el catálogo de producción (fichas y géneros) al entorno local leyendo producción solo con consultas de lectura.
- **R22.** La copia local no incluye datos personales de los socios (correos, nombres, teléfonos, progreso de escucha). El acceso local usa cuentas de demostración creadas para ese fin (P9).

**Criterios de aceptación**
- [ ] Después de la copia, el frontend local lista los mismos géneros y títulos que producción.
- [ ] La base local no contiene ningún correo de un socio real.

### Historia 6 [P2 — mejora] — Deuda estructural que puede volver a romper producción
**Como** equipo de Invision, **quiero** cerrar las trampas conocidas del código, **para** que un dato raro no vuelva a tumbar una pantalla completa.

**Requisitos**
- **R23.** Los listados de usuarios no fallan por completo porque una fila tenga un correo que el validador de entrada rechazaría. La validación de formato de correo aplica a la entrada, no a la salida.
- **R24.** El número de capítulo de cada pista se obtiene del nombre del archivo sin confundirlo con la extensión, y el orden resultante es el correcto para nombres como `Pista 1 … Pista 20`.
- **R25.** Los géneros que muestra el frontend salen del catálogo, no de una lista fija en el código (P2).

**Criterios de aceptación**
- [ ] Una base de prueba con un usuario de correo `.local` devuelve el listado completo sin error.
- [ ] Un libro con 20 pistas devuelve los índices 1 a 20 en orden.

### Historia 7 [P3 — opcional] — Cifras del aniversario
**Como** equipo de Invision, **quiero** cifras reales del año (títulos, horas de audio, socios activos), **para** comunicar el aniversario con datos verificables.
- **R26.** El Resumen Ejecutivo muestra las horas totales de audio y los socios con actividad de escucha, además de los totales que ya muestra.

## 2. Límites de alcance

**Dentro del alcance**
- Panel operativo (`admin-dashboard`), la herramienta de carga por lotes, el informe de reconciliación, la copia local del catálogo, las correcciones puntuales de API y frontend de la Historia 6.

**Fuera del alcance** (explícito)
- **Modificar el esquema de producción** (crear `categorias`, `clasificaciones`, `sesiones_acceso` o `categoria_id`): es la Opción C del módulo 13 y requiere su propio proyecto y la decisión del board.
- **Aplicar correcciones de reconciliación o cargar lotes en producción durante esta entrega.** Esta entrega construye y demuestra en simulación; la ejecución real espera la aprobación BCC (P12).
- **Desplegar la API ni el frontend a producción.** La API de producción es una versión vieja; actualizarla es una decisión aparte.
- Ingesta real desde SharePoint (hoy es un mock), refresh tokens, el Bibliotecario Digital con IA.
- Rediseño visual adicional del frontend más allá de R25.

## 3. Restricciones
- **R27.** Ninguna operación de esta entrega escribe en producción sin aprobación registrada. Todo lo que puede escribir en producción arranca en simulación.
- **R28.** Toda interfaz nueva o modificada cumple WCAG 2.1 AA y se opera entera con teclado (P14).
- **R29.** El proceso de carga tolera archivos de audio de cientos de MB y lotes de cientos de libros sin agotar la memoria del equipo que lo ejecuta (P11).

## 4. Decisiones previas
- **El esquema de producción manda** (P13, Opción A del módulo 13, recomendada): la ficha de un audiolibro es `nombre, autor, editorial, genero, descripcion`. [NEEDS-CLARIFY: confirmar la Opción A con el board en la reunión del 29/09.]
- **Convención de audio:** las pistas viven en Blob bajo `{nombre exacto de la ficha}/{archivo}.mp3`. El nombre de la carpeta debe coincidir exactamente con el campo `nombre`. Esta coincidencia es la que hoy está rota en 42/24 casos.
- **La API de producción no se usa como intermediaria** para la carga (no tiene los endpoints de admin). El panel y la herramienta de carga escriben directo, con las validaciones de la API replicadas (P7).
- **El usuario admin temporal (id=92)** se mantiene para las cargas; su correo ya se corrigió a un dominio real.
- **El CSV `Catalogo digital Audioteca 2025(disponibles).csv` ya está cargado** (533 de 536 títulos presentes en producción). No es la fuente de los ~700 pendientes.

## 5. Lógica de decisión

```
CUANDO se procesa una fila del manifiesto
  ¿faltan campos obligatorios o superan el largo de producción?   → sí: fila inválida, motivo, no se escribe nada de ella
  ¿el género no está en la lista vigente?                          → sí: fila inválida (no se crean géneros nuevos en silencio)
  ¿el título ya existe (normalizado)?                              → sí: se omite e informa "ya existe"; no es un error
  ¿la carpeta de audio falta, está vacía o tiene pistas truncadas? → sí: fila inválida, motivo
  ¿el orden de pistas es ambiguo?                                  → sí: fila inválida, "orden no determinable"
  ¿es simulación?                                                  → sí: se informa lo que se haría; FIN
  ¿hay aprobación registrada para este lote?                       → no: se rechaza la ejecución real
ENTONCES se sube el audio de la fila (salteando pistas ya completas) y la ficha queda visible solo cuando su audio está completo

CUANDO el panel pide un dato que depende de una tabla que no existe en la base
  → la métrica se informa como "no disponible en esta base" con el motivo; el resto de la vista funciona

CUANDO la indexación de audio falla
  → el panel sigue atendiendo, informa el fallo y conserva el último índice válido (si lo hay), marcado con su fecha
```

**Promesas** (invariantes):
- **Cero escrituras en simulación.** Una ejecución en modo simulación no crea, modifica ni borra nada en la base ni en Blob.
- **Nunca un duplicado.** Ejecutar el mismo lote dos veces produce el mismo catálogo que ejecutarlo una vez.
- **Nunca un libro visible sin audio completo** como resultado de una carga.
- **Nunca se pisa audio existente.** Una pista que ya está completa en Blob no se reemplaza.
- **Una fila mala no tumba una colección.** Ningún listado del panel ni de la API falla entero por una fila individual.
- **El panel nunca reporta éxito si falló.**

## 6. Desglose de tareas (alto nivel)
- Resiliencia del panel ante el esquema de producción y la indexación de Blob.
- Motor de reconciliación catálogo ↔ audio, más su informe.
- Validador de manifiesto con las reglas de la API.
- Ejecutor de lotes retomable con simulación por defecto y registro de aprobación.
- Vistas accesibles del panel para validación de lotes y reconciliación, más el ajuste del formulario individual.
- Copia local del catálogo sin datos personales.
- Correcciones puntuales de API y frontend (correo en la salida, capítulos, géneros).

## 7. Criterios de verificación
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
- **V14 (R16).** Un test con fallo de audio en un libro verifica que ese libro no queda visible en el catálogo.
- **V15 (R17).** El formulario individual envía editorial, no pide categoría, y rechaza un título de 256 caracteres con un mensaje anunciado.
- **V16 (R18, R19, R20, R28).** Verificación manual con VoiceOver: navegación con sección actual anunciada, validación de un manifiesto y lectura del informe de reconciliación, todo con teclado.
- **V17 (R21, R22).** Después de la copia local, el frontend muestra los géneros y títulos de producción, y una consulta sobre la base local no encuentra correos de socios.
- **V18 (R23).** Test de API: con un usuario de correo `.local` en la base, `GET /users/` responde 200 con todos los usuarios.
- **V19 (R24).** Test: un libro con pistas `Pista 1 … Pista 20` devuelve los índices 1 a 20 en orden.
- **V20 (R25).** El frontend no contiene nombres de género fijos en el código y muestra los que devuelve la API.
- **V21 (R26).** El Resumen muestra las horas de audio y los socios activos, con los cálculos documentados.
- **V22 (R29).** Subir una pista de más de 200 MB no eleva la memoria del proceso por encima de un margen acotado (el streaming se verifica en un test).

## Casos borde
1. **El mismo título de dos autores distintos** (dos ediciones): hoy la carpeta de audio es solo el título, así que colisionarían. [NEEDS-CLARIFY: ¿puede haber dos libros con el mismo nombre? Si sí, la convención de carpetas tiene que cambiar.]
2. **Nombres de carpeta con caracteres no válidos** en Blob o en un sistema de archivos (`/`, `?`, `#`): la validación los rechaza con motivo.
3. **Pistas con nombres sin número** o con numeración mixta (`Pista 1`, `Pista 1b`): orden ambiguo, la fila se rechaza.
4. **Planilla con codificación distinta** (el CSV actual viene en Windows-1252 con `;`): la lectura acepta ese formato y no corrompe tildes ni eñes.
5. **Corte de red a la mitad de una pista:** la pista incompleta no queda como válida y se vuelve a subir al retomar.
6. **Dos personas ejecutando el mismo lote a la vez:** no puede producir duplicados. [NEEDS-CLARIFY: ¿alcanza con documentar que se ejecuta de a uno, o se necesita un bloqueo?]

## Aclaraciones abiertas
- [NEEDS-CLARIFY: ¿Dónde están los ~700 audiolibros pendientes (disco, SharePoint, Drive) y en qué formato viene su metadata? Condiciona R9 y R11.]
- [NEEDS-CLARIFY: ¿La Opción A del módulo 13 se confirma en la reunión del 29/09?]
- [NEEDS-CLARIFY: Ficha visible solo con audio completo (R16): ¿crear al final o crear oculta?]
- [NEEDS-CLARIFY: ¿Cuál es la lista vigente de géneros, y se unifican las variantes (`DESARROLLO PERSONAL` → `DESARROLLO PERSONAL Y BIENESTAR`, `NO FICCIÓN ENSAYO` → `NO FICCIÓN Y ENSAYO`)?]
- [NEEDS-CLARIFY: ¿Quién de la BCC aprueba las escrituras en producción y cómo queda registrada la aprobación?]
- [NEEDS-CLARIFY: Títulos duplicados entre autores (caso borde 1) y ejecución concurrente (caso borde 6).]
