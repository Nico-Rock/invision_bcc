# Analysis — 001-biblioteca-actualizada

**Date:** 2026-09-26  **Validator:** `validate_artifacts.py` → GATE PASS (exit 0): 9 historias, 35 requisitos, 23 tareas, cobertura total.

## Hallazgos semánticos

| # | Severidad | Artefacto / ID | Hallazgo | Resolución |
|---|---|---|---|---|
| A1 | MEDIUM | spec R16(b), plan "Riesgos" | La API de producción es una versión vieja y no filtra por `publicado`, así que la garantía (b) no rige hasta desplegar una API que la respete. | Aceptado: la garantía (a) (audio antes que ficha) sostiene la promesa sola. Se deja escrito en el documento de aprobación de la migración (T21). |
| A2 | MEDIUM | Historia 9 (R32, R35), T10 | La verificación de aprobaciones lee `origin/main`, pero `origin/main` en GitHub solo tiene el commit inicial: los 17 commits de la carga accesible (rama `feat/carga-contenido-accesible`) y esta rama nunca se subieron. Sin integrar a `main` el trabajo previo, el primer PR de aprobación tendría un `main` desactualizado como base. | Antes del 29/09: subir las ramas y abrir los PRs (primero la carga accesible, después esta) para revisarlos en la reunión. **Requiere el OK de Nico: es una acción hacia afuera.** |
| A3 | MEDIUM | tasks (plazo) | 23 tareas en unos 2,5 días. | El orden prioriza lo que se muestra (grupos A–C = P1). Lo que no llegue queda con su estado real en el log y se presenta como plan, no como hecho. |
| A4 | LOW | constitución P7 menciona "Excel"; el plan solo lee CSV | Inconsistencia menor. | Una planilla Excel se guarda como CSV (tal como viene el catálogo actual). Si la BCC entrega `.xlsx`, se amplía `manifiesto.py` con un requisito nuevo. |
| A5 | LOW | spec V5 | Los conteos de producción (538/520/42/24) van a cambiar con el tiempo. | V5 ya admite "o explica la diferencia, con fecha". |
| A6 | LOW | T13 | Cambia a propósito el contrato de `crear_libro` (se va la categoría y entran editorial y narrador). Hay tests existentes que se van a ajustar. | Aceptado y trazado a R17. No se comenta ningún test (P16); se reescriben al nuevo contrato. |

| A7 | LOW | API `test_routes.py` | `test_stream_audio_simple_with_mock` ya fallaba antes de esta rama (`TypeError: 'list'...`, verificado con `git stash` el 2026-09-26). No es parte del spec 001. | Registrado como deuda. No se toca ni se comenta (P16). |
| A8 | MEDIUM | Datos de producción, R8 | Los géneros tienen 17 variantes de mayúsculas y minúsculas para ~10 géneros (`Infantil`/`INFANTIL`, `clásicos de la LITERATURA`...). SQL Server las agrupa y las esconde; el menú de la app las muestra por separado. | Suma evidencia a la decisión D4 del PRD. La reconciliación (T5) las reporta sin distinguir mayúsculas. |

| A9 | MEDIUM | Datos de producción | Hay fichas de prueba en el catálogo de producción que ven los socios: "A PRUEBA", "A PRUEBAA", "A PRUEBAAA", "A PRUEBAAAA" (sin género). | Se suma a la reconciliación y a la decisión D5 del PRD: la BCC aprueba borrarlas por PR. |
| A10 | LOW | API `crud.search_audio` | Cada búsqueda lista las 13.099 pistas de Blob desde Azure. Como solo devuelve libros con audio, el catálogo de la app muestra 481 títulos escuchables de 538 fichas. | La cifra es útil para la demo. El costo por búsqueda queda como deuda fuera del spec 001: podría reusar un índice como el del panel. |

| A11 | LOW | `frontend` (lint) | `npx eslint src` ya tenía 12 errores y 2 advertencias antes de esta rama, en los componentes de administración del sitio (p. ej. `isAdminUser` sin uso). | Deuda registrada. La verificación de T20 (`npm run lint`) se ajusta a lintear solo los archivos que toca, hasta que se limpie. |
| A12 | HIGH | Sitio, R25/T20, WCAG 2.4.7 | El filtro de géneros real (17 botones de la API) vive dentro de un contenedor `sr-only`: es invisible, pero recibe foco con Tab. La barra lateral visible muestra 2 categorías fijas que no filtran nada real. Quien tiene baja visión y usa el teclado pierde el foco de vista. axe no lo detecta. | T20 pasa a incluir mostrar esos géneros de forma visible y sacar los botones enfocables del contenedor oculto. Prioridad antes del despliegue del sitio. |

| A13 | HIGH | T27, T28 (R40, R41) | La revisión de código del 2026-09-26 encontró defectos que axe no detecta: el dictado puede capturar la voz del panel, los atajos dejan el foco en un elemento oculto, hay nombres accesibles distintos del texto visible (WCAG 2.5.3), las flechas capturan el scroll de las tablas, hay un destello blanco antes del alto contraste, los avisos se pisan y cada aviso se escucha dos veces con lector de pantalla. | No se parchean acá: pasan como requisitos al spec 002 (Historia 10, R34–R39; además R19, R26–R28 y R1). T27 y T28 quedan con evidencia de lo que sí cumplen; su corrección se traza en 002. |

| A14 | HIGH | T17 (R21), auditoría de seguridad | La guarda `SoloLectura` se evade sin `;` (T-SQL no lo exige) y con `SELECT … INTO`. El test solo cubría el caso con `;`. No se explota hoy (la consulta es literal), pero se documentaba como garantía. | R43 / T32: credencial de solo lectura en la base; hasta que se apruebe, el script no usa la credencial de escritura. |
| A15 | HIGH | Panel (previo a esta rama) | XSS almacenado en `renderBooks` y `loadUsers`: `innerHTML` con títulos de Blob y datos de `usuarios` de producción; podría robar el `ADMIN_TOKEN` de la página. | R44 / T30, antes de cualquier uso compartido del panel. |
| A16 | LOW | T3 (R3) | `indice_audio.error` expone el mensaje interno de Azure sin token. | R45 / T31. |

**Bloqueantes (CRITICAL/HIGH): 0.**

Chequeos de consistencia hechos:
- Todas las promesas de la lógica de decisión tienen su V#: cero escrituras en simulación (V6, V11), sin duplicados (V10, V12), sin libro visible sin audio (V14), sin pisar audio (V12 más el `subir_pista` existente), una fila mala no tumba una colección (V1, V18), nunca éxito falso (V3), nunca escritura sin PR (V26), nunca se pierde el narrador (V25).
- Ningún P1 depende de un P2 o P3 para funcionar: la carga por lotes (H3) usa el esquema actual de producción y no necesita la migración (H8/T21).
- Nada en `tasks.md` escribe en producción. T17 y T22 solo leen.

## Human Gate 1 — aprobación del diseño

| Rol | Nombre | Decisión | Fecha |
|---|---|---|---|
| Dueño técnico | Nico | **Aprobado**, con la condición de R36: la copia local es solo para la demo y el PR debe dejar la app apuntando a los datos reales | 2026-09-26 |

Los artefactos a revisar son `constitution.md` (v1.0.0), `spec.md`, `plan.md`, `tasks.md` y este análisis.
