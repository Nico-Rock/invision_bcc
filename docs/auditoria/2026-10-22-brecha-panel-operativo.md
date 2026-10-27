# Brecha entre el panel operativo y la consola del sitio, y plan de retiro

**Fecha:** 2026-10-22 · **Base:** rama `feat/aniversario-biblioteca-actualizada`, commit `7f8f3e1`, más los cambios locales de navegación (sin commit) · **Método:** lectura del código y de los specs 004 y 005, sin ejecutar nada.

> Las filas de la tabla de brecha salen de leer el código. Las afirmaciones H1, H2, H3 y D1 se verificaron de forma independiente el mismo día (sección final). El resto no se comprobó ejecutando.

En corto:
- **Lo que la consola ya cubre:** usuarios, fichas, carga de capítulos y auditoría, y en esas áreas supera al panel.
- **Lo que le falta:** la escucha previa (P5-D), las cifras y el estado real del índice de audio, ver el audio que no tiene ficha, la gobernanza y tres protecciones de la carga.
- **Dos defectos que conviene corregir antes que todo lo demás:** un socio puede escuchar un borrador si conoce su id, y el capítulo que suena no siempre es el que se eligió.
- **El bloqueo real del retiro está fuera de la consola:** la API nueva no corre contra el esquema de producción, así que el panel no puede apagarse hasta que la consola exista allí.

Todo esto sale de leer el código. No ejecuté nada, no edité nada y no usé credenciales.

Raíz: `/Users/nico/Documents/VibeCode/proyectos/activos/Invision/`. En la tabla, S = `admin-dashboard/server.py` y H = `admin-dashboard/static/index.html`.

## 1. Brecha, función por función

