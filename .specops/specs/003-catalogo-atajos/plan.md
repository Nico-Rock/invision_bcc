# Plan — 003-catalogo-atajos

> CÓMO. Cada decisión cita el requisito (R#) o el principio (P#) que la justifica.
> Constitución: `.specops/constitution.md` v1.2.0.

**Status:** constitution-checked  **Author:** Nico (vía Claude Code)  **Date:** 2026-09-26

## Hallazgos que condicionan el plan (verificados en el código)
1. La API crea sus tablas sola al arrancar (`Base.metadata.create_all(bind=engine)` en `audiobooks/main.py:36`). Si los modelos del catálogo se registran en esa `Base`, **el próximo despliegue crearía las tablas en producción sin aprobación**, lo que viola P12 y R19.
2. El control de admin de la API es por rol dentro del JWT (`"Admin" in decode_access_token(token)["roles"]`, patrón de `routes.py:644`).
3. El panel operativo se unifica en el sitio (spec 004) y se retira después: no se le agrega el catálogo y conserva sus atajos durante la transición.
4. Los atajos actuales viven en dos fuentes únicas separadas: `admin-dashboard/static/a11y-logica.js` (`ATAJOS`) y `frontend/src/hooks/useKeyboardShortcuts.js` (`ATAJOS_SITIO`). Varias son teclas sueltas globales (S, H, 1–6, G) que no cumplen WCAG 2.1.4 bajo la decisión "solo el admin".

## Architecture

| # | Decisión | Justifica |
|---|---|---|
| D1 | **Un archivo de catálogo por defecto**: `InvisionAPI-main/audiobooks/atajos_catalogo.json`. Cada acción declara `zona` (`sitio` o `admin`), `accion` (id estable), `nombre`, `descripcion`, `alcance` (`global` o `reproductor`), `teclas` por defecto y `obligatoria`. También incluye la lista de combinaciones reservadas, con quién las usa. Es la única fuente de las acciones: el administrador no puede crear otras. | R1, R2, R15 |
| D2 | **Formato de combinación por tecla física**: `Alt+Shift+KeyH`, con los modificadores en orden fijo y el `KeyboardEvent.code` de la tecla. De ahí se derivan el `aria-keyshortcuts` (`Alt+Shift+H`) y el texto hablado ("Alt más Mayúscula más H"). Funciona igual en teclados en español, latinoamericanos e ingleses. | R4, R7, caso borde 3 |
| D3 | **Valores por defecto conformes**: las acciones globales pasan a Alt + Mayúscula + tecla (sección 1–6, buscador, géneros, ayuda). Las del reproductor mantienen Espacio, flechas, N, P y M, con alcance `reproductor`. Escape queda para "Cerrar". | R14, R17, R18, A5 |
| D4 | **Reglas en un módulo Python puro**, `audiobooks/atajos.py`, sin FastAPI ni SQLAlchemy. Lo usa la API (autoridad, R25). Las mismas reglas se replican en JS para avisar antes de enviar. Las dos versiones se prueban contra **un solo archivo de casos**, `audiobooks/atajos_casos.json`, que corren `pytest` y `node --test`. Si las versiones divergen, falla un test. | R5, R14–R18, R25 |
| D5 | **Tablas fuera del `create_all`**: los modelos `AtajoTeclado` y `AtajoHistorial` usan una `BaseAtajos` propia, que el arranque de la API no crea. En local se crean con `scripts/habilitar_atajos.py` (solo acepta SQLite). En producción se crean con el SQL de `aprobaciones/2026-09-29_catalogo_atajos.md`, que trae su reversión. | R19, R21, R24, P12, P13 |
| D6 | **Estado "no habilitado"**: si la tabla no existe (inspector de SQLAlchemy), `GET /atajos` devuelve los valores por defecto con `origen: "defecto"`, y la edición responde 503 con "el catálogo todavía no está habilitado en esta base". | R9, R13, R20 |
| D7 | **API**: `GET /atajos?zona=sitio`, pública (las teclas no son sensibles), y `GET /atajos?zona=admin`, solo con rol Admin; devuelve la combinación del catálogo por defecto con lo guardado, más `origen` y `version`. `GET /admin/atajos` devuelve todo más el historial. `PUT /admin/atajos/{zona}/{accion}` guarda `teclas`, `activo` y `descripcion`. `POST /admin/atajos/restaurar` restaura una acción o una zona. Todas las rutas `/admin` verifican el rol Admin en el servidor. | R1, R3, R22, R23 |
| D8 | **Historial**: cada guardado o restauración escribe una fila en `atajos_historial` (antes, después, usuario, fecha), en la **misma transacción** que el cambio. | R22, R23, promesa "nada a medias" |
| D9 | **Sitio**: `src/lib/atajos.js` convierte eventos a combinaciones y combinaciones a texto, y replica las reglas. Un `AtajosProvider` carga `/atajos?app=sitio` al iniciar, con respaldo en `src/lib/atajos-defecto.json`. Ese archivo se genera del JSON de la API y un test detecta si se desincroniza. `useKeyboardShortcuts` pasa a un mapa `accion → función`. La ayuda, el `aria-keyshortcuts` y los anuncios salen del catálogo cargado. | R7–R10 |
| D10 | **Alcance "reproductor"**: la acción responde solo si `document.activeElement` está dentro de `.player-dock`. El reproductor gana un atajo global (Alt + Mayúscula + R por defecto) para llevar el foco a sus controles. Así las teclas sueltas nunca actúan fuera de él. | R10, R14 |
| D11 | **Pantalla de edición**: nueva pestaña "Atajos de teclado" en `AdminPanel`. Tiene una tabla por app con acción, descripción editable, combinación y un interruptor de activa, más el botón "Cambiar". Ese botón abre un `Dialogo` con dos vías: un campo de **captura** ("presioná la combinación", que anuncia lo capturado) y un campo de **texto** con el formato de D2. Los errores van al canal urgente, con `aria-invalid` y el nombre de la acción en conflicto. Debajo está el historial, y cada zona tiene "Restaurar por defecto". | R4, R5, R6, R22, R23 |
| D12 | **Zona admin**: `AtajosProvider` pide `zona=admin` solo si la cuenta tiene rol Admin y combina las dos zonas; las pestañas de la consola (spec 004) registran sus acciones en el mismo mapa `accion → función`. El panel operativo no se modifica (R13). | R11, R12, R13 |

## Tech stack
Sin tecnología nueva: FastAPI + SQLAlchemy 1.4 (API), React 19 (sitio), `pytest`, `node --test` y Playwright (ya instalados en el spec 002).

## Data model / schemas

```
atajos_teclado
  id               entero, clave
  zona             texto(10)   'sitio' | 'admin'
  accion           texto(40)   id del catálogo por defecto
  teclas           texto(60)   formato D2, vacío = sin tecla
  activo           booleano
  descripcion      texto(200)  la que se lee en la ayuda
  actualizado_por  entero      id de usuario
  actualizado_en   fecha y hora (UTC)
  único (zona, accion)

atajos_historial
  id, zona, accion, teclas_antes, teclas_despues, activo_antes, activo_despues,
  usuario_id, fecha (UTC)
```

Solo se guardan las acciones que el administrador cambió; el resto sale del JSON (caso borde 4).

## Contracts / interfaces
- `atajos.validar(zona, accion, teclas, activo, catalogo_actual) -> Resultado(ok, regla, mensaje, conflicto)`. Las reglas se evalúan en el orden de la lógica de decisión del spec.
- `atajos.combinar(defecto, guardados) -> catalogo` y `atajos.texto_hablado(teclas) -> str`.
- Códigos HTTP de la API: 403 sin rol Admin, 422 regla violada (el cuerpo lleva `regla` y `conflicto`), 503 catálogo no habilitado, 200 guardado.
- En JS (`src/lib/atajos.js` y `a11y-logica.js`): `deEvento(e) -> teclas`, `aAria(teclas)`, `aTexto(teclas)`, `validar(...)`, con los mismos casos que Python.

## Dependencies
Ninguna nueva.

## Risk mitigation & security gate (CWE mapping)
- **Input sanitization (CWE-20 / CWE-79):** la API valida todo con `atajos.py`. Las teclas se aceptan solo con el formato D2 y un largo máximo, y las descripciones hasta 200 caracteres. En pantalla todo se muestra con React o `textContent`, nunca con `innerHTML`.
- **Authentication / authorization (CWE-285, CWE-862, CWE-863):** el rol Admin se verifica en el servidor en cada ruta `/admin/atajos` y en `GET /atajos?zona=admin`.
- **SQL (CWE-89):** solo ORM con parámetros.
- **Secrets / sensitive data exposure (CWE-798, CWE-200):** el historial guarda el id de usuario, no el correo; `GET /atajos` no expone quién cambió qué.
- **Error handling (CWE-209):** los mensajes de rechazo nombran la regla, no detalles internos.
- **Performance / memory overhead:** el catálogo pesa menos de 5 KB y se carga una vez por página.

## Constitution check
- **P1:** cumple. Sin frameworks nuevos.
- **P2:** cumple. Las acciones salen de un solo JSON y las teclas de la base.
- **P3, P5:** cumple. Las reglas tienen casos compartidos Python/JS; hay tests de API y arnés del sitio.
- **P8:** cumple. Ver CWE.
- **P12, P13:** cumple. Las tablas quedan fuera del `create_all`, el script va por aprobación y sin tabla se usan los valores por defecto.
- **P14, P17:** cumple. Las reglas de la Historia 4 imponen WCAG 2.1.4 sobre cualquier configuración del administrador.

## Risks & open questions
- **Cambio de hábitos (A5):** pasar de teclas sueltas a Alt + Mayúscula cambia lo que el equipo ya conoce. Se mitiga con la ayuda generada y un anuncio de bienvenida que menciona la nueva combinación.
- **Alt + Mayúscula en macOS:** con Opción + Mayúscula macOS produce caracteres especiales. Como el formato usa `code` y no `key`, la combinación se reconoce igual. Se verifica en la matriz de lectores (VoiceOver).
- **`create_all` futuro:** si alguien registra estos modelos en la `Base` principal, se pierde la protección. Un test verifica que `Base.metadata` no contiene las tablas del catálogo.
- **Solo admin frente a WCAG 2.1.4:** la conformidad depende de que los globales lleven modificador. Si la reunión prefiere teclas sueltas, se necesita personalización por usuario (nuevo spec).
