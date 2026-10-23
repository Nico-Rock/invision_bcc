# Simulación de 75 recorridos: navegación tradicional frente a navegación accesible

**Fecha:** 2026-10-22 · **Base:** rama `feat/aniversario-biblioteca-actualizada`, commit `7f8f3e1` · **Método:** lectura del código y de documentos, sin ejecutar la aplicación.

> **Esto no es evidencia de accesibilidad.** Es una simulación por lectura: orienta qué probar y no reemplaza la prueba con una persona usuaria real (decisión A2 del PRD de accesibilidad). Ninguna cifra de este documento se comunica como medición (decisión A4). Cada fila declara su base: **[C]** verificado en el código, **[D]** comportamiento documentado de un lector de pantalla, navegador o estándar, **[H]** hipótesis que solo una prueba real puede confirmar.

**Estrategias.** S1: navegación tradicional. S2: navegación accesible actual (atajos globales de una tecla, avisos por voz y sonidos). S3: variante propuesta, que proyecta código todavía no escrito.

## 1. Método
- **Lectura:** leí la copia de trabajo sin ejecutarla y los documentos pedidos. El comportamiento de NVDA, JAWS, VoiceOver y Safari en iOS lo verifiqué en la web.
- **Pasos:** un paso es una tecla, un clic o un gesto. Escribir no cuenta. G es el número de géneros y k la posición del género elegido; ninguno de los dos sale del código.
- **S1:** incluye las regiones vivas, que son ARIA estándar. La voz propia del sitio y los sonidos cuentan solo en S2 y S3.
- **S2:** sigue lo que prometen la ayuda y las etiquetas. Si eso falla, la persona vuelve a S1 y el tropiezo suma pasos.
- **S3:** sus filas proyectan código que no existe.
- **Supuestos:** el perfil de accesibilidad se carga al ingresar; P3 usa el zoom del navegador; la tarea D de P5 es sobre un libro en borrador, que es el caso normal de verificación.

**Orden de foco, la base de los pasos de S1**
- **Ingreso:** enlace de salto (index.html:30) → 5 botones de la barra (A11yBar.jsx:41-49) → correo, clave, Ingresar (Login.jsx:52-94). El correo es el Tab 7.
- **Catálogo:**
  - salto → barra ×5 → [1] Perfil, [2] Catálogo, y [3] Administración si es admin (App.jsx:187-215);
  - → Todos + G géneros (App.jsx:62-77) → Ayuda de Atajos, Salir (App.jsx:229-245);
  - → buscador, Dictar, Buscar, y Limpiar si hay texto o género (Home.jsx:193-235);
  - → hasta 8 tarjetas (Home.jsx:269-281) → Página siguiente si hay más (Home.jsx:301-308);
  - → reproductor: título, Cap. anterior (desactivado en el cap. 1), −15, Play/Pausa, +15, Cap. siguiente, posición, velocidad, volumen (AudioPlayer.jsx:74-210).
  - El buscador es el Tab 12+G. Con el enlace de salto: Tab, Enter, Tab×3.
- **Consola:** … [3] Administración → Ayuda, Salir → pestaña activa con foco itinerante (AdminPanel.jsx:102-121). En la consola no se pintan los géneros (App.jsx:222-224). En Libros: buscador, filtro, Registrar, tabla, un Gestionar por fila (ContentManagement.jsx:123-182).

**S3 definida (8 líneas)**
1. Se retiran los atajos globales de una tecla (S, 1–4, G, H, ?) y sus marcas visibles ("[1]", "[4]", "(tecla S)").
2. Espacio, flechas, N, P y M actúan solo con el foco dentro del reproductor. Es R10 y D10 del spec 003, ya aprobados.
3. Al elegir un libro, el foco va a "Pausar". Al ingresar, cambiar de sección o elegir un género, va al encabezado principal de la vista nueva.
4. Enlaces de salto al inicio: contenido, buscador, géneros y, si hay libro, reproductor. El buscador gana `role="search"` y el reproductor un h2.
5. La ayuda sigue en su botón y explica cómo moverse con lector, teclado, toque y mouse, no solo teclas.
6. El reproductor deja de ser fijo con la vista angosta o baja (zoom alto). En iOS se oculta el control de volumen, que el sistema ignora.
7. Consola: dígitos 1–7 solo con el foco en las pestañas (diseño aprobado). Al entrar, el foco va a la pestaña activa. No hay tecla 3 global.
8. Por qué esta: es la más barata, porque borra código y reutiliza reglas aprobadas. Alt+Mayús (A5) exige el catálogo del spec 003 y destreza. Un interruptor dejaría las trampas activas por defecto.