| # | Qué hace el panel | ¿La consola lo cubre? | Evidencia | Qué falta |
|---|---|---|---|---|
| 1 | Cifras del almacenamiento: libros con audio, pistas, GB | No | S:565-609, H:1206-1242. La API ya tiene el índice (`admin_extras.py:55`), pero ninguna ruta entrega las cifras y `Inicio.jsx:131-172` no las muestra | Cifras en `/admin/pendientes` y una sección en Inicio |
| 2 | Estado del índice: vacío, indexando, al día, error | Parcial | `admin_extras.py:112-117`: si el índice falla y no hay uno anterior, responde `calculando:true`. `Inicio.jsx:134-135` queda en «Calculando…» para siempre: dice «en curso» cuando en realidad falló (P10) | Decir el error en palabras y anunciarlo una vez por el canal urgente |
| 3 | Total de usuarios | Sí | Está en el título de Usuarios (spec 005, R8) | — |
| 4 | Estado de servicios (SSL, FastAPI) | No se migra | H:1249-1265: son insignias fijas, no comprueban nada | — |
| 5 | Registros de acceso | Parcial | `AuditLogs.jsx:93-116` y `routes.py:596-619` no tienen límite ni degradan. Producción no tiene la tabla `sesiones_acceso` (`docs/specs/13-divergencia-esquema-produccion.md:35`), así que da error 500 y la consola avisa de un fallo. El panel decía «esta base no registra sesiones» (S:112-115) | Responder 503 con un texto claro (patrón `_exigir`), mostrarlo como nota y limitar a 200 filas |
| 6 | Buscar títulos en todo el catálogo | Sí, para libros con ficha | `ContentManagement.jsx:83-85` | Las carpetas de audio sin ficha (S:661-684 lista por carpeta del almacenamiento): ver fila 8b |
| 7 | Pistas de cada libro, en orden | Parcial | `CapitulosLibro.jsx:28-36` solo las cuenta | Mostrar la lista de capítulos cargados |
| 8 | Escucha previa | No (P5-D) | El panel firma un permiso de lectura de 2 horas sin comprobar que el archivo exista (S:164-179, 701-713). La consola no ofrece nada, y además el reproductor global (`App.jsx:300`) queda inerte detrás de la ficha, que es un diálogo modal (`Dialogo.jsx:21`, `ContentManagement.jsx:191`) | Diseño 2-A |
| 8b | Ver audio que no tiene ficha | No | Inicio cuenta fichas sin audio, no carpetas de audio sin ficha | Diseño 2-C |
| 9 | Dictado en el buscador | No | Solo existe en `Home.jsx:172` | Decisión D5 |
| 10 | Directorio de usuarios con roles | Sí, y más | `UserManagement.jsx`. La lista no muestra fecha de alta ni teléfono (`routes.py:116-127`) | No se migra |
| 11 | Gobernanza y reglas | No | H:1346-1375 | Una sección fija en Inicio |
| 12 | Crear libro | Sí, con un hueco | `routes.py:699-739`: el libro nace como borrador (L729) y queda registrado (L730). No controla duplicados; el panel respondía 409 (S:212-219). Como la carpeta de audio se llama igual que el título, dos fichas con el mismo título comparten audio | Responder 409 sin distinguir mayúsculas, al crear y al editar |
| 13 | Categorías | Sí | `routes.py:638-642` (acepta cualquier sesión, no solo Admin; es menor) | — |
| 14 | Carga guiada de pistas: orden, una por vez, sin pisar, reintento | Sí, con huecos | `CapitulosLibro.jsx:57-143`; permiso de solo creación por 15 minutos (`routes.py:569-590`) | Rechazar pistas vacías o de más de 500 MB antes de escribir (S:280-286). Hoy una pista vacía se sube, queda «con problemas» y ya no se puede reemplazar, porque el permiso solo permite crear. Además, comparar el tamaño al confirmar (S:322-337 frente a `admin_extras.py:198-201`) |
| 15 | Aviso de orden de las pistas | Parcial | La consola ordena por número igual que el servidor (`frontend/src/lib/capitulos.js:13-22`), así que el aviso de dígitos ya no hace falta. Lo que no se dice es que las pistas sin número van al final | Una frase en el anuncio al elegir los archivos |
| 16 | Refrescar el índice a pedido | No | S:501-509. La API lo refresca cada 10 minutos (`indice_audio.py:16`) | Invalidar el índice cada vez que se confirma una pista |
| 17 | Atajos globales 1-6, S, H, ? | No se migra | `ayuda.js:185`; decisión vigente (WCAG 2.1.4) | — |
| 18 | Credenciales directas | Se reemplaza | **Panel:** lecturas sin autenticación, solo con el control de Host local (S:413-434); escrituras con un `ADMIN_TOKEN` compartido que va dentro del HTML (S:543-552); usuario de administración de la base (S:49-77) y clave de la cuenta de almacenamiento (S:140-179). **API:** sesión con rol Admin verificado en cada ruta (`admin_extras.py:63-67`); la clave queda en el servidor; el navegador recibe un permiso de solo creación para un único archivo; la escucha va por la ruta autenticada | — |

Un dato de contexto: en producción el alta de libros del panel ya está rota por la columna `categoria_id` (`docs/specs/13-divergencia-esquema-produccion.md:46`). Lo que el panel realmente aporta hoy en producción es el explorador, la escucha, la subida de pistas y el directorio.

**Tres hallazgos nuevos:**
- **H1. Visibilidad.** Las rutas `/stream-audio-simple` y `/audio-by-id` (`routes.py:374-472`) no excluyen los libros ocultos. Solo lo hacen la búsqueda, los géneros y los libros por género (L343, 489, 514). Cualquier socio con sesión puede escuchar un borrador o un libro en la papelera si conoce su id, y los ids son secuenciales (CWE-639).
- **H2. Orden.** El streaming ordena por el primer número de la ruta completa y descarta las pistas sin número (`routes.py:404-417`). La lista de capítulos usa otro orden (`crud.py:282-290`). En un libro como «1984», o con un «Prólogo.mp3», suena un capítulo distinto del elegido, para socios y para administradores. `crud.get_audio_stream` ya tiene el orden correcto, pero ninguna ruta la usa.
- **H3.** `routes.py:456` devuelve al cliente el texto crudo de la excepción (`str(e)`), lo que incumple R16.

