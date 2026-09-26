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

**Bloqueantes (CRITICAL/HIGH): 0.**

Chequeos de consistencia hechos:
- Todas las promesas de la lógica de decisión tienen su V#: cero escrituras en simulación (V6, V11), sin duplicados (V10, V12), sin libro visible sin audio (V14), sin pisar audio (V12 más el `subir_pista` existente), una fila mala no tumba una colección (V1, V18), nunca éxito falso (V3), nunca escritura sin PR (V26), nunca se pierde el narrador (V25).
- Ningún P1 depende de un P2 o P3 para funcionar: la carga por lotes (H3) usa el esquema actual de producción y no necesita la migración (H8/T21).
- Nada en `tasks.md` escribe en producción. T17 y T22 solo leen.

## Human Gate 1 — aprobación del diseño

| Rol | Nombre | Decisión | Fecha |
|---|---|---|---|
| Dueño técnico | Nico | _pendiente_ | |

Los artefactos a revisar son `constitution.md` (v1.0.0), `spec.md`, `plan.md`, `tasks.md` y este análisis.