## 2. Las 75 simulaciones

**P1 — NVDA + Firefox (modo exploración por defecto)**
| ID | Secuencia | Pasos | Res. | Causa | Base |
|---|---|---|---|---|---|
| P1-A-S1 | E, Enter, [correo], Tab, [clave], Enter; luego 1 (h1) | 5 (Tab: 10) | ✅ | Campos etiquetados; tras ingresar el foco cae al documento | [C] Login.jsx:47-95, 20-23; [D] NVDA e, 1 |
| P1-A-S2 | Igual; oye "Redirigiendo al catálogo" | 5–10 | ✅ | El aviso confirma el destino; en primer uso la voz propia duplica | [C] Login.jsx:21; AudioContext.jsx:9, 54; App.jsx:121-126 |
| P1-A-S3 | E, Enter, [correo], Tab, [clave], Enter → foco al h1 | 4–9 | ✅ | Llega al título del catálogo sin buscarlo | [D] proyección |
| P1-B-S1 | H×2 ("Géneros"), K×(k+1), Enter; oye el conteo; H×2, ↓, Enter | k+8 | ✅ | Encabezados, enlaces y conteo anunciado bastan | [C] App.jsx:56-77; Home.jsx:77-78, 240-247; [D] NVDA h, k |
| P1-B-S2 | G → "no hay gráfico" (o 4 → nivel 4); sigue como S1 | k+9 | ⚠️ | G y 4 no llegan en modo exploración; la ayuda los promete | [D] NVDA: g gráfico, 1–9 niveles, gestos atrapados por defecto |
| P1-B-S3 | H×2, K×(k+1), Enter → foco a resultados; ↓, Enter | k+6 | ✅ | El foco pasa solo a los resultados del género | [D] proyección |
| P1-C-S1 | E, Enter, [título], Enter; oye el conteo; Esc, H, ↓, Enter | 7 | ✅ | El buscador es el primer campo; Enter envía; conteo anunciado | [C] Home.jsx:189-203, 101-105; [D] NVDA e |
| P1-C-S2 | S → "no hay separador"; sigue como S1 | 8 | ⚠️ | S es "separador" en NVDA; el "(tecla S)" engaña | [D] NVDA s; [C] Home.jsx:197 |
| P1-C-S3 | E (o D a la región search), Enter, [título], Enter, Esc, H, ↓, Enter | 7 | ✅ | Igual que S1; role="search" suma un punto de salto | [D] proyección |
| P1-D-S1 | Desde la tarjeta: D×1–2, B×3, Enter; B×2, Enter; F×3, Enter, ↑; Shift+F, Enter, ↓, Esc | 17–21 | ✅ | Controles nativos con nombre, pero el reproductor queda último | [C] AudioPlayer.jsx:71-210; [D] NVDA d, b, f |
| P1-D-S2 | Espacio en la tarjeta → reinicia cap. 1; NVDA se queda ←, →, N, P, M; vuelve a S1 | 19–24 | ⚠️ | Espacio reinicia el libro desde 0:00; flechas, N, P y M no llegan | [C] Home.jsx:269-273, 114-128; useKeyboardShortcuts.js:76-81; [D] NVDA n, p, m |
| P1-D-S3 | Foco ya en Pausar: Espacio; Tab×2, Enter; Tab×3, ↑; Shift+Tab, ↓ | 10 | ✅ | Con el foco en el reproductor, todo queda a 1–3 teclas | [D] proyección; [H] si el salto de foco le acomoda |
| P1-E-S1 | Tab, Enter (salto), Tab, Enter (Ayuda); lee; Esc; Shift+B, Enter (Lectura en voz) | 7 | ⚠️ | La ayuda se alcanza, pero solo enseña teclas que NVDA intercepta | [C] App.jsx:229-236, 290-308; [D] NVDA gestos atrapados |
| P1-E-S2 | H → siguiente encabezado; sigue como S1 | 8 | ⚠️ | H no llega; ayuda y resumen repiten atajos que no llegan | [D] NVDA h; [C] useKeyboardShortcuts.js:135-138 |
| P1-E-S3 | Tab, Enter, Tab, Enter; lee; Esc; Shift+B, Enter | 7 | ✅ | La ayuda explica encabezados, regiones y saltos | [H] calidad del texto nuevo |