## 2. Diseño mínimo para cerrar la brecha

**A. Escuchar desde la ficha (cierra P5-D).**
- **En la API (`routes.py`):** las rutas de streaming y de capítulos responden 404 si el libro está oculto y quien pide no es Admin. El streaming pasa a usar `ordenar_capitulos` y deja de devolver el texto de la excepción. No se agrega ningún permiso de lectura nuevo: el administrador escucha por la misma ruta autenticada que el socio.
- **En la ficha (`CapitulosLibro.jsx`):** una lista numerada «Capítulos cargados», con un botón por capítulo: «Escuchar capítulo N: nombre». Al activarlo se llama a `playChapter` y el foco va a Pausar, igual que en el catálogo. Si el libro es borrador, se anuncia: «Escucha previa: los socios no ven este libro».
- **El reproductor dentro de la ficha:** sigue habiendo un solo `AudioPlayer`, que se monta dentro del diálogo abierto (con `createPortal`) cuando la ficha lo aloja. `AudioContext.jsx` guarda dónde se monta y `Dialogo.jsx` recibe una prop `alojaReproductor`, que solo pasa la ficha. Mover el reproductor no corta el sonido, porque el `<audio>` vive en el contexto y no en la página (`AudioContext.jsx:195`). Las teclas siguen actuando solo con el foco dentro de `.player-dock` (`lib/reproductor.js:12`); no se agrega ningún atajo global.

| Opción | Lo que se gana | Lo que se pierde |
|---|---|---|
| **Reproductor dentro de la ficha (recomendada)** | Se escucha sin salir de la ficha, con las mismas teclas | Unas 40 líneas en 4 archivos; riesgo de que se solape visualmente al 200 % o a 320 px (lo controla el arnés) |
| Cerrar la ficha y usar el reproductor global | Unas 10 líneas | Volver a la ficha cuesta entre 10 y 25 pulsaciones por pista (P5-D-S1) |
| `<audio controls>` nativo | Casi sin código | Un segundo reproductor con otras teclas, contra la decisión vigente |

**B. Inicio** (`admin_extras.py` pendientes e `Inicio.jsx`): agregar al índice el estado, la fecha del último índice válido, libros, pistas y GB; decir el error tal cual; sumar una sección «Reglas de operación» con los 3 principios del panel. `confirmar_pista` invalida el índice para que el Inicio se actualice tras una carga.

**C. Audio sin ficha:** la API lista las carpetas de audio que no tienen ficha. En Inicio aparece «Ver N carpetas sin ficha», y cada carpeta abre «Registrar audiolibro» con el nombre ya escrito. La ficha nace como borrador, así que el audio queda vinculado e invisible para los socios. No hace falta una pestaña nueva y los dígitos 1–7 no cambian.

**D. Carga:**
- **Permiso de subida:** recibe el tamaño de la pista y responde 422 si es 0 o supera 500 MB.
- **Confirmación:** recibe el tamaño y responde 409 si no coincide con el archivo subido.
- **Antes de pedir el permiso:** el mismo control de tamaño en `lib/capitulos.js`.
- **Títulos duplicados:** 409 en `routes.py`, al crear y al editar.

**E. Accesos:** 503 con texto legible cuando falta la tabla y límite de 200 filas; `AuditLogs.jsx` lo muestra como nota, no como error urgente.

## 3. Plan de retiro

**Qué pruebas del panel migran y a dónde (R21):**

