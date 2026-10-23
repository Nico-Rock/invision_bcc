# Pauta de sesión de prueba con una persona usuaria ciega

**Fecha prevista:** 2026-10-22 · **Duración:** 70 minutos más 30 de preparación · **Base:** [matriz de lectores de pantalla](matriz-lectores.md) (decisión A2 del PRD de accesibilidad: la prueba la hace una persona usuaria real, no un agente).

## 1. Objetivo y alcance

**Objetivo.** Observar a una persona ciega usando el sitio de socios con su propio lector de pantalla, para saber qué tareas completa sola, dónde se traba y qué le molesta. El resultado es evidencia con fecha y nombre del lector, como exige el PRD (no se afirma una cifra de accesibilidad sin ella).

**Entra en la sesión de hoy**
- El sitio de socios con la cuenta `user@invision.com`: tareas 1 a 7 de la matriz, más las tareas 9 y 10 de esta pauta.

**No entra**
- **La consola de administración y el panel operativo (tarea 8 de la matriz).** La API local usa las llaves reales de Azure Blob: las rutas de subida, confirmación y borrado de capítulos escriben en el almacenamiento de producción. Quien prueba no debe tener acceso a ellas.
- **Dictar por voz**, salvo que la sesión sea en el computador de Nico con `localhost`. Los navegadores exigen HTTPS o `localhost` para el micrófono; por IP de red sobre HTTP lo esperable es que falle con el aviso de permiso. No está verificado; si falla, se registra como "no evaluable en este montaje", no como defecto del sitio.

## 2. Montaje técnico: tres opciones

| Opción | Cuándo | Ventajas | Límites |
|---|---|---|---|
| **A. Dispositivo propio de la persona, en la misma red (recomendada)** | La persona viene o está en el mismo lugar | Su lector, su navegador, su velocidad de voz y sus hábitos: el feedback vale | La IP de red puede cambiar; HTTP sin cifrar; dictado no evaluable |
| **B. Computador de Nico, `localhost`** | La persona domina VoiceOver en Mac | Dictado evaluable; sin problemas de red | La mayoría de las personas ciegas usa NVDA/JAWS en Windows o VoiceOver en iPhone; un lector poco familiar contamina el resultado |
| **C. Remoto, con túnel público** | Solo si la persona no puede venir | Funciona a distancia | Expone a internet una API que tiene las llaves de Azure en su entorno y una cuenta demo con contraseña conocida. **No recomendada hoy** |

**Estado verificado el 2026-10-22 (desde el propio Mac):**
- API en el contenedor `invision_local`, puerto 8000, con `DATABASE_URL=sqlite:///invision.db` (no toca la base de producción). Frontend con Vite en el puerto 3000.
- Ambos responden en la IP de red `172.20.10.6` (código 200), la API acepta ese origen (CORS) y el firewall de macOS está desactivado.
- **No verificado:** que otro dispositivo llegue a esa IP (algunas redes aíslan a los clientes entre sí), y que el audio suene (el ensayo requiere iniciar sesión).
- La red `172.20.10.x` parece un hotspot de celular: la persona debe conectarse a esa misma red, o ambos a una Wi-Fi común (y entonces la IP cambia).

La dirección que se entrega a la persona es `http://<IP>:3000`. El sitio calcula solo la dirección de la API (reemplaza el puerto 3000 por 8000), así que no hay nada más que configurar.

## 3. Preparación (30 minutos antes)

1. **Ensayo de punta a punta.** Con la cuenta de socio, iniciar sesión, abrir un libro y confirmar que suena. Anotar tres títulos que suenan bien y un título cuya ficha no tiene audio (a la fecha de la auditoría eran 481 escuchables y 57 sin audio de 538; confirmar hoy).
2. **Prueba desde un segundo dispositivo.** Abrir `http://<IP>:3000` desde un celular en la misma red, iniciar sesión y reproducir. Si no carga, pasar a la opción B.
3. **Mac estable.** Conectado a corriente, sin suspensión (`caffeinate -dims` en una terminal), con el resto de las aplicaciones cerradas: la máquina tiene 8 GB y poco disco libre.
4. **Comandos de verificación** (deben dar 200):
   ```bash
   ipconfig getifaddr en0
   docker ps --filter name=invision_local --format '{{.Status}}'
   curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8000/docs
   curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/
   ```