**P2 — VoiceOver + Safari en iPhone, sin teclado**
| ID | Secuencia | Pasos | Res. | Causa | Base |
|---|---|---|---|---|---|
| P2-A-S1 | →×10–11 hasta correo, doble toque, [correo], →, doble toque, [clave], "Ir"; rotor encabezados ↓×3 | 16–20 | ✅ | Campos etiquetados; tras ingresar el cursor queda sin destino claro | [C] Login.jsx:47-95; [D] rotor (Apple); [H] dónde queda el cursor |
| P2-A-S2 | Igual; la voz propia y VoiceOver dicen a la vez "Inicio de sesión exitoso" | 16–20 | ✅ | Aviso útil, duplicado en primer uso | [C] AudioContext.jsx:9, 54, 176-182; [H] Safari exige gesto para hablar |
| P2-A-S3 | Igual; tras "Ir", foco al h1 | 13–17 | ✅ | Arranca en el catálogo | [H] que iOS mueva el cursor con focus() |
| P2-B-S1 | Rotor ↓×2 ("Géneros"), →×(k+1), doble toque; oye el conteo; ↓×2, →×1–2, doble toque | k+8 a k+9 | ✅ | Encabezados, enlaces y conteo por región viva | [C] App.jsx:56-77; Home.jsx:77-78; [D] rotor (Apple) |
| P2-B-S2 | Igual (sin teclado no hay atajos), más sonidos y voz propia | k+8 a k+9 | ✅ | Mismo camino; los atajos solo escuchan el teclado | [C] useKeyboardShortcuts.js:116 |
| P2-B-S3 | Rotor ↓×2, →×(k+1), doble toque → foco a resultados; →, doble toque | k+6 a k+7 | ✅ | El foco pasa solo a los resultados | [D] proyección; [H] focus() en iOS |
| P2-C-S1 | Rotor ↓×3 (h1), →×2, doble toque, [título], "Buscar" del teclado; ↓, →×1–2, doble toque | 10–11 | ✅ | El teclado de iOS envía el formulario; conteo anunciado | [C] Home.jsx:189-203, 77-78; [D] rotor (Apple) |
| P2-C-S2 | Igual (Dictar es opcional) | 10–11 | ✅ | Mismo camino; la voz propia suma un aviso | [C] Home.jsx:137-159 |
| P2-C-S3 | Igual que S1 | 10–11 | ✅ | Sin cambio relevante en el iPhone | [D] proyección |
| P2-D-S1 | Toca el pie de pantalla hasta "Pausar", doble toque; →×2, doble toque; botones físicos; →×3, doble toque, selector, "OK" | 12–16 | ✅ | El reproductor fijo se encuentra al tacto; volumen con botones físicos | [C] index.css:558-578; [D] Apple, volumen en iOS; [H] exploración táctil |
| P2-D-S2 | Igual, pero con el volumen del sitio: VoiceOver dice "85 %" y el audio no cambia | 12–16 | ⚠️ | iOS ignora el volumen que fija la página; el anuncio miente | [D] Apple, iOS-Specific Considerations; [C] AudioPlayer.jsx:193-203 |
| P2-D-S3 | Foco ya en Pausar: doble toque; →×2, doble toque; botones físicos; →×3, doble toque, selector | 11–13 | ✅ | Foco en el reproductor y sin volumen falso | [H] focus() en iOS; [D] Apple |
| P2-E-S1 | Desliza hasta "Ayuda de Atajos" (≈13+G) o la busca al tacto; doble toque; oye la tabla; "Entendido" | 4 a 15+G | ⚠️ | La ayuda solo habla de teclas; el iPhone no tiene teclado | [C] App.jsx:229-236, 290-308 |
| P2-E-S2 | Igual | 4 a 15+G | ⚠️ | No menciona gestos ni la estructura | [C] App.jsx:290-308 |
| P2-E-S3 | Salto o tacto hasta "Ayuda", doble toque, lee, "Entendido" | 4–8 | ✅ | La ayuda cubre toque y lector | [H] calidad del texto |