| Prueba del panel | Casos | Destino |
|---|---|---|
| `tests/test_indice_blob.py` | 9 | `InvisionAPI-main/audiobooks/test_indice_audio.py`, nuevo: la copia del índice que tiene la API no tiene ninguna prueba |
| `test_server.py`, alta de libro | 4 | El éxito y la persistencia ya están probados en la API; faltan el duplicado (409) y el título hecho solo de espacios |
| `test_server.py`, subida de pistas | 8 | Rutas, extensión y pista existente ya están cubiertas (`test_admin_sin_ver.py:33-67`); faltan pista vacía, más de 500 MB, error del almacenamiento sin detalle interno y tamaño al confirmar |
| `test_overview.py` y `test_esquema.py` | 10 | Sesiones sin tabla devuelven 503; cifras de pendientes. La degradación por tabla faltante ya la prueba `test_r28_sin_tablas_degrada_con_aviso` |
| `tests/js/dictado.test.js` | 8 | `frontend/tests/unit/dictado.test.js`, que no existe: `lib/dictado.js` hoy no tiene pruebas |
| `test_a11y_estatico.py` | 13 | `consola.spec.js` ya cubre axe, dos regiones vivas, contraste AAA, 48 px y foco. Falta una prueba de que no se usa `dangerouslySetInnerHTML` (CWE-79). El resto prueba el HTML del panel y se va con él |
| `tests/js/a11y_logica.test.js` | 10 | El sitio ya prueba su equivalente (reproductor, atajos, ayuda). Solo se portaría el volumen de a 10 %, si se extrae a una biblioteca |
| Token, Host, lector acotado y pruebas de punta a punta del servidor | ~21 | Prueban el servidor propio del panel y se van con él. Su equivalente es `test_rutas_nuevas_exigen_admin` más H3 |
| `verificacion/a11y/recorrido-panel.js` | — | Lo reemplaza `consola.spec.js` |

**Pasos, ninguno destructivo antes del 6:**

| Paso | Qué se hace | Qué lo habilita | Cómo se revierte |
|---|---|---|---|
| 1 | Tareas T-a a T-h | Criterios 1 a 14 | revert de los commits |
| 2 | Sesión con una persona, en local | P1 a P3 firmadas en `aprobaciones/AAAA-MM-DD_retiro_panel.md` | — |
| 3 | Despliegue de la API nueva | Aprobación BCC (P12) y divergencia de esquema resuelta (D1) | volver a la imagen anterior |
| 4 | Verificación en producción, fila por fila | P4 firmada (R20) | el panel sigue funcionando |
| 5 | Apagar el servidor del 8888 (Nico confirma qué proceso es antes de detenerlo), marcar la documentación como «retirado» y dejar dos semanas de cuarentena | Paso 4 cumplido | `admin-dashboard/run_dashboard.sh` |
| 6 | `git tag panel-operativo-final`, luego `git rm -r admin-dashboard verificacion/a11y/recorrido-panel.js`, y quitar `ADMIN_TOKEN` de `.env` avisando antes a Nico | Cuarentena sin incidentes y criterio 15 | `git checkout panel-operativo-final -- admin-dashboard` |

**Documentos que se actualizan en el paso 5:**
- `verificacion/a11y/README.md`, sección 1 (L18-31): pasa a describir la consola y `npm run test:a11y`.
- `verificacion/a11y/pauta-sesion-usuario-ciego.md`: la referencia al panel pasa a la consola.
- `docs/specs/00-overview.md` (L38 y L69) y `docs/specs/12-admin-dashboard.md`: estado «retirado».
- `docs/specs/13-divergencia-esquema-produccion.md`: anotar las filas L46-49.
- `docs/superpowers/plans/2026-09-02-carga-contenido-accesible.md` y `docs/superpowers/specs/2026-09-02-carga-contenido-accesible-design.md`: cabecera «histórico».
- Comentarios que nombran al panel como fuente: `frontend/src/lib/dictado.js:3`, `CapitulosLibro.jsx:11`, `validacion_pistas.py:3` e `indice_audio.py:3-5`.
- `.specops/specs/005-administracion-sin-ver/tasks.md:116`: el comando de verificación de T12 incluye las pruebas del panel.
- El registro de `.specops/specs/004-consola-unica/tasks.md`.
- `.specops/constitution.md:11` (P1) nombra `admin-dashboard/`: cambiarlo es una enmienda y necesita la firma de Nico.

