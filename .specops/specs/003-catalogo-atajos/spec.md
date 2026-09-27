# Spec — 003-catalogo-atajos

> QUÉ y POR QUÉ. Sin tecnología: eso va en el plan.
> Constitución: `.specops/constitution.md` v1.2.0 (P12 nada en producción sin aprobación BCC, P13 el esquema de producción manda, P14 WCAG 2.2, P17 la accesibilidad decide sobre la marca).

**Status:** draft  **Author:** Nico (vía Claude Code)  **Date:** 2026-09-26  **Target delivery:** local para la reunión del 29/09; producción solo con PR aprobado por la BCC

## Executive summary & intent

**Today:** los atajos de teclado del sitio y del panel están escritos en el código. Cambiar una tecla requiere un programador y un despliegue, y varias teclas sueltas (S, H, 1–6, G) chocan con los comandos de los lectores de pantalla.  →  **After:** el administrador tiene un catálogo de teclas, funciones y acciones. Ahí asigna, cambia o apaga cada atajo de las dos apps, y el sistema le impide elegir combinaciones que rompan el lector de pantalla o el estándar.

## 0. Story

**Before:** Rosa, socia de la BCC, usa NVDA. En el catálogo presiona la H para saltar al siguiente título, que es el comando de NVDA en modo lectura. A veces NVDA se la come y a veces el sitio le abre la ayuda. Nadie en el equipo puede cambiar esa tecla sin pedírselo al programador.

**After:** el administrador entra a "Atajos de teclado" y ve cada acción con su tecla. Le asigna a "Abrir ayuda" la combinación Alt + Mayúscula + H. Si intenta dejar la H sola, el sistema le explica por qué no se puede. Rosa recarga el sitio: la H vuelve a ser de NVDA, la ayuda se abre con la nueva combinación, y la ventana de ayuda y los anuncios dicen la tecla correcta.

## 1. Outcomes — Prioritized user stories

### Story 1 [P1 — MVP core] — El administrador edita el catálogo
**As a** administrador de Invision, **I want to** ver y editar desde el administrador el catálogo de acciones con sus teclas, para el sitio y para el panel, **so that** los atajos se adapten a los lectores de pantalla de los socios sin tocar código.

**Requirements**
- **R1.** El catálogo lista cada acción disponible, separada por app (sitio y panel), con su nombre, su descripción, su alcance (global o solo con el foco en el reproductor), su combinación de teclas actual y si está activa.
- **R2.** Las acciones son un conjunto cerrado que define el sistema. El administrador asigna teclas, activa o desactiva acciones y edita la descripción que se lee en la ayuda; no crea funciones nuevas.
- **R3.** Solo una cuenta con rol Admin puede modificar el catálogo. Cualquier otra lectura o intento de escritura sin ese rol se rechaza.
- **R4.** La combinación se puede ingresar presionándola (captura) o escribiéndola. Las dos vías producen el mismo resultado y se leen igual con lector de pantalla.
- **R5.** Cada cambio se guarda solo si pasa todas las reglas de la Historia 4; si no, se dice cuál regla falló y con qué otra acción choca, y nada se guarda a medias.
- **R6.** La pantalla de edición cumple el mismo estándar que el resto (spec 002): contraste AAA, 48 px, foco visible, errores por el canal urgente y campos marcados.

**Acceptance criteria**
- [ ] Un administrador cambia la tecla de "Ir al buscador" del sitio y al recargar el sitio funciona la nueva y no la vieja.
- [ ] Una cuenta sin rol Admin no puede guardar cambios.

### Story 2 [P1 — MVP core] — El sitio usa el catálogo
**As a** socio o socia de la BCC que usa lector de pantalla, **I want to** que los atajos del sitio sean los que definió el administrador, **so that** no choquen con mi lector y siempre sepa cuáles son.