**P3 — Baja visión, zoom del navegador al 300–400 %, teclado y mouse, sin lector**
| ID | Secuencia | Pasos | Res. | Causa | Base |
|---|---|---|---|---|---|
| P3-A-S1 | Tab×7, [correo], Tab, [clave], Enter | 9 | ✅ | Formulario simple; antes, la barra de ajustes ocupa 1–2 pantallas | [C] Login.jsx:47-95; A11yBar.jsx:35-51 (altura estimada) |
| P3-A-S2 | Igual; la voz propia confirma el ingreso | 9 | ✅ | Aviso hablado útil sin lector | [C] Login.jsx:21 |
| P3-A-S3 | Igual; el foco y la vista quedan en el h1 | 9 | ✅ | La vista arranca en el catálogo | [D] proyección |
| P3-B-S1 | Tab×(9+k), Enter; Tab×(G−k+7), Enter (con mouse, varias pantallas de rueda) | G+18 | ⚠️ | Sin salto a resultados: recorre géneros, barra y buscador | [C] App.jsx:182-245; Home.jsx:193-281 |
| P3-B-S2 | G (foco en "Todos"), Tab×k, Enter; S, Tab×4, Enter | k+8 | ✅ | Sin lector, G y S llegan y la vista sigue al foco | [C] App.jsx:137-156; useKeyboardShortcuts.js:50-70 |
| P3-B-S3 | Tab×3 (salto "géneros"), Enter, Tab×(k+1), Enter → foco a resultados; Tab, Enter | k+8 | ✅ | Mismos pasos que S2, sin teclas globales | [D] proyección |
| P3-C-S1 | Tab, Enter (salto), Tab×3, [título], Enter, Tab×4, Enter | 11 | ✅ | El enlace de salto acorta; con mouse son muchas pantallas | [C] index.html:30; App.jsx:229-245; Home.jsx:193-235 |
| P3-C-S2 | S, [título], Enter, Tab×4, Enter | 7 | ✅ | S enfoca el buscador real | [C] App.jsx:137-149 |
| P3-C-S3 | Tab×2, Enter (salto "buscador"), [título], Enter, Tab×4, Enter | 9 | ✅ | Dos pasos más que S2 | [D] proyección |
| P3-D-S1 | Clic en Pausar, Siguiente, volumen y velocidad (o Tab×11, Enter…) | 5 clics / 21 teclas | ⚠️ | El reproductor fijo tapa 84–100 % de la vista y puede cortar botones | [C] index.css:558-587 (≈270 px CSS, por cálculo) |
| P3-D-S2 | Espacio en la tarjeta → reinicia cap. 1; clic en Pausar; N y ↑ funcionan; clic en velocidad | 6–7 | ⚠️ | Espacio reinicia; con libro cargado, flechas y Espacio roban el desplazamiento | [C] useKeyboardShortcuts.js:76-97; Home.jsx:269-273 |
| P3-D-S3 | Foco en Pausar, con el reproductor en el flujo: Espacio, N, ↑, Tab×4, ↓ | 8 | ✅ | Teclas dentro del reproductor; nada tapa la vista | [D] proyección (hay que medir) |
| P3-E-S1 | Tab, Enter, Tab, Enter (Ayuda); Esc; clic en A+ y Alto Contraste | 7 | ✅ | Ajustes con texto y estado; a ella la ayuda le sirve | [C] A11yBar.jsx:41-49; App.jsx:229-236 |
| P3-E-S2 | H; Esc; clic en A+ y Alto Contraste | 4 | ✅ | H llega; la voz confirma "Texto al 112 %" | [C] useKeyboardShortcuts.js:71-75; AudioContext.jsx:334-354 |
| P3-E-S3 | Tab, Enter, Tab, Enter (Ayuda); Esc; dos clics | 7 | ✅ | Tres pasos más que S2 | [D] proyección |