## 4. Criterios de aceptación

Atajos: `PYTEST_API` son las pruebas de la API; `UNIT`, `SITIO`, `lint` y `build` corren en `frontend/` (`npm run test:unit`, `npm run test:a11y`, `npm run lint`, `npm run build`).

| # | Criterio | Cómo se comprueba | Quién |
|---|---|---|---|
| 1 | Un socio recibe 404 al pedir el audio o los capítulos de un borrador o de un libro en la papelera; un Admin recibe 206 o 200 | PYTEST_API | Agente |
| 2 | Con «1984 Pista 2», «1984 Pista 10» y «Prólogo», el capítulo i de la lista y el que suena son el mismo archivo, para i = 1 a 3 | PYTEST_API | Agente |
| 3 | Si el almacenamiento falla, el streaming da un mensaje genérico, sin nombre de cuenta ni detalle interno | PYTEST_API | Agente |
| 4 | El permiso de subida con tamaño 0 o mayor a 500 MB da 422 y no firma nada; confirmar con un tamaño distinto da 409 | PYTEST_API | Agente |
| 5 | Crear «harry potter» cuando ya existe «Harry Potter» da 409 y no agrega ninguna fila | PYTEST_API | Agente |
| 6 | Con el índice en error y sin uno anterior, los pendientes no dicen «calculando» y sí dicen el error; con el índice listo, las cifras coinciden con las del índice; las carpetas sin ficha salen bien | PYTEST_API | Agente |
| 7 | Sin la tabla de sesiones: 503 legible, la pestaña Auditoría muestra una nota (no un error urgente) y el resto funciona | PYTEST_API y SITIO | Agente |
| 8 | `test_indice_audio.py` tiene al menos 9 casos en verde y `unit/dictado.test.js` 8 | PYTEST_API y UNIT | Agente |
| 9 | En la ficha de un borrador con 3 capítulos hay 3 botones «Escuchar capítulo N». Al activar el 2 hay un solo reproductor, está dentro de la ficha abierta y el foco queda en Pausar. Con el foco en la lista, Espacio, N y P no mueven el audio. Al cerrar la ficha, el audio sigue y el reproductor sale de ella | SITIO, con la API y el audio simulados | Agente |
| 10 | Con la ficha y el reproductor abiertos: axe en 0, contraste AAA, 48 px y dos regiones vivas, en los dos modos y al 200 % | SITIO | Agente |
| 11 | Inicio dice cuántos libros con audio, pistas y GB hay; una carpeta sin ficha abre «Registrar» con el nombre escrito, y la ficha nace como borrador | SITIO | Agente |
| 12 | `atajos.test.js` sigue en verde sin cambios (7 pestañas) | UNIT | Agente |
| 13 | lint y build sin errores; las pruebas de la API sin fallas nuevas | lint, build y PYTEST_API | Agente |
| 14 | Durante los pasos 1 a 5, las pruebas del panel siguen en verde (R26) | `.venv/bin/python -m pytest admin-dashboard -q` | Agente |
| 15 | Tras el paso 6, buscar `admin-dashboard` o `localhost:8888` solo encuentra documentos marcados como históricos, y el tag recupera el panel | grep y `git show panel-operativo-final:admin-dashboard/server.py` | Agente |
| P1 | Con NVDA (y JAWS si está disponible) y una cuenta Admin real, en local: escuchar el capítulo 1 de un borrador desde la ficha, pausar, adelantar, pasar al siguiente con N y cerrar, sin ayuda y anotando las pulsaciones | Sesión | Persona |
| P2 | Con una cuenta de socio real, el borrador no aparece en el catálogo, la búsqueda ni los géneros | Sesión | Persona |
| P3 | Carga completa con una pista vacía y otra repetida: todo lo que se anuncia es verdad | Sesión | Persona |
| P4 | En producción, cada fila de la tabla de retiro está verificada y firmada | Sesión y firma | Persona |
| P5 | El administrador dice si usa el dictado y si necesita refrescar el índice a mano | Sesión | Persona |