**Requirements**
- **R7.** El sitio toma sus atajos del catálogo al cargar: las teclas que responden, las que muestra la ayuda, las que declara cada control (`aria-keyshortcuts`) y las que menciona en voz son siempre las mismas.
- **R8.** Una acción desactivada no responde a ninguna tecla y no aparece en la ayuda.
- **R9.** Si el catálogo no se puede obtener, el sitio usa los atajos por defecto del sistema: nunca queda sin atajos ni con atajos a medias.
- **R10.** Las acciones de alcance "reproductor" responden solo mientras el foco está dentro del reproductor.

**Acceptance criteria**
- [ ] Con el catálogo modificado, la ventana de ayuda muestra exactamente las teclas del catálogo.
- [ ] Con la API caída, los atajos por defecto funcionan.

### Story 3 [P1 — MVP core] — El panel usa el catálogo
**As a** persona del equipo operativo, **I want to** que el panel responda a los atajos definidos en el mismo catálogo, **so that** el equipo trabaje con las mismas reglas que los socios.

**Requirements**
- **R11.** El panel toma sus atajos de la sección "panel" del catálogo, con las mismas garantías que el sitio (R7 a R10).
- **R12.** El panel sigue siendo de solo lectura sobre producción: lee el catálogo, pero no lo modifica. La edición se hace desde el administrador del sitio.
- **R13.** Si la base todavía no tiene el catálogo (producción antes del PR), el panel funciona con los atajos por defecto y lo dice en su estado, sin error.

### Story 4 [P1 — MVP core] — Reglas que protegen a quien usa lector de pantalla
**As a** socio o socia que usa lector de pantalla, **I want to** que el catálogo no permita combinaciones que rompan mi lector o el estándar, **so that** ningún cambio del administrador me deje sin poder usar el sitio.

**Requirements**
- **R14.** Una acción global necesita al menos un modificador que no escriba texto (Alt, Mayúscula junto con Alt, Control o Comando según la regla del plan). Las teclas sueltas y las letras solas solo se permiten en acciones de alcance "reproductor" (WCAG 2.1.4).
- **R15.** No se permiten combinaciones reservadas por los lectores de pantalla o por el navegador: Insert y Bloq Mayús (teclas de NVDA y JAWS), Control + Opción (VoiceOver), Tab, Mayúscula + Tab, Enter, las combinaciones de Control o Comando que usa el navegador, y F1 a F12. La lista vive en un solo lugar y se muestra al administrador.
- **R16.** Dos acciones de la misma app y alcance no pueden compartir combinación.
- **R17.** "Abrir ayuda de atajos" siempre tiene una combinación activa: no se puede desactivar ni quedar sin tecla.
- **R18.** Escape se reserva para cerrar: solo lo puede usar la acción "Cerrar".

### Story 5 [P2 — Enhancement] — Llegada a producción por el camino aprobado
**As a** equipo tripartito, **I want to** que el catálogo llegue a producción solo con el PR aprobado por la BCC, **so that** se respete el principio de cero riesgo en producción.

**Requirements**
- **R19.** El cambio de esquema en producción (tabla del catálogo) se entrega como un script explícito, con su reversión, en un documento de aprobación. Ningún despliegue lo crea por su cuenta sin esa aprobación.
- **R20.** Sin la tabla en la base, la API responde el catálogo por defecto y rechaza la edición con un mensaje claro ("el catálogo todavía no está habilitado en esta base").
- **R21.** En local (SQLite de la demo) el catálogo funciona completo para mostrarlo el 29/09.

### Story 6 [P2 — Enhancement] — Registro de cambios
**As a** administrador, **I want to** saber quién cambió cada atajo y cuándo, **so that** se pueda revisar o revertir un cambio que perjudicó a los socios.

**Requirements**
- **R22.** Cada combinación guardada registra quién la cambió, cuándo y cuál era la anterior; el administrador ve ese historial en la misma pantalla.

### Story 7 [P3 — Optional / nice to have] — Volver a los valores por defecto
**As a** administrador, **I want to** restaurar los atajos por defecto de una acción o de toda una app, **so that** pueda deshacer una configuración que no funcionó.

