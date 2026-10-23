# Matriz de prueba con lectores de pantalla

Decisión A2 del PRD de accesibilidad: la prueba la hace **una persona usuaria real**, idealmente socia de la BCC. Un agente no puede reemplazarla. Cada celda se completa con resultado, quién y cuándo.

## Tareas a probar

1. Entrar al sitio e iniciar sesión solo con teclado.
2. Elegir un género en la barra lateral y escuchar cuántos libros hay.
3. Buscar un título: llegar al buscador con las teclas del propio lector (región de búsqueda, campo de edición) o con el enlace de salto «Saltar al buscador», escribir y enviar; probar también el botón Dictar. El sitio ya no tiene atajos globales: no sugerir teclas; anotar con qué teclas del lector llega.
4. Elegir un libro: anotar dónde queda el foco (debe quedar en «Pausar audiolibro»). Con el foco ahí, pausar y reanudar con Espacio (¿se conserva la posición o vuelve a 0:00?); dentro del reproductor, subir el volumen con ↑ y pasar de capítulo con N. Fuera del reproductor esas teclas no hacen nada. Observar si el lector deja pasar ↑ y N o las usa para su propia navegación.
5. Abrir la ayuda con el botón «Ayuda» (llegando a él con las teclas del propio lector o con Tab), recorrerla y cerrarla con Esc: ¿vuelve el foco adonde estaba? ¿La explicación para lector, teclado, toque y mouse se entiende?
6. Activar Alto Contraste y subir el texto al máximo: ¿se puede seguir usando todo?
7. Con el lector encendido: ¿algún aviso se escucha dos veces o corta al lector?
8. (Consola de administración, para el equipo operativo) Con una cuenta Admin: entrar a Administración con el enlace del menú, llegando a él con las teclas del propio lector (lista de enlaces, regiones) o con Tab; el foco debe quedar en la pestaña activa. Con el foco en las pestañas, probar su dígito (1 a 7) y las flechas. La tecla 3 global se retiró: no pedirla. Observaciones: ¿el nombre de la pestaña se oye una o dos veces? ¿El lector deja pasar los dígitos con el foco en una pestaña, o hay que usar las flechas? ¿En JAWS, enfocar una pestaña activa el modo formularios? Con el foco en las pestañas, probar primero las flechas ← →, Inicio y Fin y comprobar que Tab entra en la sección; después el dígito (1 a 7). Para llegar sin recorrer todo: «Saltar al menú» (segundo Tab) y «Saltar a las secciones» (tercer Tab en Administración, enfoca la pestaña activa). Observar: ¿oye la instrucción del texto visible ("Con el foco en las pestañas: las flechas…") una sola vez, al leer la página, y no repetida en cada pestaña? ¿El dígito 3 llega a la página o el lector lo consume (en JAWS + Chrome: encabezado de nivel 3)? Hacer la tarea con JAWS + Chrome además de las tres columnas.

## Atajos globales con Alt (observación pendiente)

Se agregaron atajos con Alt que funcionan desde cualquier vista: Alt+1 Perfil, Alt+2 Catálogo, Alt+3 Administración (solo Admin), Alt+4 Buscador, Alt+5 Géneros, Alt+6 Reproductor (con un libro cargado), Alt+7 Ayuda; dentro de Administración, Alt+Mayús+1 a 7 abren las pestañas. Se eligió Alt porque los lectores capturan las teclas sueltas, pero no está comprobado que Alt+dígito llegue a la página con lector. Para cada lector y navegador, anotar: ¿Alt+dígito llega a la página o el lector/navegador lo consume (menús del navegador en Firefox/Windows, teclas del lector, Option+dígito en Mac)? ¿Se oye un solo aviso por acción? ¿Dónde queda el foco? Registrar la combinación de lector y navegador (NVDA + Firefox/Chrome, JAWS + Chrome, VoiceOver + Safari/Chrome) y, si una combinación no llega, cuál.

## Resultados

| Tarea | VoiceOver + Safari (macOS) | NVDA + Firefox (Windows) | TalkBack + Chrome (Android) |
|---|---|---|---|
| 1 | | | |
| 2 | | | |
| 3 | | | |
| 4 | | | |
| 5 | | | |
| 6 | | | |
| 7 | | | |
| 8 | | | |
| **Quién** | | | |
| **Fecha** | | | |

Resultado por celda: ✅ funciona · ⚠️ funciona con dificultad (anotar cuál) · ❌ no se pudo.
