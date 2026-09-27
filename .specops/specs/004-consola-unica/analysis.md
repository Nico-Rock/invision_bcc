# Analysis — 004-consola-unica

**Date:** 2026-09-26  **Validator:** `validate_artifacts.py` → GATE PASS (exit 0): 7 historias, 26 requisitos, 14 tareas, cobertura total.

## Origen
Nico, 2026-09-26: "el panel debería ser parte del sitio. ¿Cómo se pueden unificar para no tener 2 apps separadas que dependen de la misma infra?" Aceptó la propuesta de unificar en el administrador del sitio, en tres fases.

## Hallazgos semánticos

| # | Severidad | Artefacto / ID | Hallazgo | Resolución |
|---|---|---|---|---|
| E1 | **HIGH** | R11, T1 | La API actual (`presign-upload`) permite sobrescribir cualquier audio del contenedor: el nombre de archivo no se valida y el permiso SAS es de escritura por una hora (CWE-22). Existe hoy, independientemente de la unificación. | T1 va primero y no depende de nada. Se puede implementar y proponer por PR aunque el resto del spec espere. |
| E2 | HIGH (resuelto en diseño) | D5 | Con el proxy en 20 MB, la subida del panel (a través del servidor) no sirve en producción. | Subida directa a Blob con permiso `c` sin `w`: Azure impide sobrescribir y el commit de bloques evita archivos a medias. |
| E3 | MEDIUM | R19, R24 | Todo depende de desplegar la API nueva en producción, que hoy está desactualizada. | Fase 3 con documento de aprobación; el panel sigue hasta entonces (R18). |
| E4 | MEDIUM | Dependencias | Habilitar CORS `PUT` en Blob es un cambio de configuración de producción. | Va en el documento de aprobación (T12). |
| E5 | MEDIUM | R17, D8 | Un límite en memoria es por proceso. | Aceptable para el volumen actual; documentado con su salida. |
| E6 | LOW | R23, T10 | Depende del spec 003. | Si el 003 no está, las pestañas usan los atajos por defecto. |

**Bloqueantes sin resolver: 0.** E1 es un riesgo presente en producción: se recomienda priorizar T1.

## Relación con otros specs
- **003:** se ajusta a una sola app (zona "sitio" y zona "admin"); su grupo del panel pasa a depender de este spec.
- **002:** las pestañas nuevas usan su arnés como criterio (R22).
- **001:** se reutiliza el índice de audio y las reglas de carga ya verificadas.

## Human Gate 1 — aprobación del diseño

| Rol | Nombre | Decisión | Fecha |
|---|---|---|---|
| Dueño técnico | Nico | _pendiente_ | |