## 5. Riesgos y decisiones para Nico

| Decisión | Recomiendo | Lo que se gana | Lo que se pierde |
|---|---|---|---|
| **D1. Bloqueo: la consola no existe en producción.** El modelo de la API usa `categoria_id`, que producción no tiene (`docs/specs/13-divergencia-esquema-produccion.md:29-35`), y `main.py:36` crea tablas solo al arrancar | Hacer ya los pasos 1 y 2, y los pasos 5 y 6 solo después del despliegue | No dejar a producción sin explorador, sin escucha y sin subida de pistas | El panel sigue vivo durante semanas |
| D2. Dónde suena la escucha previa | Reproductor dentro de la ficha | Se escucha sin salir de la ficha | Cuatro archivos tocados y más superficie que revisar al 200 % |
| D3. ¿Una pestaña «Audios» como explorador? | No | Se mantienen las 7 pestañas, los dígitos 1–7 y las pruebas de atajos; no hace falta un permiso de lectura por archivo | No se puede recorrer el almacenamiento tal cual ni escuchar una carpeta sin ficha sin crear antes un borrador (que se revierte desde la papelera) |
| D4. Escuchar a través de la API, no con permisos de lectura directos | Sí | El navegador no recibe ningún permiso de lectura y rige la misma regla de visibilidad que para los socios | El sitio descarga la pista entera antes de que suene (`AudioContext.jsx:259`): son varios segundos en pistas de 100 MB |
| D5. Funciones que no se migran: atajos globales, insignias de servicios, fecha de alta y teléfono en la lista, botón de refresco | No migrarlas | Menos cosas que escuchar y ningún «todo bien» falso | Si P5 pide el refresco, se agrega una ruta limitada a una vez por minuto. El dictado en Libros se decide después de P5 |
| D6. `_ops_upload/` (credenciales directas, carga de los ~700 libros) | Dejarlo hasta terminar esa carga | No se corta la carga en curso | Retirar el panel no saca las credenciales directas de la máquina |
| D7. `confirmar` descarga la pista entera a memoria (`admin_extras.py:201`) | Tratarlo aparte | — | Con pistas de 500 MB, la API puede quedarse sin memoria |
| D8. Worktree `.claude/worktrees/agent-a87ed5998fc663c2e/` | Confirmar que está abandonado antes de empezar | Evitar conflictos | Tiene copias de `admin-dashboard/` y de archivos que tocan estas tareas |

El orden más barato es: T-a (corrige H1 a H3, es chica y vale aunque no haya retiro) → T-e y T-f (cierran P5-D) → T-d y T-h (pruebas de R21) → T-b → T-c y T-g → T-i → despliegue → T-j → T-k.

## Tareas para TARS (11: 4 medianas y 7 chicas)