**P4 — Edad avanzada, sin lector, mouse, poca destreza (voz propia encendida, decisión A3)**
| ID | Secuencia | Pasos | Res. | Causa | Base |
|---|---|---|---|---|---|
| P4-A-S1 | Clic en correo, [correo], clic en clave, [clave], clic en Ingresar | 3 | ✅ | Formulario corto con etiquetas visibles | [C] Login.jsx:47-95 |
| P4-A-S2 | Igual; la voz dice "Inicio de sesión exitoso" | 3 | ✅ | Confirmación hablada; la bienvenida dice "lector", jerga para ella | [C] App.jsx:121-126; [H] comprensión |
| P4-A-S3 | Igual | 3 | ✅ | Sin cambios | [C] Login.jsx:47-95 |
| P4-B-S1 | Clic en un género (columna izquierda), clic en una tarjeta | 2–3 | ✅ | Géneros a la vista; un clic en la tarjeta y suena | [C] App.jsx:56-77; Home.jsx:269-281 |
| P4-B-S2 | Igual; la voz dice el conteo y "Reproduciendo…" | 2–3 | ✅ | La voz confirma; "[1]" y "[4]" no le dicen nada | [C] App.jsx:57, 192; [H] |
| P4-B-S3 | Igual | 2–3 | ✅ | Sin cambios de fondo | [D] proyección |
| P4-C-S1 | Clic en el buscador, [título], Enter, clic en la tarjeta | 3 | ✅ | Buscador grande sobre los resultados | [C] Home.jsx:189-235 |
| P4-C-S2 | Igual | 3 | ✅ | Si escribe sin clic previo, H abre la ayuda y N, P, M tocan el audio | [C] useKeyboardShortcuts.js:49-110; [H] frecuencia |
| P4-C-S3 | Igual | 3 | ✅ | Sin teclas globales no hay disparos accidentales | [D] proyección |
| P4-D-S1 | Clic en pausa, en capítulo siguiente, arrastra el volumen, elige velocidad | 4–5 | ⚠️ | Botones solo con ícono, sin texto ni rótulo: +15 s y capítulo se confunden | [C] AudioPlayer.jsx:91-145; [H] reconocimiento |
| P4-D-S2 | Igual; la voz dice "pausada", "15 segundos adelantados", "capítulo 2" | 4–5 | ✅ | La voz le dice qué hizo cada ícono | [C] AudioContext.jsx:239, 286, 311-313; [H] voz sobre la narración |
| P4-D-S3 | Igual; el anillo de foco marca Pausar | 4–5 | ✅ | La voz y el foco visible orientan | [H] |
| P4-E-S1 | Clic en "Ayuda de Atajos" → tabla de teclas; Entendido; clic en A+ y Alto Contraste | 4–5 | ⚠️ | La ayuda solo enseña teclas que no usa; los ajustes son claros | [C] App.jsx:290-308; A11yBar.jsx:41-49 |
| P4-E-S2 | Igual; la voz anuncia cada ajuste | 4–5 | ⚠️ | Tampoco hay ayuda para quien usa mouse | [C] App.jsx:290-308 |
| P4-E-S3 | Igual, con ayuda general | 4–5 | ✅ | La ayuda explica botones y ajustes | [H] calidad del texto |

