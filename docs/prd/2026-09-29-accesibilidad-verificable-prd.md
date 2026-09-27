# PRD — Accesibilidad verificable: del "90 %" a la evidencia

**Para:** reunión tripartita del equipo Invision, 29 de septiembre de 2026
**Autor:** Nico
**Estado:** borrador para discusión
**Detalle técnico:** [`.specops/specs/002-conformidad-accesibilidad/spec.md`](../../.specops/specs/002-conformidad-accesibilidad/spec.md)
**Complementa:** [PRD de la biblioteca actualizada](2026-09-29-biblioteca-actualizada-prd.md)

---

## 1. Por qué

Invision existe para que personas ciegas, con baja visión y mayores escuchen libros sin depender de nadie. Nuestro marco de accesibilidad dice que la plataforma está implementada al 90 % según WCAG 2.2, el estándar internacional. El 26 de septiembre lo medimos, en lugar de suponerlo. Lo que encontramos:

**Lo bueno, y es mucho:**
- Las dos aplicaciones (el sitio de los socios y el panel del equipo) **pasan la auditoría automática del estándar sin ninguna falla**.
- Tienen barra de accesibilidad, sonidos de guía, atajos de teclado, dictado por voz y la tipografía diseñada por el Braille Institute.

**Lo que la auditoría automática no ve, y afecta justo a nuestros usuarios:**

| Hallazgo | A quién afecta | Dónde |
|---|---|---|
| El texto crece hasta 175 %, no hasta el 200 % que exige el estándar. En el panel, al máximo **se pierden botones** | Baja visión | Sitio y panel |
| **Cada aviso se escucha dos veces** (la voz del sitio y el lector de pantalla a la vez) | Personas ciegas | Sitio y panel |
| Cada aviso **interrumpe** lo que el lector estaba diciendo, aunque no sea urgente | Personas ciegas | Sitio y panel |
| El contorno que marca dónde está el foco **casi no se ve sobre fondo blanco** | Baja visión | Sitio y panel |
| El **filtro de géneros real es invisible**; en pantalla se ven dos categorías que no filtran nada | Todos | Sitio |
| El atajo para ir al buscador **nunca funcionó**, y la barra espaciadora **bloquea los botones** cuando hay un libro cargado | Personas ciegas | Sitio |
| La ventana de ayuda **no retiene el foco** y se puede recorrer aunque esté cerrada | Personas ciegas | Sitio |
| Algunos errores **ocurren en silencio** | Personas ciegas | Sitio |
| Botones más chicos que el mínimo recomendado de 48 píxeles | Baja visión, dificultad motriz | Sitio y panel |
| En el panel, el **dictado por voz puede captar la propia voz del panel** y buscar esa frase | Personas ciegas | Panel |
| Al usar ciertos atajos, **el cursor del lector queda en ningún lado** | Personas ciegas | Panel |
| Algunos botones **se llaman distinto de lo que muestran**, y quien los controla por voz no puede activarlos | Baja visión, control por voz | Sitio y panel |

Y dos correcciones al propio marco: el naranja de la marca da **4,5 a 1** de contraste, no 4,8 como dice el documento, y el rojo de error que propone el marco no alcanza el nivel máximo del estándar.

## 2. La regla que proponemos

> **Cuando la marca o la estética chocan con la accesibilidad, gana la accesibilidad.**

En la práctica:
- **El texto** usa un naranja más oscuro del mismo tono, que se lee con el máximo contraste del estándar (nivel AAA).
- **El naranja actual de la marca** se queda en los elementos sin texto: bordes, líneas, ilustraciones y el faro del aniversario. La identidad se conserva.
- En el **modo de alto contraste** se usan exactamente los colores del marco, salvo el rojo de error, que se aclara para alcanzar el nivel máximo.

## 3. Qué proponemos construir