**Requirements**
- **R23.** Restaurar vuelve a las teclas por defecto del sistema, pasa por las mismas reglas y queda en el historial.

## 2. Scope boundaries
**In scope**
- Catálogo de acciones existentes del sitio y del panel (navegación, buscador, géneros, ayuda, cerrar, reproductor).
- Pantalla de edición en el administrador del sitio.
- Lectura del catálogo en el sitio y en el panel, con valores por defecto.
- Reglas de validación (Historia 4), historial y restauración.
- Script de esquema y documento de aprobación para producción.

**Out of scope** (explicit — this is what stops the agent over-building)
- Personalización por usuario: por decisión de Nico del 2026-09-26, solo el administrador cambia teclas (ver decisión y riesgo en §4).
- Crear acciones o funciones nuevas desde el administrador.
- Comandos de voz o gestos táctiles.
- Aplicar el esquema en producción: se entrega el script, no se ejecuta.
- Cambios en vivo sin recargar la página.

## 3. Constraints
- **R24.** Nada toca la base de producción sin aprobación BCC registrada (P12). Mientras tanto, la app de producción debe seguir funcionando igual que hoy (P13).
- **R25.** El texto que escribe el administrador (descripciones) se muestra siempre como texto, nunca como HTML (CWE-79), y todo lo que llega a la API se valida en el servidor (CWE-20), no solo en el navegador.
- **R26.** Las verificaciones del spec 002 no retroceden: axe en 0, contraste AAA, 48 px y dos regiones vivas en las dos apps.

## 4. Prior decisions
- **Alcance:** sitio y panel, un solo catálogo con una sección por app (Nico, 2026-09-26).
- **Quién edita:** solo el administrador (Nico, 2026-09-26). WCAG 2.1.4 pide que la persona usuaria pueda apagar o reasignar los atajos de un carácter. Como no habrá personalización por usuario, la conformidad se obtiene por la otra vía que admite el criterio: **los atajos globales siempre llevan modificador y las teclas sueltas solo actúan con el foco en el reproductor** (R10, R14). Queda como decisión A5 para la reunión.
- **Guardado:** base de datos vía PR aprobado por la BCC; en local con SQLite para la demo (Nico, 2026-09-26).
- **Proceso:** spec 003 aprobado antes de escribir código (Nico, 2026-09-26).
- Del spec 002: fuente única de atajos por app, textos de ayuda generados, dos canales de aviso y guardas de teclado (no mientras se escribe, no con el foco en un diálogo o un audio).

## 5. Decision logic

```
WHEN el administrador guarda una combinación para una acción
  ¿tiene rol Admin?                               → no: se rechaza, nada cambia
  ¿la base tiene el catálogo habilitado?          → no: se rechaza con "todavía no está habilitado en esta base"
  ¿la combinación está bien formada?              → no: se rechaza diciendo qué parte no se entiende
  ¿es reservada (lector de pantalla o navegador)? → sí: se rechaza nombrando quién la usa
  ¿la acción es global y la combinación no tiene modificador?  → sí: se rechaza citando WCAG 2.1.4
  ¿es Escape y la acción no es "Cerrar"?          → sí: se rechaza
  ¿otra acción de la misma app y alcance ya la usa? → sí: se rechaza nombrando esa acción
  ¿la acción es "Abrir ayuda" y queda sin tecla o desactivada? → sí: se rechaza
THEN se guarda, se registra quién, cuándo y el valor anterior, y rige desde la próxima carga de cada app

WHEN una app carga
  ¿se obtuvo el catálogo completo y válido?       → no: usa los valores por defecto del sistema
THEN teclas, ayuda, aria-keyshortcuts y anuncios salen de esa misma fuente

WHEN la persona presiona una combinación
  ¿está escribiendo, en un diálogo o en un audio? → sí: no se hace nada
  ¿la acción es de alcance reproductor y el foco no está en el reproductor? → sí: no se hace nada
THEN se ejecuta la acción asignada y se anuncia por el canal cortés
```