**P5 — Administrador, JAWS + Chrome (voz propia apagada por perfil)**
| ID | Secuencia | Pasos | Res. | Causa | Base |
|---|---|---|---|---|---|
| P5-A-S1 | Insert+F7, ↓×3 ("[3] Administración"), Enter; oye "Inicio. Pendientes…"; Tab×3 hasta la pestaña activa | 8 | ✅ | Enlace del menú y resumen hablado; el foco queda en el menú | [C] App.jsx:204-216; Inicio.jsx:109-111; AdminPanel.jsx:113 |
| P5-A-S2 | 3 → JAWS busca encabezado de nivel 3; sigue como S1 | 9 | ⚠️ | 3 no llega en cursor virtual; con Insert+3 llega sin mover el foco | [D] JAWS teclas rápidas, Insert+3; [C] useKeyboardShortcuts.js:62-65 |
| P5-A-S3 | Insert+F7, ↓×3, Enter → foco en la pestaña activa | 5 | ✅ | Llega y queda sobre las pestañas | [D] APG pestañas; proyección |
| P5-B-S1 | En la pestaña: →, → (modo formulario), o ↓, Enter, ↓, Enter (cursor virtual) | 2–4 | ✅ | Patrón completo; con libro sonando, → también adelanta 15 s | [C] AdminPanel.jsx:83-89; useKeyboardShortcuts.js:84-90; [D] APG |
| P5-B-S2 | Igual; oye "Libros." | 2–4 | ✅ | Sin atajos de pestaña; un dígito ahí lleva a Perfil o Catálogo | [C] useKeyboardShortcuts.js:54-61 |
| P5-B-S3 | Con el foco en las pestañas: 2 (Libros), 3 (Usuarios); si JAWS no los deja pasar, flechas | 2 | ✅ | Dígitos solo en las pestañas, con las flechas de respaldo | [H] modo formulario de JAWS sobre role="tab" |
| P5-C-S1 | → (Libros), Tab (buscador), [título]; oye "N libros encontrados"; Tab×4, Enter (Gestionar) | 7 | ✅ | Conteo anunciado y un "Gestionar <título>" por fila | [C] ContentManagement.jsx:87-96, 121-188 |
| P5-C-S2 | S → "mismo elemento" en JAWS; con Insert+3, va al buscador de socios, fuera de la consola | 8–11 | ⚠️ | S no llega, o saca de la consola | [D] JAWS s; [C] App.jsx:137-149 |
| P5-C-S3 | 2 (Libros), Tab, [título], Tab×4, Enter | 7 | ✅ | Igual que S1 | [H] dígito; [C] ContentManagement.jsx:123-182 |
| P5-D-S1 | Un borrador no figura en el catálogo y la ficha no reproduce (si está publicado: salir al Catálogo, buscar, reproducir y volver, ≈25) | — | ❌ | No hay camino para escuchar un borrador; uno publicado obliga a salir | [C] routes.py:342-345; CapitulosLibro.jsx:184-197; AdminPanel.jsx:67 |
| P5-D-S2 | Igual; además 2 y S no llegan, y Espacio en la tarjeta reinicia | — | ❌ | La misma falta; los atajos suman tropiezos | [C] idem; [D] JAWS |
| P5-D-S3 | Igual; tras elegir, foco en Pausar | — | ❌ | La navegación no repara una función que falta | [C] idem |
| P5-E-S1 | Shift+Tab×2 (Ayuda), Enter; lee; Esc | 4 | ⚠️ | La ayuda no menciona la consola ni sus pestañas | [C] App.jsx:290-308; useKeyboardShortcuts.js:122-133 |
| P5-E-S2 | H → JAWS busca encabezado; sigue como S1 | 5 | ⚠️ | H no llega; el contenido es el mismo | [D] JAWS h |
| P5-E-S3 | Shift+Tab×2, Enter; ayuda con las teclas de la consola; Esc | 4 | ✅ | Ayuda generada de la misma tabla, con la consola | [H] no construido |

## 3. Cuadro resumen
| Persona | S1 ✅/⚠️/❌ | S1 pasos | S2 ✅/⚠️/❌ | S2 pasos | S3 ✅/⚠️/❌ | S3 pasos |
|---|---|---|---|---|---|---|
| P1 NVDA | 4/1/0 | 5–21 (B: k+8) | 1/4/0 | 5–24 | 5/0/0 | 4–10 |
| P2 VoiceOver | 4/1/0 | 4–20 | 3/2/0 | 4–20 | 5/0/0 | 4–17 |
| P3 baja visión | 3/2/0 | 7–21 (B: G+18) | 4/1/0 | 4–9 (B: k+8) | 5/0/0 | 7–9 (B: k+8) |
| P4 mayor | 3/2/0 | 2–5 clics | 4/1/0 | 2–5 | 5/0/0 | 2–5 |
| P5 admin JAWS | 3/1/1 | 2–8 | 1/3/1 | 2–11 | 4/0/1 | 2–7 |
| **Total** | **17/7/1** | | **13/11/1** | | **24/0/1** | |

