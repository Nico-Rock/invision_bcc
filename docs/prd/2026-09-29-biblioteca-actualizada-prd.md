# PRD — Invision, un año después: biblioteca actualizada

**Para:** reunión tripartita del equipo Invision, 29 de septiembre de 2026
**Autor:** Nico
**Estado:** borrador para discusión
**Detalle técnico:** [`.specops/specs/001-biblioteca-actualizada/spec.md`](../../.specops/specs/001-biblioteca-actualizada/spec.md)

---

## 1. Por qué ahora

Invision cumple un año como biblioteca digital accesible de la Biblioteca Central para Ciegos. Hoy tiene **538 audiolibros en el catálogo, 258 GB de audio y 81 cuentas**, de las cuales 34 ya registran progreso de escucha. Vienen **unos 700 títulos más**, lo que duplicaría la colección.

Para decir que lanzamos una biblioteca actualizada, primero hay que cerrar tres brechas:

| Brecha | Qué significa para un socio | Tamaño hoy |
|---|---|---|
| **Libros sin audio** | Encuentra el libro, le da reproducir y no suena nada | **42 títulos** |
| **Audio sin ficha** | Hay libros grabados que nadie puede encontrar | **24 carpetas** (varias son nombres cortados, p. ej. "Bestiario y todos los fuego") |
| **Carga manual** | Los 700 nuevos tardarían meses y cada carga manual es un riesgo | 1 incidente en producción (21/09) por un dato cargado a mano |

## 2. Qué mostramos el 29

1. **El ajuste visual:** la interfaz rediseñada, corriendo con el catálogo real.
2. **La carga accesible:** el panel operativo con la sección de carga pensada para operarse con lector de pantalla.
3. **Esta propuesta:** cómo pasamos de 538 a más de 1.200 títulos sin romper nada.

## 3. Qué proponemos construir

### Prioridad 1 — imprescindible para el lanzamiento
- **Panel que no falla.** Hoy la primera pantalla del panel muestra un error técnico. Pasa a mostrar el estado real y a decir con claridad cuando un dato no está disponible.
- **Informe de reconciliación.** Una lista de los 42 libros sin audio y las 24 carpetas sin ficha, con la coincidencia probable de cada una, para que la BCC decida caso por caso. No cambia nada por su cuenta.
- **Carga por lotes segura.** La bibliotecaria entrega una planilla con los libros del lote. La herramienta revisa el lote completo antes de subir nada y explica cada problema en lenguaje claro. Por defecto solo simula. La carga real exige una aprobación registrada. Si se corta, retoma donde quedó, y nunca deja un libro visible sin su audio.

- **Aprobaciones oficiales.** Toda carga, corrección o cambio en producción se aprueba en un PR del repositorio de Invision que el equipo revisa en sus reuniones. Sin PR aprobado, la herramienta no escribe.

### "En Memoria" — la voz de quien narró
Muchas grabaciones de la BCC son antiguas, y para algunos narradores pueden ser su último registro en vida. Proponemos que **cada audiolibro registre a su narrador** (o "desconocido", cuando no se sepa) y mantener una lista de las grabaciones cuyo narrador falta identificar, para investigarla con el tiempo. Esto también permite tener dos versiones del mismo título con distinta voz.

### Prioridad 2 — mejora la operación
- **Panel accesible para la bibliotecaria.** Revisar un lote y leer la reconciliación desde el panel, con teclado y lector de pantalla.
- **Correcciones de fondo.** Que un dato raro no vuelva a tumbar una pantalla entera (la causa del incidente del 21/09), que los capítulos se ordenen por su número real y que los géneros salgan del catálogo en vez de estar escritos en el código.

### Prioridad 3 — opcional
- **Cifras del aniversario** en el panel: horas de audio y socios activos.

## 4. Qué no incluye
- **Cambiar la estructura de la base de producción** (categorías, clasificaciones, registro de sesiones). Es un proyecto aparte, si el board lo decide.
- **Subir los 700 libros esta semana.** Esta entrega construye y demuestra el proceso. La carga real empieza cuando la BCC la apruebe.
- Integración real con SharePoint y el Bibliotecario Digital con IA.

## 5. Decisiones que necesitamos de la reunión

| # | Decisión | Recomendación | Por qué importa |
|---|---|---|---|
| D1 | ¿Adoptamos la estructura actual de producción como la oficial (sin categorías por ahora)? | **Sí** (Opción A del documento 13) | Desbloquea la carga sin tocar la base viva |
| D2 | ¿Quién de la BCC aprueba cada carga y cada corrección, y cómo queda registrado? | Una persona designada, con aprobación por escrito por lote | Es el mandato de gobernanza: nada en producción sin validación BCC |
| D3 | Los ~700 están en SharePoint/OneDrive de la BCC: ¿quién arma la planilla de cada lote? | Planilla con el formato del catálogo actual, más el narrador y la carpeta de audio | Define cuándo puede empezar la carga |
| D4 | ¿Unificamos los géneros duplicados ("Desarrollo personal" y "Desarrollo personal y bienestar", entre otros) y completamos los 4 libros sin género? | Sí, con la lista que valide la BCC | Hoy un socio que filtra por género no ve todos los libros |
| D5 | ¿Aprobamos corregir los 24 casos de audio sin ficha que tengan una coincidencia clara? | Sí, revisados uno por uno | Son libros ya grabados que se recuperan de inmediato |
| D6 | ¿Aprobamos agregar a la base el **estado de publicación** y el **narrador** de cada libro? (cambio que solo agrega datos, reversible) | Sí, por PR | Garantiza que ningún libro se vea sin audio y habilita "En Memoria" |

## 6. Cómo sabremos que funcionó
- **0 libros visibles sin audio** después de aplicar la reconciliación aprobada.
- **0 incidentes en producción** atribuibles a la carga.
- **Primer lote real** de los 700 cargado con su informe de evidencia, en la fecha que acordemos.
- Una persona con lector de pantalla puede revisar un lote desde el panel sin ayuda.

## 7. Riesgos
| Riesgo | Mitigación |
|---|---|
| Los 700 vienen con metadata incompleta o nombres inconsistentes | La validación los detecta antes de subir y devuelve la lista de correcciones |
| Cortes de red en subidas de cientos de GB | La carga es retomable y no vuelve a subir lo que ya está |
| Presión por la fecha lleva a cargar sin validar | La simulación es el modo por defecto y la carga real exige aprobación registrada |
| La versión de la API en producción es antigua | Esta entrega no depende de ella; su actualización es una decisión aparte |