**Promises:**
- Nunca dos acciones de la misma app y alcance con la misma combinación.
- Nunca un atajo global sin modificador.
- Nunca sin forma de abrir la ayuda.
- Nunca una app sin atajos por falta del catálogo.
- Nunca un cambio en producción sin aprobación.
- Lo que se muestra, lo que se anuncia y lo que responde son siempre la misma tecla.

## 6. Task breakdown (high level)
- Catálogo de acciones con sus valores por defecto conformes a las reglas.
- Reglas de validación como pieza única, compartida por la API y la pantalla.
- Almacenamiento con historial, script de esquema y documento de aprobación.
- Servicio de lectura y edición del catálogo.
- Consumo en el sitio y en el panel.
- Pantalla de edición en el administrador del sitio.
- Verificación: tests, arnés del sitio, recorrido del panel y matriz de lectores.

## 7. Verification criteria
- **V1 (R1, R2).** El catálogo que devuelve el sistema tiene todas las acciones de las dos apps con nombre, descripción, alcance, combinación y estado; no hay forma de agregar una acción que no exista.
- **V2 (R3).** Guardar sin sesión o con una cuenta sin rol Admin devuelve un rechazo y el catálogo no cambia.
- **V3 (R4).** La misma combinación ingresada por captura y por texto produce el mismo valor guardado.
- **V4 (R5, R14–R18).** Cada regla tiene un caso que la viola y es rechazado con un mensaje que la nombra, y un caso que la cumple y se guarda.
- **V5 (R6, R26).** La pantalla de edición y las dos apps pasan axe en 0, contraste AAA y 48 px en los dos modos.
- **V6 (R7, R11).** Tras cambiar una combinación, la tecla nueva ejecuta la acción, la vieja no, y la ayuda, el `aria-keyshortcuts` y el anuncio dicen la nueva.
- **V7 (R8).** Una acción desactivada no responde y no figura en la ayuda.
- **V8 (R9, R13, R20).** Sin catálogo (API caída o tabla inexistente) las dos apps funcionan con los valores por defecto y la edición dice que no está habilitada.
- **V9 (R10).** Una acción de reproductor no responde con el foco fuera del reproductor y sí responde dentro.
- **V10 (R12).** El panel no expone ninguna forma de escribir el catálogo.
- **V11 (R19, R24).** Existe el script de esquema con su reversión y su documento de aprobación; arrancar la API contra una base sin la tabla no la crea.
- **V12 (R21).** En la base local de la demo el ciclo completo (editar, recargar, usar) funciona.
- **V13 (R22).** Después de dos cambios sobre una acción, el historial muestra los dos, con quién, cuándo y el valor anterior.
- **V14 (R23).** Restaurar una acción y una app completa vuelve a los valores por defecto y queda en el historial.
- **V15 (R25).** Una descripción con `<img onerror>` se muestra como texto en la ayuda y en la pantalla de edición; la API rechaza combinaciones mal formadas aunque la pantalla se saltee.

## Edge cases
1. Dos administradores editan a la vez la misma acción: gana el último en guardar y el historial registra los dos cambios.
2. El administrador asigna una combinación que un navegador concreto usa pero no está en la lista de reservadas: se guarda; el riesgo se cubre con la matriz de lectores y la lista se amplía.
3. Distribución de teclado distinta (español, latinoamericano, inglés): la combinación se identifica por la tecla física, no por el carácter, para que Alt + Mayúscula + una letra funcione igual en todas.
4. El catálogo por defecto cambia en una versión nueva: las acciones nuevas aparecen con su tecla por defecto; las que el administrador ya cambió conservan su valor.
5. Una acción queda sin combinación porque su tecla fue tomada por otra: no se permite; hay que liberar primero la otra.

## Open clarifications
- Sin preguntas bloqueantes. La elección exacta del modificador por defecto (Alt + Mayúscula) se valida en la prueba con lectores de pantalla (matriz del spec 002) y queda como decisión A5 del PRD.