- **Filas con alguna [H] en su base:** 19 de 75. En 7 de ellas el resultado cambiaría si la hipótesis falla: P1-E-S3, P2-E-S3, P4-D-S1, P4-D-S2, P4-D-S3, P4-E-S3 y P5-E-S3.
- **S3 es optimista por construcción:** la diseñé contra los problemas que encontré, y sus 25 filas proyectan código no escrito.
- **Teclas que el lector captura en modo exploración:** 10 filas usan una tecla que el lector puede capturar.
  - Son las 8 de S2 de P1 (B, C, D, E) y de P5 (A, C, D, E), más P5-B-S3 y P5-C-S3.
  - En las 8 de S2, la documentación dice que la tecla no llega en el estado por defecto [D]. NVDA usa h, s, g, n, p, m y 1–9 para su navegación y "atrapa los gestos que no son comandos" por defecto. JAWS usa H, S, G, N, P, M y 1–6, y solo deja pasar la tecla siguiente con Insert+3.
  - En las 2 de S3 queda como [H], pero tienen las flechas de respaldo y su resultado no cambia.
  - En P2, P3 y P4 nada depende de esto: P2 no tiene teclado, y P3 y P4 no usan lector.
- **Espacio y flechas tienen otra lógica:**
  - Con lector en modo exploración, Espacio sobre un botón lo activa y las flechas mueven el cursor del lector. Sin lector, llegan siempre a la página.
  - Hoy, Espacio con el foco en la tarjeta recién elegida no pausa: la activa y reinicia el capítulo 1 desde 0:00. Le pasa a P1, P3 y P5. En P3 es [C] puro: useKeyboardShortcuts.js:76-81 deja pasar Espacio sobre botones, y Home.jsx:114-128 vuelve a cargar el capítulo 1.
  - Las flechas, con un libro cargado, actúan en toda la página. A P3 y P4 les roban el desplazamiento, y en la consola cambian la pestaña y mueven el audio a la vez. El código incumple así el propio spec 002: R29/V21 (líneas 96 y 200) y R36/V27 (líneas 107 y 206).

## 4. Veredicto
**Rehacer la capa global y ajustar el reproductor; no basta un ajuste fino.**

**Atajos globales:** los de una tecla (S, 1–4, G, H, ?) no sirven a quienes más se pensaron.
- Con NVDA o JAWS en modo exploración no llegan a la página, y la ayuda los promete igual.
- En el iPhone no existen.
- A P4 solo le dejan trampas. Además incumplen WCAG 2.1.4: no se pueden apagar ni actúan solo con foco, como ya advertía la decisión A5 (analysis.md:15 del spec 003).
- Solo P3 los aprovecha (en B, k+8 pasos contra G+18), y S3 le da la misma cifra con enlaces de salto y manejo de foco.

**Teclas del reproductor:** se conservan, pero hoy fallan en el caso central. Espacio reinicia el libro y las flechas actúan fuera del reproductor.

**La navegación tradicional sale mejor parada de lo que se suponía.** Encabezados, regiones, etiquetas, controles nativos y el enlace de salto ya funcionan. Por eso S1 rinde bien con P1, P2 y P5: la navegación propia del lector (H, D, E, B, Insert+F7, el rotor) ya da lo que prometen S, G y H.

**Qué se conserva:**
- regiones vivas y avisos, el perfil por socio y la barra de accesibilidad;
- el enlace de salto y el patrón de pestañas;
- la voz propia para P4, porque le explica íconos que no se entienden;
- Espacio, flechas, N, P y M dentro del reproductor.

**Qué se cambia:**
- el alcance de esas teclas (R10 y D10 del spec 003, ya aprobados);
- el foco: al reproductor al elegir un libro, y al encabezado en cada cambio de vista;
- la ayuda, para que explique estructura, gestos y la consola;
- el reproductor, que deja de ser fijo con zoom alto;
- el volumen en iOS.

**Qué se descarta:**
- el mapa global de una tecla y las marcas "[1]", "[4]" y "(tecla S)";
- la tecla 3 global del diseño aprobado de la consola, porque en JAWS el 3 es "encabezado de nivel 3".

