# Analysis — 005-administracion-sin-ver

**Date:** 2026-09-26  **Validator:** `validate_artifacts.py` → GATE PASS (exit 0): 12 historias, 30 requisitos, 18 tareas, cobertura total.

## Origen
[Auditoría del 2026-09-26](../../../docs/auditoria/2026-09-26-auditoria-ux-administrador-ciego.md) con la skill *designing-interfaces*. Nico: "spec 005 y repara todos los problemas".

## Hallazgos semánticos

| # | Severidad | Artefacto / ID | Hallazgo | Resolución |
|---|---|---|---|---|
| F1 | HIGH | R5, riesgos | La API local firma permisos contra el almacenamiento real: quien use la consola local sube a producción, igual que hoy el panel. | El arnés simula permiso y `PUT`; la ficha avisa que las pistas van al almacenamiento real. |
| F2 | MEDIUM | R7, D4 | El narrador no puede ser columna de `audiolibros` sin romper producción. | Tabla aparte, fuera del `create_all`, con degradación y aprobación. |
| F3 | MEDIUM | R1 | Deshabilitar la ingesta quita una función visible. | No funcionaba: escribía audio falso. Se reemplaza por una explicación, y la transferencia real queda como spec aparte basado en R21 y R22. |
| F4 | LOW | R9 | La papelera (R23) espera Gate 1; mientras tanto, el borrado sigue siendo definitivo. | El diálogo con el foco en "Cancelar" y las consecuencias explicadas reduce el riesgo. |
| F5 | LOW | CORS | La subida desde el navegador requiere CORS de `PUT` en Blob. | Si falla, aviso urgente; la configuración va a aprobación. |
| F6 | MEDIUM | Rendimiento (fuera de alcance) | `crud.search_audio` lista los 13.099 archivos del almacenamiento en **cada** búsqueda de un socio: explica los 9 a 11 s por pedido de la API local. | No se tocó (no es de este spec). Con el índice en segundo plano que ya tiene la API (`indice_audio.py`, D13) se resuelve; se propone como tarea del spec 006 o de la fase 1 del 004. |
| F7 | MEDIUM | Verificación de audio | El silencio largo no se detecta sin decodificar. | Se dice en pantalla. Requiere aprobar ffmpeg como dependencia de la imagen. |

**Bloqueantes: 0.**

## Human Gate 1

| Rol | Nombre | Decisión | Fecha |
|---|---|---|---|
| Dueño técnico | Nico | **Grupo A aprobado**: "spec 005 y repara todos los problemas" | 2026-09-26 |
| Dueño técnico | Nico | **Grupos B y C aprobados**: "dale con todo" | 2026-09-26 |
