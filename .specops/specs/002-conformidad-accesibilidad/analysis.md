# Analysis — 002-conformidad-accesibilidad

**Date:** 2026-09-26  **Validator:** `validate_artifacts.py` → GATE PASS (exit 0): 10 historias, 39 requisitos, 29 tareas, cobertura total.

## Cómo se produjo este spec (trazabilidad del proceso)

| Insumo | Aporte | Tratamiento |
|---|---|---|
| Marco del vault *Invision - Accesibilidad y Discapacidad Visual* | Estándar de referencia | Se midió punto por punto en el navegador; dos cifras del propio marco resultaron incorrectas (R9, R23) |
| Skills *designing-interfaces* (modo Review, entregable dashboard) y *uiux-design* | Método de revisión y derivación de paleta | Donde la skill contradijo al marco (negro y blanco puros en modo oscuro), ganó el marco por P17 (decisión previa registrada) |
| Agente Explore: auditoría del sitio contra el marco | 22 brechas con archivo y línea | Se sumaron como R21, R26–R33; se confirmaron por muestreo (atajo S, `sr-only`, `App.css` no importado) |
| Agente de revisión de código (T24–T29 de 001) | 1 crítico, 8 importantes, 11 menores | Historia 10 (R34–R39), más R19, R26–R28 y R1. Registrado como A13 en 001 |
| Agente de auditoría de seguridad | Guarda de solo lectura evadible, XSS almacenado, fuga de mensajes | Van al spec 001 (R43–R45, T30–T32, A14–A16) porque pertenecen a su código; la constitución sube a v1.2.0 (P8) |
| Agente Plan: borrador y adenda | Arquitectura, tokens, contratos, tareas | Integrado y revisado: se verificaron sus afirmaciones clave (`alert()` en `:1526`/`:1529`, `role="status"` en `:1076`); se ajustó la voz por defecto (A3) y el patrón de interruptores |

## Hallazgos semánticos

| # | Severidad | Artefacto / ID | Hallazgo | Resolución |
|---|---|---|---|---|
| B1 | MEDIUM | R28, D7 | El valor por defecto de la "Lectura en voz" es una decisión de producto con impacto opuesto según el usuario: encendida ayuda a personas mayores sin lector, pero duplica avisos a quien usa lector hasta que la apague. | Decisión A3 del PRD para la reunión. El código la deja como constante única. |
| B2 | MEDIUM | R15, D14 | ↑↓ con el reproductor abierto compiten con el desplazamiento de página. | Guardas de D14. Si la prueba con usuarios lo marca, se limita al foco dentro del reproductor. |
| B3 | MEDIUM | R7, tokens | El naranja AAA `#8F2F00` cambia visiblemente la marca. | Decisión A1 del PRD (con P17 ya ratificada por Nico). `#D34500` sigue en todo lo que no es texto. Se muestra lado a lado en la reunión. |
| B4 | LOW | R9, `--status-ok` | En alto contraste, el verde de estado es igual al anillo de foco. | Se distinguen por forma. Riesgo registrado en el plan. |
| B5 | LOW | R22, T28 | La prueba con lectores de pantalla reales no la puede hacer un agente. | Decisión A2 del PRD: la hace una persona usuaria, con fecha y nombre. |
| B6 | LOW | Plazo | 29 tareas; la reunión es en 3 días. | Para el 29/09 alcanzan los grupos A y B (T1–T12). El resto se presenta como plan, con su estado real. |

**Bloqueantes (CRITICAL/HIGH): 0.**

Chequeos hechos:
- Cada promesa de la lógica de decisión tiene su V#: nunca texto bajo 7:1 (V6, V7), nunca control fuera de vista (V2, V3), nunca interrupción que no sea error (V4), nunca enfocable invisible (V14), nunca foco tapado (V10), nunca afirmación sin medición (V15, V16).
- Ningún P1 depende de un P2: los grupos A y B no usan nada de C, D ni E.
- R24 protege lo ya verificado en 001 (axe en 0, atajos, preferencias, faro). T12 lo vuelve a medir.

## Human Gate 1 — aprobación del diseño

| Rol | Nombre | Decisión | Fecha |
|---|---|---|---|
| Dueño técnico | Nico | _pendiente_ | |

Artefactos a revisar: `constitution.md` v1.2.0 (enmiendas 1.1.0 y 1.2.0 pendientes de ratificación), `spec.md`, `plan.md`, `tasks.md`, este análisis y el PRD `docs/prd/2026-09-29-accesibilidad-verificable-prd.md`.