**Por persona, sin promediar:**
- **P1 y P5:** S1 ≥ S2. S3 mejora sobre todo la tarea D (de 17–21 pasos a 10).
- **P2:** S1 = S2. S3 gana en D y en E.
- **P3:** S2 es hoy su mejor estrategia, salvo en D. S3 la iguala sin las trampas.
- **P4:** S2 > S1 por la voz, no por los atajos. S3 conserva la voz y quita el riesgo.
- **P5-D falla en las tres:** no hay forma de escuchar un borrador. Es una función que falta, no un problema de navegación.

## 5. Qué observar hoy
1. **Tarea 4, justo después de elegir el libro:**
   - Anotar dónde quedó el foco y qué hace la persona para pausar.
   - Si presiona Espacio sobre la tarjeta, registrar literal si oye "Obteniendo capítulos… Capítulo 1" y si pierde la posición. Es la predicción [C] más importante.
   - Medir cuánto tarda en encontrar "Pausar", y con qué: Tab, B, D o el tacto.
2. **Teclas del sitio:** si prueba alguna (S, H, 2, N), anotar literal qué dice el lector, por ejemplo "no hay separador" o un salto de encabezado. Registrar también:
   - si usa la navegación rápida de su lector (H, D, E, el rotor);
   - si conoce NVDA+Espacio o NVDA+F2.
   - No sugerirle teclas. En la conversación final, preguntar: "¿probó alguna tecla de la ayuda? ¿qué pasó?".
3. **Tareas 1 y 2:** anotar dónde cae el lector tras iniciar sesión y tras elegir un género, cuántos pasos le toma llegar al primer resultado y si oye el conteo. Esto valida la regla de foco de S3.
4. **Antes de empezar:** revisar si `user@invision.com` tiene perfil de accesibilidad y si el dispositivo es de primer uso.
   - Sin perfil, la voz propia va a duplicar al lector toda la sesión, lo que contamina la tarea 7.
   - Anotar si oye la bienvenida y si encuentra "Lectura en voz" sin ayuda.
5. **Si usa iPhone:** dejar que cambie el volumen a su manera. Si toca el control del sitio, comparar el porcentaje que se anuncia con lo que se oye.

## 6. Límites
- **Base de la simulación:** es lectura de código y documentos, sin ejecutar nada. La altura del reproductor (≈270 px CSS) es un cálculo, G y k no se conocen, y el estado del perfil de la cuenta tampoco.
- **Lectores:** lo que digo de NVDA y JAWS sale de sus guías y de foros. Sus versiones y los ajustes de cada persona cambian resultados, por ejemplo quien desactiva "atrapar gestos". La página oficial de JAWS devolvió 403, así que la cité por el buscador.
- **No es evidencia:** no reemplaza la prueba real (decisiones A2 y A4) y no autoriza ninguna cifra de accesibilidad.

**Fuentes externas:**
- [Guía de NVDA](https://download.nvaccess.org/documentation/userGuide.html)
- [Teclas rápidas de JAWS](https://www.freedomscientific.com/SurfsUp/Quick_Keys.htm)
- [Insert+3, Léonie Watson](https://lists.w3.org/Archives/Public/public-html-a11y/2015Apr/0023.html)
- [Tablist y modo foco, WebAIM (comunidad)](https://webaim.org/discussion/mail_message?id=45738)
- [Apple, volumen en iOS](https://developer.apple.com/library/safari/documentation/audiovideo/conceptual/using_html5_audio_video/Device-SpecificConsiderations/Device-SpecificConsiderations.html)
- [Rotor de VoiceOver](https://support.apple.com/en-us/111796)
- [WCAG 2.1.4](https://www.w3.org/WAI/WCAG22/Understanding/character-key-shortcuts.html)
- [WCAG 2.4.11](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html)
- [APG, pestañas](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/)

## Estado

Nico eligió la opción (a) el 2026-10-22: retirar los atajos globales de una tecla y adoptar la variante S3. Se implementó y se integró a la copia local el mismo día, con pruebas unitarias y una prueba de humo con API simulada. Falta la verificación con una persona usuaria real y las pruebas con sesión de administrador y de socio.
