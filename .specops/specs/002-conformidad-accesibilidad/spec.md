# Spec — 002-conformidad-accesibilidad

> QUÉ y POR QUÉ. Sin detalle de implementación. Cada requisito tiene un ID estable (R#).
> Regla de decisión (constitución P17): **ante un conflicto entre marca o estética y accesibilidad, gana la accesibilidad.**
> Referencia normativa: marco del vault *Invision - Accesibilidad y Discapacidad Visual* (en adelante, "el marco") y WCAG 2.2.

**Status:** draft  **Author:** Nico (vía Claude Code)  **Date:** 2026-09-26  **Target delivery:** P1 antes de la reunión tripartita del 2026-09-29; P2 y P3 en la iteración siguiente
**Relación:** continúa el spec 001 (sus requisitos 28, 40, 41 y 42, y el hallazgo A12). No reemplaza nada de 001.

## Resumen ejecutivo e intención

El marco de accesibilidad describe una plataforma al 90 % de cumplimiento con WCAG 2.2 AA y AAA. Al medir el panel operativo y el sitio el 2026-09-26, la realidad es otra: ambos pasan la auditoría automática AA, pero incumplen puntos concretos del marco que afectan justamente a sus usuarios. El texto no llega al 200 %. Cada aviso interrumpe al lector de pantalla. El contraste no alcanza AAA en el modo estándar. Hay controles chicos, faltan atajos del reproductor, y en el sitio el filtro de géneros real es invisible. Además, el marco se contradice en dos datos: el naranja de marca no da 4,8:1 sino 4,54:1, y su rojo de error no llega a AAA.

**Hoy:** "cumple accesibilidad" es una afirmación sin evidencia completa → **Después:** cada criterio del marco tiene una medición que lo prueba, en las dos apps y en los dos modos.

## 0. Story — Historia

**Antes:** Una bibliotecaria de la BCC con baja visión severa abre el panel con el texto al máximo. Los botones del encabezado se salen de la pantalla. Cuando pasa con Tab por la barra lateral, el lector de pantalla corta la frase a la mitad porque llegó otro aviso. En alto contraste, las tarjetas se funden con el fondo negro y no sabe dónde termina una y empieza otra. Un compañero ciego, en el sitio, recorre con Tab el filtro de géneros y su colega con baja visión, al lado, ve que el foco "desaparece" 17 veces seguidas. Mientras tanto, el documento que se va a mostrar a la BCC dice que todo está al 90 %.

**Después:** La bibliotecaria sube el texto al 200 % y todo sigue en pantalla, reacomodado. Los avisos de estado esperan a que el lector termine; solo un error interrumpe. En alto contraste cada tarjeta se distingue del fondo y todo el texto supera 7:1. Con las flechas sube el volumen del audio de prueba y el panel le dice "volumen 60 %". En el sitio, el filtro de géneros se ve y se escucha igual. Y el documento del marco dice exactamente lo que se midió.

## 1. Resultados (Outcomes) — historias de usuario priorizadas

### Historia 1 [P1 — núcleo MVP] — Texto al 200 % sin pérdida
**Como** persona con baja visión, **quiero** agrandar el texto al doble, **para** leer sin lupa y sin perder contenido.

**Requisitos**
- **R1.** El control de tamaño de texto del panel llega a **200 %**, no solo a 175 %, y se expresa como **proporción del tamaño que la persona ya eligió en su navegador o sistema**: si su navegador está en 20 px, entrar al panel no la baja a 16 px.
- **R2.** Al 200 %, ningún contenido ni control queda fuera de la vista ni superpuesto: lo que no entra en una fila pasa a la siguiente (WCAG 1.4.4). Las tablas pueden desplazarse dentro de su propia región enfocable.
- **R3.** Con el zoom del navegador al 200 % en una pantalla de 1280 px (equivalente a 640 px de ancho), el panel se reacomoda sin scroll horizontal de página y sin perder funciones (WCAG 1.4.10).

**Criterios de aceptación**
- [ ] A 32 px, los botones del encabezado ("Ayuda de Atajos", "Refrescar Datos", "Sitio Oficial") siguen visibles y operables en las 6 secciones.

### Historia 2 [P1 — núcleo MVP] — Avisos que no atropellan
**Como** persona ciega que usa lector de pantalla, **quiero** que los avisos del panel no interrumpan lo que estoy escuchando, salvo que sea urgente, **para** no perder información a la mitad.

**Requisitos**
- **R4.** El panel tiene dos canales de aviso, como indica el marco: uno **cortés** (espera a que el lector termine) para estados, navegación, confirmaciones y progreso, y uno **urgente** (interrumpe) solo para errores y bloqueos.
- **R5.** Todo aviso de error (carga fallida, índice de audio caído, dictado no disponible, validación) usa el canal urgente. Ningún aviso que no sea un error lo usa.
- **R6.** Al abrir el panel solo se anuncia la bienvenida. Ninguna sección que cargue en segundo plano anuncia nada si no está a la vista.
- **R28.** Quien usa un lector de pantalla no escucha cada aviso dos veces. La lectura en voz del propio panel (pensada para personas mayores o con baja visión sin lector) es una preferencia aparte en la barra de accesibilidad ("Lectura en voz"), persistida como las demás. Las regiones vivas funcionan siempre, independientemente de esa preferencia.

**Criterios de aceptación**
- [ ] Recorrer la navegación con Tab no produce ningún aviso urgente.

### Historia 3 [P1 — núcleo MVP] — Contraste AAA en los dos modos
**Como** persona con baja visión o de edad avanzada, **quiero** que todo el texto tenga el máximo contraste, **para** leer sin esfuerzo en cualquier modo.

**Requisitos**
- **R7.** En el modo estándar, **todo el texto** del panel alcanza **7:1** (4,5:1 si es texto grande), sobre cada superficie donde aparece: blanco, crema y crema en hover (WCAG 1.4.6).
- **R8.** Los colores de marca que no llegan a ese contraste (el naranja `#D34500` da 4,54:1) se usan solo en elementos **sin texto**: bordes, líneas y decoración, con al menos 3:1 (WCAG 1.4.11). El texto, y los botones que llevan texto, usan la variante AAA del mismo tono.
- **R9.** El modo de alto contraste usa los tokens del marco: fondo `#000000`, superficies `#121212`, texto `#FFFFFF` y `#E0E0E0`, acento `#FFE600`, foco `#00FF66`. El rojo de error del marco (`#FF3333`, 5,77:1) no llega a AAA y se reemplaza por su variante AAA.
- **R10.** En alto contraste, las tarjetas, paneles y la barra del reproductor se distinguen del fondo por su superficie (`#121212`) **y** por su borde, no solo por el borde.
- **R11.** Ninguna información se transmite solo con color: cada estado (conectado, error, advertencia) lleva además texto o ícono (WCAG 1.4.1).

**Criterios de aceptación**
- [ ] El barrido de contraste de todos los textos visibles da 0 casos bajo AAA, en los dos modos y en las 6 secciones.

### Historia 4 [P2 — mejora] — Controles grandes y foco inconfundible
**Como** persona con baja visión o con dificultad motriz, **quiero** controles grandes y un foco que no se confunda con el borde, **para** acertar al primer intento y saber siempre dónde estoy.

**Requisitos**
- **R12.** Todo control principal mide al menos **48×48 px** (el marco; WCAG 2.5.5 AAA). Ningún control mide menos de 24×24 px (2.5.8 AA).
- **R13.** El foco visible es un anillo `#00FF66` de 4 px separado **4 px** del control, en todos los elementos enfocables del panel, incluidos los del navegador (reproductor nativo, campos, tablas) (2.4.7, 2.4.13).
- **R14.** Ningún elemento enfocado queda tapado por otro (barra del reproductor fija, encabezado) (2.4.11).
- **R26.** El indicador de foco tiene al menos **3:1 contra el fondo en los dos modos** (WCAG 1.4.11). El verde `#00FF66` del marco sobre blanco da solo 1,35:1, así que en el modo estándar el anillo verde va acompañado de un segundo anillo oscuro que garantiza el contraste; el verde se conserva porque es la señal que el marco enseña a reconocer.
- **R27.** Los tokens de foco se resuelven en el modo activo: no quedan reglas de alto contraste declaradas que no surten efecto (hoy `--focus-ring` se redefine en alto contraste, pero el anillo ya quedó resuelto en la raíz).

### Historia 5 [P2 — mejora] — Atajos completos del reproductor
**Como** persona ciega que revisa audios en el panel, **quiero** los mismos atajos del marco, **para** no tener que buscar controles.

**Requisitos**
- **R15.** Con el reproductor abierto: **↑ / ↓** suben y bajan el volumen de a 10 % y anuncian el nivel; **N / P** pasan a la pista siguiente o anterior del mismo libro y la anuncian; **M** silencia o restaura y lo anuncia.
- **R16.** La ventana de ayuda y la tabla de atajos incluyen estos atajos. Ningún atajo se activa mientras se escribe ni con modificadores (se mantiene el requisito 41 de 001).

### Historia 6 [P2 — mejora] — Movimiento reducido
**Como** persona con sensibilidad al movimiento o con baja visión, **quiero** que el panel respete la preferencia de mi sistema, **para** no marearme ni perder el foco en transiciones.

**Requisitos**
- **R17.** Si el sistema pide reducir el movimiento, el panel elimina transiciones y animaciones (WCAG 2.3.3).

### Historia 7 [P2 — mejora] — Estructura navegable
**Como** persona ciega, **quiero** saltar por regiones con mi lector, **para** llegar rápido a lo que busco.

**Requisitos**
- **R18.** El panel expone regiones con nombre: la barra de accesibilidad, la navegación ("Secciones del panel"), el contenido principal y un pie de página con la versión y el mandato de gobernanza.
- **R19.** El texto visible de cada control está contenido en su nombre accesible (WCAG 2.5.3): quien usa control por voz dice lo que ve.

### Historia 8 [P2 — mejora] — El sitio, conforme al mismo marco
**Como** socio de la BCC, **quiero** que el sitio público cumpla lo mismo que el panel, **para** que la biblioteca que uso sea la accesible.

**Requisitos**
- **R20.** El filtro de géneros real se ve y se escucha igual: ningún control enfocable queda dentro de una zona oculta a la vista (resuelve el hallazgo A12 de 001, WCAG 2.4.7). Absorbe la tarea T20 de 001.
- **R21.** El sitio cumple R1–R3 (200 %), R4–R6 y R28 (dos canales, sin duplicar avisos), R7–R11 (contraste AAA y tokens), R12–R14 y R26–R27 (objetivos y foco) y R15 (atajos del reproductor) del mismo modo que el panel. El tamaño de texto se expresa como proporción del tamaño que el usuario configuró en su navegador, no como píxeles fijos que lo pisan.
- **R29.** Los atajos del sitio funcionan como dicen: **S** enfoca el buscador real; **G/4** enfoca los géneros reales; **Espacio** controla el reproductor solo cuando el foco no está en un botón, enlace, campo o pestaña; **← / →** no actúan dentro de pestañas ni campos de selección; **Esc** cierra la ayuda o el reproductor y solo anuncia lo que realmente cerró. Hallado por la auditoría del 2026-09-26: el atajo S nunca funcionó y Espacio bloqueaba la activación de botones.
- **R30.** Toda ventana modal del sitio (ayuda, administración) atrapa el foco mientras está abierta, lo devuelve al control que la abrió y, mientras está cerrada, no es alcanzable con Tab ni con el lector de pantalla (WCAG 2.1.2, 2.4.3).
- **R31.** Las regiones del sitio son válidas: una sola región principal por pantalla, la barra de accesibilidad no anula el encabezado, y el pie existe aunque no haya un libro cargado.
- **R32.** Todo error del sitio se anuncia en el canal urgente, y los campos con error se marcan como inválidos y apuntan a su mensaje (WCAG 3.3.1). Hoy hay cargas que fallan en silencio (géneros, capítulos, listas de administración).

### Historia 10 [P1 — núcleo MVP] — Corrección de los defectos hallados en la revisión de 001
**Como** persona ciega o con baja visión que usa el panel, **quiero** que las ayudas incorporadas en 001 (sus requisitos 40 y 41) no me desorienten, **para** que ayuden en vez de estorbar. La revisión de código del 2026-09-26 encontró defectos que axe no detecta.

**Requisitos**
- **R34.** El dictado nunca captura la voz del propio panel: mientras el micrófono escucha, el panel no habla; la señal de "escuchando" es el sonido de dictado y el nombre del botón. Un segundo clic durante la escucha la detiene en lugar de abrir otra. Los errores distinguen "permiso de micrófono denegado" de "no se escuchó nada".
- **R35.** Un atajo que oculta el elemento enfocado (cambiar de sección, cerrar el reproductor) deja el foco en un lugar con sentido: el contenido principal de la nueva sección, o el control que abrió el reproductor. El foco nunca cae al documento vacío.
- **R36.** Los atajos no capturan teclas que otro control necesita: las flechas y Espacio no actúan cuando el foco está en una región desplazable, en el reproductor nativo o en un campo; Esc no actúa mientras se escribe (coherente con el requisito 41 de 001); mantener una tecla apretada no repite avisos ni sonidos; un avance que llega al final lo dice.
- **R37.** Las preferencias de accesibilidad (contraste, tamaño) se aplican antes de que la página se vea por primera vez: no hay destello en blanco para quien usa alto contraste.
- **R38.** Un aviso no corta a otro: los avisos de estado se suceden en orden; solo un error interrumpe (se apoya en R4).
- **R39.** Detalles de calidad hallados en la revisión: los atajos declarados son válidos para las tecnologías de asistencia; "Reproduciendo" se anuncia solo si el audio realmente empezó, y si falla se anuncia el error; los emojis de los botones no se leen como parte del nombre; el faro también se oculta con el alto contraste del sistema operativo; un tamaño guardado fuera de la escala se corrige al paso válido; si las preferencias no pueden guardarse, se avisa una sola vez; los textos de la ayuda, los anuncios y las teclas salen de una sola fuente.

**Criterios de aceptación**
- [ ] Con parlantes encendidos, dictar "Rayuela" busca "Rayuela" y nunca una frase del panel.
- [ ] Tras apretar 1 con el foco en un botón del Explorador, `document.activeElement` es el contenido principal.

### Historia 9 [P3 — opcional] — Accesibilidad verificable, no declarada
**Como** equipo tripartito, **quiero** que el cumplimiento se pruebe con evidencia repetible, **para** no volver a mostrar un porcentaje sin respaldo.

**Requisitos**
- **R22.** Existe un procedimiento de verificación repetible que cualquiera del equipo puede correr: auditoría automática, barrido de contraste en los dos modos, medición de objetivos y de reflow, y la matriz de prueba con lectores de pantalla del marco (VoiceOver, NVDA, TalkBack). Su resultado queda fechado.
- **R33.** El sitio tiene una forma automática de verificar su accesibilidad dentro de su propio repositorio (hoy no existe ningún test). El marco afirma que `@axe-core/react` está integrado, pero no figura en las dependencias.
- **R23.** El marco del vault se corrige con lo medido: el contraste real del naranja, el rojo que no llegaba a AAA, el estado real por app y la fecha de medición. El documento no puede prometer más de lo que la evidencia respalda.

## 2. Límites de alcance (Scope boundaries)

**Dentro del alcance**
- Panel operativo (Historias 1–7, P1 y P2), sitio público (Historia 8), procedimiento de verificación y corrección del marco (Historia 9).

**Fuera del alcance** (explícito)
- Rediseño estético del panel o del sitio más allá de lo que exige el contraste y el tamaño. No hay cambios de layout "porque se ve mejor" (P17 al revés: la accesibilidad no es excusa para rediseñar por gusto).
- Líneas Braille y magnificadores específicos (ZoomText): se prueban con el comportamiento estándar del sistema, sin adaptaciones propias.
- Desplegar el sitio o el panel a producción.
- Traducción a otros idiomas.

## 3. Restricciones (Constraints)
- **R24.** Ningún ajuste de este spec rompe lo ya verificado en 001: 0 violaciones de axe WCAG 2.2 AA, los atajos (requisito 41 de 001), las preferencias persistidas (requisito 40 de 001) y el faro (requisito 37 de 001).
- **R25.** Los cambios de color se aplican a través de los tokens (variables), no elemento por elemento, para que un solo cambio de token no deje textos sueltos sin cubrir.

## 4. Decisiones previas (Prior decisions)
- **La accesibilidad decide sobre la marca** (P17, instrucción de Nico, 2026-09-26). Por eso el naranja de texto pasa de `#D34500` (4,54:1) a su variante AAA, y el naranja original queda solo en elementos sin texto.
- **Negro y blanco puros en alto contraste**, aunque las guías generales de modo oscuro los desaconsejan por fatiga: el alto contraste es un modo que el usuario elige para baja visión, y el marco los pide. Gana el marco.
- **El 200 % es sobre el tamaño de texto de la barra y sobre el zoom del navegador**, no solo sobre uno de los dos.
- **Dos canales de aviso** según el marco (polite y assertive), en lugar del canal único actual.
- **Paleta AAA derivada con tono constante** (solo se oscurece, no se cambia el tono), para que la marca siga siendo reconocible.

## 5. Lógica de decisión (Decision logic)

```
CUANDO el panel necesita avisar algo
  ¿es un error o un bloqueo?               → sí: canal urgente (interrumpe)
                                           → no: canal cortés (espera)
  ¿la sección que avisa está a la vista?   → no: no avisa
ENTONCES se anuncia en el canal elegido, y por voz si está disponible

CUANDO se elige un color para un elemento
  ¿lleva texto?                            → sí: 7:1 sobre cada superficie donde aparece (4,5:1 si es grande)
                                           → no: 3:1 contra lo adyacente
  ¿el color de marca alcanza?              → no: variante del mismo tono que alcanza; la marca queda para lo sin texto
ENTONCES se usa a través de un token

CUANDO el texto o el zoom crecen
  ¿un grupo de controles no entra en su fila? → pasa a la línea siguiente; nunca se recorta
  ¿una tabla no entra?                     → se desplaza dentro de su región enfocable
```

**Promesas** (invariantes):
- **Nunca un texto bajo 7:1** (4,5:1 si es grande) en ningún modo.
- **Nunca un control fuera de la vista** con texto al 200 % o zoom al 200 %.
- **Nunca una interrupción que no sea un error.**
- **Nunca un control enfocable invisible.**
- **Nunca un foco tapado.**
- **Nunca una afirmación de cumplimiento sin su medición fechada.**

## 6. Desglose de tareas (Task breakdown, alto nivel)
- Tokens: paleta AAA estándar, alto contraste del marco con rojo corregido y superficies.
- Reflow: tope de texto 200 %, encabezado y grupos que pasan de línea, prueba a 640 px.
- Canales de aviso: cortés y urgente, con la clasificación de todos los avisos existentes.
- Objetivos de 48 px y foco 4/4 en todos los enfocables, más foco no tapado.
- Atajos del reproductor (↑↓, N/P, M) y su ayuda.
- Movimiento reducido y regiones con nombre, más la coincidencia del texto visible con el nombre accesible.
- Sitio: géneros visibles y el mismo paquete de ajustes.
- Procedimiento de verificación y corrección del marco.

## 7. Criterios de verificación (Verification criteria)
- **V1 (R1).** La barra lleva el texto a 32 px en 8 pasos desde 16 y se detiene ahí, anunciando el máximo.
- **V2 (R2).** A 32 px, la medición de elementos fuera de la vista da 0 en las 6 secciones (excluyendo el contenido interno de las regiones de tabla desplazables).
- **V3 (R3).** Con una vista de 640 px de ancho, no hay scroll horizontal de página y los 6 atajos de sección y los controles de la barra siguen operables.
- **V4 (R4, R5).** Hay exactamente dos regiones vivas (una cortés y una urgente). Una prueba provoca un error de carga y verifica que va al canal urgente, y otra cambia de sección y verifica que va al cortés.
- **V5 (R6).** Al cargar el panel, el único aviso emitido es la bienvenida.
- **V6 (R7, R8).** Barrido de contraste en modo estándar: 0 textos bajo 7:1 (o 4,5:1 si son grandes) en las 6 secciones y en hover. Ningún texto usa `#D34500`.
- **V7 (R9, R10).** En alto contraste: fondo `#000000`, tarjetas `#121212` con borde, acento `#FFE600`, error con al menos 7:1, y barrido de contraste en 0.
- **V8 (R11).** Revisión: cada indicador de estado tiene texto o ícono además del color.
- **V9 (R12).** La medición de objetivos da 0 controles principales bajo 48×48 y 0 controles de cualquier tipo bajo 24×24.
- **V10 (R13, R14).** Un recorrido real con Tab (teclas reales, no foco por código) registra en cada paso un anillo de 4 px `#00FF66` con separación de 4 px, y el elemento enfocado siempre visible dentro de la vista.
- **V11 (R15, R16).** Con teclas reales, en el reproductor: ↑ lleva el volumen de 50 % a 60 % y lo anuncia; N pasa a la pista 2 y la anuncia; M silencia y lo anuncia; la ayuda lista los tres.
- **V12 (R17).** Con `prefers-reduced-motion: reduce` emulado, ninguna transición dura más de 0,01 s.
- **V13 (R18, R19).** axe no reporta problemas de regiones. Cada control con nombre accesible distinto de su texto contiene ese texto (revisión automática sobre todos los botones).
- **V19 (R26, R27).** En el recorrido real con Tab, el contraste del indicador de foco contra el fondo inmediato es ≥ 3:1 en cada paso, en los dos modos; en alto contraste el anillo es `#00FF66`.
- **V20 (R28).** Con "Lectura en voz" apagada, no se llama a la síntesis de voz y las regiones vivas siguen recibiendo cada aviso; con la opción encendida, cada aviso se habla una sola vez.
- **V21 (R29).** Con teclas reales en el sitio: S enfoca el buscador del catálogo; Espacio sobre un botón lo activa (no pausa el audio); ← / → dentro de las pestañas de administración cambian de pestaña sin mover el audio; Esc sin nada abierto no anuncia nada.
- **V22 (R30).** Con la ayuda cerrada, Tab nunca llega a su botón. Con la ayuda abierta, Tab no sale de ella y al cerrarla el foco vuelve al disparador. Lo mismo en los modales de administración.
- **V23 (R31, R32).** axe sin problemas de regiones en login, catálogo y administración. Un error provocado en la carga de géneros se anuncia en el canal urgente, y un login inválido marca los campos con `aria-invalid`.
- **V24 (R33).** El sitio corre su verificación automática con un solo comando y falla si aparece una violación.
- **V25 (R34).** Prueba: al iniciar el dictado no se invoca la síntesis de voz hasta que termina la escucha; un segundo clic llama a `abort()`; el error `not-allowed` produce un aviso que menciona el permiso del micrófono.
- **V26 (R35).** Con teclas reales: foco en un botón del Explorador, tecla 1, el foco queda en el contenido principal; foco en "Cerrar" del reproductor, Esc, el foco vuelve al botón de pista que lo abrió.
- **V27 (R36).** Con el reproductor abierto y el foco en la tabla de usuarios, → desplaza la tabla y no el audio; con el foco en el reproductor nativo, Espacio lo maneja el reproductor (un solo cambio de estado); Esc en el buscador no cierra el reproductor; mantener → apretada produce un solo aviso.
- **V28 (R37).** Con alto contraste guardado, la primera captura de pantalla de la carga ya es negra.
- **V29 (R38).** Dos avisos cortés seguidos llegan completos y en orden a la región viva.
- **V30 (R39).** Revisión con lista: atajos declarados válidos, audio fallido anunciado como error, emojis ocultos al lector, faro oculto con `forced-colors`, tamaño guardado impar corregido, aviso único de preferencias no guardadas, una sola fuente de textos de atajos.
- **V14 (R20, R21).** En el sitio: 0 controles enfocables dentro de zonas `sr-only`; el filtro de géneros visible es el de la API; las mediciones V1–V11 aplicadas al sitio dan los mismos resultados.
- **V15 (R22).** El procedimiento de verificación existe, alguien distinto de quien lo escribió lo corre, y produce un informe fechado.
- **V16 (R23).** El marco del vault refleja las cifras medidas, el estado por app y la fecha.
- **V17 (R24).** axe WCAG 2.2 AA sigue en 0 violaciones en el panel (6 secciones y alto contraste) y en el sitio. Los tests del panel siguen verdes.
- **V18 (R25).** No quedan colores literales de texto fuera de los tokens (búsqueda en el CSS del panel).

## Casos borde
1. **Texto al 200 % más alto contraste más zoom del navegador** al mismo tiempo: se prueba la combinación, no cada ajuste por separado.
2. **Nombres de libro muy largos** en el explorador y en la barra del reproductor: se ajustan en varias líneas y nunca se cortan sin alternativa.
3. **Volumen en los extremos:** ↑ en 100 % y ↓ en 0 % anuncian el límite y no hacen nada más.
4. **N en la última pista y P en la primera:** anuncian que no hay otra pista.
5. **Varios avisos seguidos en el canal cortés:** se encolan sin perderse; el urgente los corta.
6. **Voz del navegador desactivada o sin sintetizador:** las regiones vivas siguen funcionando igual (el canal principal es el lector de pantalla, no la voz del navegador).

## Aclaraciones abiertas
- Ninguna que bloquee. La prueba con lectores de pantalla reales (R22) requiere a una persona; se registra quién la hizo y cuándo.
