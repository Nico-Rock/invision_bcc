# Verificación de accesibilidad de Invision

Procedimiento repetible del spec 002 (T28). Cualquier persona del equipo puede correrlo. El resultado es un informe con fecha y con el nombre de quien lo corrió. La regla: **no se afirma una cifra de accesibilidad sin un informe de acá detrás.**

## Qué mide y qué no

| Mide (automático) | No mide (hace falta una persona) |
|---|---|
| axe-core WCAG 2.2 AA (versión fijada en `vendor/`) | Si el lector de pantalla lee bien, en orden y sin repetir |
| Contraste AAA texto por texto, componiendo fondos con alfa y el faro | Si un aviso llega en el momento justo |
| Objetivos táctiles de 48 px | Dictado con micrófono y parlantes reales |
| Controles fuera de vista con texto al 200 % y a 320 px | Comodidad real para baja visión |
| Cantidad de regiones vivas (tiene que ser 2) | |
| Enfocables invisibles y nombre accesible distinto del texto visible | |

Para lo que no se mide solo, está la [matriz de lectores de pantalla](matriz-lectores.md).

## 1. Panel operativo (http://localhost:8888)

1. Levantar el panel: `.venv/bin/python admin-dashboard/server.py 8888`.
2. Tests sin navegador: `.venv/bin/python -m pytest admin-dashboard -q`. Incluye la estructura accesible (`tests/test_a11y_estatico.py`) y la lógica JS (`tests/js/`, con `node --test`).
3. Servir esta carpeta: `python3 -m http.server 8899 --bind 127.0.0.1 -d verificacion/a11y`.
4. En la consola del navegador, con el panel abierto:
   ```js
   for (const f of ['medir.js', 'recorrido-panel.js'])
     await new Promise(ok => { const s = document.createElement('script'); s.src = `http://127.0.0.1:8899/${f}`; s.onload = ok; document.head.appendChild(s); });
   Medir.base = 'http://127.0.0.1:8899';
   const r = await RecorridoPanel.correr({ textos: [12, 16, 24, 32], axeEn: ['overview','logs','books','users','governance','carga'] });
   r.totales  // { combinaciones: 48, conProblemas: 0 } es el resultado esperado
   ```
5. Guardar el resultado en `informes/AAAA-MM-DD-panel-<quien>.json`.

## 2. Sitio público (http://localhost:3000)

1. Levantar la API local **con SQLite explícito** (nunca producción) y el sitio (`cd frontend && npm run dev`).
2. Exportar las credenciales demo **solo en la terminal**, nunca en archivos versionados: `INVISION_DEMO_EMAIL` e `INVISION_DEMO_PASSWORD`.
3. `cd frontend && npm run test:a11y`. Usa Chrome del sistema; con `PW_CHANNEL=chromium` usa el de Playwright.
4. Sin API o sin credenciales, los casos con sesión se saltean **con motivo**. Un informe con casos salteados no vale como aprobación.

## 3. Registro

| Fecha | App | Corrió | Resultado | Informe |
|---|---|---|---|---|
| 2026-09-26 | Panel | Claude Code (agente) | 48/48 combinaciones sin problemas, axe 0 | `informes/2026-09-26-panel-p1.json` |
| 2026-09-26 | Sitio | Claude Code (agente) | 13/13 casos | salida de `npm run test:a11y` |
| | | *persona del equipo (pendiente, T28)* | | |

El criterio de T28 pide que lo corra **alguien que no lo escribió**. Hasta entonces, este procedimiento está escrito pero no validado.
