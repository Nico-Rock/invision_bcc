# Analysis — 003-catalogo-atajos

**Date:** 2026-09-26  **Validator:** `validate_artifacts.py` → GATE PASS (exit 0): 7 historias, 26 requisitos, 12 tareas, cobertura total.

## Origen
Pedido de Nico del 2026-09-26: "los usuarios de esta aplicación usarán lectores de pantalla y navegación en base a atajos de teclado y comandos especiales, por eso todas las funciones deben ser customizadas desde el administrador, mediante un catálogo de teclas, funciones y acciones". Sus respuestas: alcance sitio y panel; solo el admin edita; guardado en base vía PR; spec antes de código.

## Ajuste del 2026-09-26 (unificación, spec 004)
Nico decidió que el panel sea parte del sitio. El catálogo pasa de "una sección por app" a **una app con dos zonas**, "sitio" y "admin". La Historia 3 ahora es la consola de administración. El panel operativo conserva sus atajos hasta retirarse y no recibe trabajo nuevo (R13). El validador se volvió a correr: GATE PASS, 26 requisitos, 12 tareas.

## Hallazgos semánticos

| # | Severidad | Artefacto / ID | Hallazgo | Resolución |
|---|---|---|---|---|
| C1 | HIGH (resuelto en diseño) | R14, §4 | "Solo el admin" choca con WCAG 2.1.4, que pide que **la persona usuaria** pueda apagar o reasignar los atajos de un carácter. | Se cumple por la otra vía que admite el criterio: los globales llevan modificador y las teclas sueltas actúan solo con el foco en el reproductor. El validador lo impone. Queda como decisión **A5** del PRD, para confirmar en la reunión. |
| C2 | HIGH (resuelto en diseño) | R19, D5 | La API crea sus tablas sola al arrancar (`create_all`): sin cuidado, el catálogo aparecería en producción con el próximo despliegue. | Tablas en una `BaseAtajos` separada, más un test que lo verifica y el DDL por aprobación. |
| C3 | MEDIUM | D3 | Cambiar S, H, 1–6 y G a Alt + Mayúscula cambia hábitos del equipo y de los socios. | Ayuda generada, bienvenida con la nueva combinación y prueba con lectores. Se presenta lado a lado en la reunión. |
| C4 | MEDIUM | D4 | Las reglas viven en Python y en JS, y pueden divergir. | Un solo archivo de casos, corrido por `pytest` y `node --test`. |
| C5 | LOW | Caso borde 2 | Hay combinaciones de navegadores o lectores que no están en la lista de reservadas. | La lista vive en el JSON, se amplía con la matriz de lectores y se muestra al administrador. |
| C6 | LOW | Plazo | 12 tareas; la reunión es el 29/09. | Para la demo alcanzan los grupos A a C con la base local. El panel (D) y la verificación (E) se completan después si no llegan. |

**Bloqueantes sin resolver: 0.** C1 y C2 tienen resolución de diseño; C1 necesita confirmación en la reunión.

## Human Gate 1 — aprobación del diseño

| Rol | Nombre | Decisión | Fecha |
|---|---|---|---|
| Dueño técnico | Nico | _pendiente_ | |

Revisar: `spec.md` (en especial §4 y la Historia 4), `plan.md` (D3, D5 y D10) y la decisión A5.