| Tarea | Qué | Archivos | Criterios | Tamaño |
|---|---|---|---|---|
| T-a | Visibilidad, orden y mensaje de error del streaming | `routes.py`, `test_admin_grupo_bc.py` | 1–3 | Chica |
| T-b | Tamaño en el permiso y en la confirmación; título duplicado | `routes.py`, `admin_extras.py`, `validacion_pistas.py`, `test_admin_sin_ver.py` | 4–5 | Chica |
| T-c | Pendientes con cifras, error real, audio sin ficha e índice invalidado; sesiones con 503 | `admin_extras.py`, `indice_audio.py`, `routes.py` y sus pruebas | 6–7 | Mediana |
| T-d | Pruebas del índice en la API | `test_indice_audio.py` | 8 | Chica |
| T-e | Reproductor dentro de la ficha | `AudioContext.jsx`, `Dialogo.jsx`, `AudioPlayer.jsx`, `ContentManagement.jsx` | 9–10 | Mediana |
| T-f | Capítulos que se pueden escuchar y control de tamaño | `CapitulosLibro.jsx`, `lib/capitulos.js`, `unit/capitulos.test.js` | 9 | Mediana |
| T-g | Inicio (cifras, error, sin ficha → Registrar, reglas) y nota en Auditoría | `Inicio.jsx`, `AdminPanel.jsx`, `ContentManagement.jsx`, `AuditLogs.jsx` | 7, 11 | Mediana |
| T-h | Pruebas del sitio que migran | `unit/dictado.test.js`, `a11y/consola.spec.js` | 8–11 | Chica |
| T-i | Tabla de retiro y registro de la spec 004 | `aprobaciones/AAAA-MM-DD_retiro_panel.md`, `004/tasks.md` | — | Chica |
| T-j | Documentación del paso 5 | Los documentos listados en la sección 3 | — | Chica |
| T-k | Retiro del paso 6, solo con P4 y el visto bueno de Nico | tag, `git rm`, `.env` | 15 | Chica |

No pido Fable: la pieza es acotada y cada paso se puede deshacer.

Archivos clave:
- `/Users/nico/Documents/VibeCode/proyectos/activos/Invision/admin-dashboard/server.py`
- `/Users/nico/Documents/VibeCode/proyectos/activos/Invision/InvisionAPI-main/audiobooks/routes.py`
- `/Users/nico/Documents/VibeCode/proyectos/activos/Invision/InvisionAPI-main/audiobooks/admin_extras.py`
- `/Users/nico/Documents/VibeCode/proyectos/activos/Invision/frontend/src/pages/Admin/components/CapitulosLibro.jsx`
- `/Users/nico/Documents/VibeCode/proyectos/activos/Invision/frontend/src/components/AudioPlayer.jsx`
- `/Users/nico/Documents/VibeCode/proyectos/activos/Invision/frontend/src/components/Dialogo.jsx`
- `/Users/nico/Documents/VibeCode/proyectos/activos/Invision/docs/specs/13-divergencia-esquema-produccion.md`

## Verificación independiente (2026-10-22)

- **H1 confirmado.** El filtro de libros ocultos (`ids_ocultos_para_socios`) solo se aplica en `routes.py:343`, `489` y `514` (búsqueda y géneros). `stream_audio_range` (`routes.py:374`) y `get_chapters` (`routes.py:459`) no lo consultan: un socio con sesión puede pedir el audio de cualquier `audiolibro_id`, incluidos borradores y libros en la papelera.
- **H2 confirmado.** El streaming ordena por el primer número del nombre completo del archivo en el almacenamiento, carpeta incluida (`routes.py:404-417`). Cuando el título trae dígitos, todas las pistas comparten esa clave y queda el orden alfabético del listado (por ejemplo, «Pista 10» antes de «Pista 2»). La lista de capítulos usa `ordenar_capitulos` (`crud.py:282`), que ordena por el último número del nombre del archivo. En el catálogo local, 20 de 538 fichas tienen dígitos en el título.
- **H3 confirmado.** `routes.py:456-457` hace `except Exception as e: raise HTTPException(status_code=500, detail=str(e))`. Por lectura, sin ejecutar: ese `except` también captura los `HTTPException` 404 y 403 lanzados dentro del `try`, y los vuelve 500.
- **D1 confirmado** con `docs/specs/13-divergencia-esquema-produccion.md`: producción no tiene las tablas `categorias`, `clasificaciones`, `audiolibro_clasificacion` ni `sesiones_acceso`, y el alta de libros falla por `categoria_id`.