### Prioridad 1: antes de afirmar que cumplimos
1. **Texto al 200 %** en el sitio y en el panel, sin que se pierda nada.
2. **Avisos que no atropellan:** los estados esperan a que el lector de pantalla termine y solo los errores interrumpen. La voz propia del sitio pasa a ser una opción ("Lectura en voz") para quien no usa lector, así nadie escucha dos veces.
3. **Contraste máximo (AAA) en todo el texto**, en el modo normal y en el de alto contraste.
4. **Foco visible sobre cualquier fondo**, con doble contorno en el modo claro.
5. **En el sitio, el filtro de géneros real a la vista**, y los atajos, la barra espaciadora y la ventana de ayuda funcionando como dicen.

### Prioridad 2: completar el marco
6. Controles de al menos 48 píxeles.
7. Atajos completos del reproductor: volumen con flechas arriba y abajo, pista siguiente y anterior, silencio.
8. Respeto de la preferencia del sistema operativo de reducir movimiento.
9. Estructura de regiones correcta para saltar con el lector de pantalla.
10. Errores que siempre se anuncian, y campos con error marcados.

### Prioridad 3: que no vuelva a pasar
11. **Una verificación repetible**, que cualquiera del equipo puede correr, con informe fechado.
12. **El marco del vault corregido** con lo medido, app por app.

## 4. Qué no incluye
- Rediseñar el sitio o el panel por gusto. Solo cambia lo que exige la accesibilidad.
- Adaptaciones específicas para líneas Braille o magnificadores comerciales. Se prueba con el comportamiento estándar del sistema.
- Publicar en producción: eso sigue pasando por la aprobación de la BCC.

## 5. Decisiones que necesitamos de la reunión

| # | Decisión | Recomendación | Por qué importa |
|---|---|---|---|
| A1 | ¿Adoptamos la regla "la accesibilidad gana sobre la marca", con el naranja oscuro para texto? | **Sí** | Es la diferencia entre "cumple lo mínimo" y "se lee sin esfuerzo" para baja visión |
| A2 | ¿Quién de la BCC hace la prueba con lectores de pantalla reales (VoiceOver, NVDA, TalkBack)? | Una persona usuaria real, idealmente socia de la BCC | La auditoría automática no reemplaza a quien usa la tecnología todos los días |
| A3 | ¿La "Lectura en voz" del sitio viene encendida o apagada por defecto? | **Encendida en el primer uso, con un aviso que explica cómo apagarla** | Protege a las personas mayores sin lector; quien usa lector la apaga una vez |
| A4 | ¿Dejamos de comunicar "90 %" hasta tener la nueva medición? | **Sí** | Una cifra sin respaldo pone en riesgo la confianza de la BCC |
| A5 | Con el catálogo de atajos editable solo por el administrador (spec 003), ¿aceptamos que los atajos generales usen **Alt + Mayúscula + tecla** y que las teclas sueltas funcionen solo dentro del reproductor? | **Sí** | Es la forma de cumplir el estándar (WCAG 2.1.4) sin personalización por persona: las teclas sueltas chocan con NVDA, JAWS y VoiceOver. La alternativa es que cada socio pueda reasignar sus teclas, que es otro proyecto |

## 6. Cómo sabremos que funcionó
- **0 fallas** en la auditoría automática, en las dos apps y en los dos modos (hoy ya es 0, y no debe romperse).
- **0 textos bajo contraste AAA**, medido texto por texto.
- **0 controles fuera de pantalla** con el texto al 200 %.
- **0 avisos duplicados** con un lector de pantalla encendido.
- **Una prueba con lector de pantalla real** hecha por una persona usuaria, con fecha y resultado.
- **El marco del vault** dice lo mismo que la medición.

## 7. Riesgos
| Riesgo | Mitigación |
|---|---|
| El naranja más oscuro cambia la percepción de la marca | El naranja actual se mantiene en todo lo que no es texto; se muestra lado a lado en la reunión |
| Arreglar el sitio toca código que hoy no tiene tests | Primero se agrega la verificación automática y después se corrige |
| Poco tiempo antes del 29 | Para la reunión se prioriza el panel (Prioridad 1); el sitio se presenta con su lista de hallazgos y el plan |