5. **Credencial.** Cuenta de socio `user@invision.com`; entregar la contraseña de viva voz o en un mensaje privado, nunca en un canal compartido. No entregar la cuenta de administración.
6. **Roles.** *Facilitador* (conduce y lee las consignas), *observador* (anota, no habla) y la persona usuaria. Si hay una sola persona del equipo, grabar el audio de la sesión (con permiso) para anotar después.
7. **Plan B** si la red falla: opción B en el computador de Nico, o reprogramar. No improvisar un túnel público.
8. **Voz propia del sitio.** La opción «Lectura en voz» viene encendida por defecto. No apagarla de antemano, porque es lo que encontrará cualquier socia; anotar si la persona nota los avisos dobles, si le molestan y si encuentra el interruptor sin ayuda. Confirmar al inicio si la sesión es de primer uso en ese dispositivo y si la cuenta de socio tiene un perfil de accesibilidad guardado.
9. **Títulos que evitar en la tarea 4.** En 20 fichas el título contiene dígitos. Hoy el streaming ordena los capítulos por el primer número de la ruta, que en esos casos es el del título, y puede reproducir un capítulo distinto del que la lista indica. Elegir para la sesión un libro sin dígitos en el título. Fichas afectadas: CHILE, 5 SIGLOS DE HISTORIA; CONVERSACIÓN EN LA CATEDRAL  TOMO 1; CONVERSACIÓN EN LA CATEDRAL TOMO 2; CUMBRES BORRASCOSAS VERSIÓN 1; CUMBRES BORRASCOSAS VERSIÓN 2; DIARIO DE GREG 2, LA LEY DE RODRICK; EL RETRATO DE DORIAN GRAY, 1; EL RETRATO DE DORIAN GRAY, 2; HISTORIA SECRETA DE CHILE 1; HISTORIA SECRETA DE CHILE 2; HISTORIA SECRETA DE CHILE 3; HÉROES 1, HISTORIA SECRETA DE CHILE; HÉROES 2, HISTORIA SECRETA DE CHILE; INFORME ANUAL DE LOS DERECHOS HUMANOS EN CHILE 2013; LOS 7 BORGIA; SANTIAGO EN 100 PALABRAS; SANTIAGO EN 100 PALABRAS 2014 Y 2015; SANTIAGO EN 100 PALABRAS 2017; UN VETERANO DE 3 GUERRAS; VOCES EN EL PARQUE V.4.

## 4. Guion de la sesión

| Minutos | Bloque | Qué se hace |
|---|---|---|
| 0–10 | Bienvenida y consentimiento | Explicar que se prueba el sitio, no a la persona: si algo no funciona, es falla del sitio. Pedir permiso para anotar y, si acepta, grabar audio. Puede parar o saltarse una tarea cuando quiera. Registrar lector, versión, navegador, sistema y velocidad de voz |
| 10–15 | Acceso | Enviar la dirección por mensaje o leerla despacio. Que la persona la abra por sí misma |
| 15–50 | Tareas | Sección 5, en orden, pensando en voz alta |
| 50–65 | Conversación abierta | Sección 7 |
| 65–70 | Cierre | Agradecer, acordar cómo se comparte el resultado con ella y si se le puede citar por su nombre o de forma anónima |

## 5. Tareas

Las consignas se leen como situaciones de uso. **No se menciona ningún atajo ni cómo hacerlo:** descubrirlo (o no) es parte de lo que se mide.

| N.º | Consigna | Observar | Éxito |
|---|---|---|---|
| 1 | "Entre al sitio y abra su sesión." Pedirle que se equivoque una vez a propósito con la contraseña | Dónde cae el foco al cargar; si los campos se anuncian con su nombre; si el error se oye de inmediato | Entra sin ayuda |
| 2 | "Averigüe cuántos libros hay del género Infantil." | Que oiga la cantidad. En el catálogo existen géneros que difieren solo en mayúsculas (por ejemplo "INFANTIL" e "Infantil"); anotar si se confunde | Dice una cantidad y sabe de qué lista salió |
| 3 | "Busque un libro por su título." (Dictar solo si el montaje lo permite) | Cómo llega a la búsqueda; si oye cuántos resultados hay; si puede recorrerlos | Encuentra el título pedido |
| 4 | "Escuche un libro: póngalo, páuselo, cambie el volumen, pase al capítulo siguiente y cambie la velocidad." | Tiempo hasta que suena; qué anuncia el sistema; si sabe en qué capítulo está; si el audio del libro tapa al lector | Completa las cinco acciones |
| 5 | "Pida ayuda dentro del sitio y vuelva a donde estaba." | Si encuentra la ayuda sin pistas; si al cerrarla el foco vuelve al lugar de origen | Cierra la ayuda y retoma su punto |
| 6 | "Cambie los ajustes visuales del sitio." | Que cada interruptor diga si quedó activado o desactivado. Para baja visión: usar todo con alto contraste y texto al máximo | Entiende el estado de cada ajuste |
| 7 | *(Transversal, sin consigna)* | En toda la sesión: avisos que se oyen dos veces, avisos que cortan al lector, silencios después de una acción | Anotar cada ocurrencia con la hora |
| 9 | "Cierre la pestaña, vuelva a entrar y siga escuchando el libro." | Si retoma donde quedó o desde el inicio; si el sistema se lo dice | Retoma sin ayuda |
| 10 | "Abra este libro." (una ficha sin audio, elegida en la preparación) | Qué oye cuando no hay audio: ¿entiende que no se puede escuchar y por qué? | Entiende la situación sin ayuda |

**Si la persona se traba más de 2 minutos:** ofrecer una pista mínima ("¿qué probaría ahora?"); si sigue, dar la solución. Cualquier pista cuenta como tropiezo y baja el resultado a ⚠️ o ❌.

### Cambios del 2026-10-22 que la sesión debe observar

Tras la [simulación de 75 recorridos](../../docs/auditoria/2026-10-22-simulacion-75-recorridos.md) se rediseñó la navegación del sitio. Nada de lo que sigue se verificó todavía con una persona real: esta sesión es esa verificación.

**Corregido en el código** (comprobado con una API simulada, no con la real):
- Espacio sobre la tarjeta del libro recién elegido ya no reinicia el capítulo 1. El foco pasa solo al botón «Pausar» al terminar la carga.
- Espacio, las flechas, N, P y M actúan solo con el foco dentro del reproductor.
- Se retiraron las teclas globales de una letra y de dígitos (S, G, H, ? y 1 a 4). Si la persona las prueba, el sitio no hace nada: anotar literal lo que dice su lector. No sugerirlas.
- Los primeros Tab son enlaces de salto: contenido, buscador, géneros y, con un libro cargado, reproductor.
- Tras iniciar sesión, cambiar de sección o elegir un género, el foco va al encabezado de la vista nueva.
- El botón se llama «Ayuda» y la ventana, «Cómo moverte por Invision».

**Qué observar con prioridad**
1. Tarea 4: ¿oye dónde quedó el foco tras elegir el libro? ¿Pausa con Espacio sin perder la posición? ¿Encuentra N, P, M y las flechas con su lector? Hipótesis sin confirmar: en modo exploración NVDA y JAWS capturan las teclas de una letra y es posible que no lleguen a la página.
2. Tareas 1 y 2: ¿dónde cae el lector tras iniciar sesión y tras elegir un género? ¿Oye el conteo?
3. Primeros Tab: ¿los enlaces de salto se oyen con su nombre y llevan adonde dicen?
4. Tarea 5: ¿encuentra la ayuda sin pistas y le sirve su contenido?

**Defectos que siguen (no son error de la persona)**
- La voz propia del sitio viene encendida por defecto: con lector de pantalla se esperan avisos dobles (tarea 7).
- Activar dos veces una tarjeta mientras el libro se descarga lo carga dos veces.
- El texto «Capítulo X de Y» del reproductor tiene un contraste de 6,99:1, apenas bajo el 7:1 que se exige.

## 6. Reglas para quien facilita

- No explicar, defender ni corregir el sitio durante la tarea. Anotar y seguir.
- No tocar el dispositivo de la persona sin pedir permiso. No describir lo que hay en pantalla salvo que lo pida.
- Respetar el ritmo y la velocidad de voz del lector; no interrumpir mientras escucha.
- Preguntar "¿qué esperaba que pasara?" y "¿qué oyó?", en vez de "¿qué le pareció?". Sin vista, lo que anuncia el sistema es la única evidencia: interesa lo que oyó, literal.
- Una persona anota todo lo que dice el lector tal como lo dice, no resumido.

## 7. Conversación abierta

1. ¿Qué fue lo más fácil? ¿Qué fue lo más frustrante?
2. ¿Usaría el sitio sola, sin ayuda? ¿Con qué frecuencia?
3. ¿Hubo avisos que no esperaba, que sobraron o que faltaron?
4. ¿La voz y el idioma del sitio le resultan cómodos?
5. Comparado con la aplicación que usa hoy para escuchar libros, ¿qué hace mejor y qué hace peor?
6. Si pudiera cambiar una sola cosa, ¿cuál?
7. ¿Qué le diría a otra persona socia que va a usarlo por primera vez?

## 8. Registro

**Por tarea:** resultado (✅ funciona · ⚠️ con dificultad · ❌ no se pudo), tiempo, pistas dadas, dónde se trabó, lo que dijo el lector (literal), frase de la persona.

**Severidad de cada hallazgo**

| Nivel | Criterio |
|---|---|
| Bloqueante | No pudo completar la tarea, o el sistema anunció algo falso |
| Grave | Completó con pista o tardó más del doble de lo esperado |
| Menor | Fricción que no frena la tarea |
| Sugerencia | Idea de la persona, sin fallo observable |

**Dónde queda.**
1. Completar la columna del lector usado en [matriz-lectores.md](matriz-lectores.md), con quién y cuándo.
2. Guardar las notas en `informes/2026-10-22-sesion-<lector>.md`, con los hallazgos clasificados por severidad.
3. No comunicar cifras de accesibilidad a partir de esta sesión (decisión A4 del PRD): una sesión es evidencia cualitativa, no una medición.

## 9. Después de la sesión (el mismo día)

1. Consolidar los hallazgos y marcar cuáles son bloqueantes. Revisar con Nico antes de corregir; las correcciones siguen el flujo del spec, no se hacen en caliente.
2. Agradecer a la persona y enviarle el resumen de lo que se aprendió, como se acordó.
3. Apagar el montaje: `docker stop invision_local` y cerrar el servidor Vite del puerto 3000. La contraseña de la cuenta demo existe solo en la base SQLite local; no requiere otra acción.
