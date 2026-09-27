# Plan — 005-administracion-sin-ver

> CÓMO. Cada decisión cita el requisito (R#) o el principio (P#) que la justifica.
> Constitución: `.specops/constitution.md` v1.2.0.

**Status:** constitution-checked  **Author:** Nico (vía Claude Code)  **Date:** 2026-09-26

## Hallazgos que condicionan el plan (verificados)
1. `sharepoint.py` (`ingest_audiobook_files`) sube `dummy mp3 content` con `overwrite=True` a `{libro}/Capitulo 1.mp3`, y `/admin/importar-lote` lo encola sin informar el resultado.
2. `presign-upload` firma escritura por una hora sobre `{libro}/{filename}` sin validar el nombre (CWE-22).
3. `/users/` responde con `UserResponse`, que no incluye roles; `Usuario.roles` → `UserRole.role` existe en el modelo.
4. `/admin/auditoria/sesiones/` devuelve solo `usuario_id`.
5. `Audiolibro` no tiene narrador. Agregar una columna al modelo haría que **toda consulta** a `audiolibros` la pida y falle en producción, donde no existe (P13).
6. La API arranca con `Base.metadata.create_all`: una tabla registrada en `Base` se crearía sola al desplegar (P12).
7. La API local corre con el código montado y `--reload`; los tests usan una SQLite propia (`test_database.py`).

## Architecture

| # | Decisión | Justifica |
|---|---|---|
| D1 | **Validación de pistas** en `audiobooks/validacion_pistas.py`: sin `/`, `\` ni `..`, extensión `.mp3`, largo máximo de 200 y sin caracteres de control. `presign-upload` la usa, responde `{"estado": "existe"}` si el blob ya está y, si no, firma un SAS con `BlobSasPermissions(create=True)` **sin `write`**, válido 15 minutos. Azure rechaza así cualquier sobrescritura. | R3 |
| D2 | **Ingesta deshabilitada**: `/admin/importar-lote` responde 503 con un texto claro y no crea ni encola nada. `ingest_audiobook_files` deja de subir contenido: lanza `NotImplementedError` si alguien lo llama. La pestaña pasa a una explicación con enlace a "Libros". Se quita la dependencia `xlsx` del sitio (única pantalla que la usaba y con avisos de seguridad en `npm audit`). | R1, R2 |
| D3 | **Roles en `/users/`**: `UserResponse` suma `roles: List[RoleInfo] = []`, armado desde `Usuario.roles`. **Auditoría** con `usuario` (username y correo) mediante un join. | R11, R12 |
| D4 | **Narrador sin tocar `audiolibros`**: tabla aparte `audiolibro_narracion` (`audiolibro_id` PK/FK, `narrador`, `en_memoria`, `actualizado_en`) en una `BaseExtras` fuera del `create_all`. `narracion_habilitada(db)` consulta el inspector; sin la tabla, los GET devuelven `narracion_habilitada: false` y los POST/PUT guardan el libro e informan `narracion: "no_habilitada"`. En local se crea con `scripts/habilitar_extras.py` (solo SQLite); en producción, con el DDL de `aprobaciones/2026-09-29_narrador_en_memoria.md`. | R6, R7, R28 |
| D5 | **Consola ordenada**: en `/admin` se oculta la navegación de géneros de socios; `AdminPanel` abre en "Libros", tiene Inicio y Fin, y hace un solo anuncio con el nombre visible; los componentes dejan de anunciar al montarse; cada pestaña tiene su `h2` con total. | R13, R14 |
| D6 | **Un control por fila**: la tabla de libros muestra Título, Autor, Narrador, Género y "Gestionar" (nombre accesible "Gestionar [título]"). "Gestionar" abre la **ficha** en un `Dialogo`: formulario, capítulos y "Eliminar". Eliminar cambia la ficha a una **vista de confirmación** (sin modal dentro de modal) que explica las consecuencias y arranca con el foco en "Cancelar". Usuarios sigue el mismo patrón. El buscador anuncia el conteo por el canal cortés, 800 ms después de la última tecla. | R8, R9, R10 |
| D7 | **Capítulos desde la ficha** (`CapitulosLibro.jsx`): campo de archivo visible (`multiple`, `.mp3`), orden por número de capítulo (misma regla que la API y el panel), lista `<ol>` visible y anunciada, subida secuencial (permiso → `PUT` directo a Blob con `x-ms-blob-type: BlockBlob` → aviso por pista), salteo de las que ya existen, reintento solo de las fallidas y foco en el próximo paso. Toma el modelo de interacción de `carga.js`. | R5 |
| D8 | **Vocabulario**: `src/lib/vocabulario.js` con `normalizar` (minúsculas, sin tildes, sin plural final) y `parecido(valor, existentes)`. Los campos género, autor y narrador usan `<datalist>` con los valores existentes. Al guardar, si un valor nuevo se parece a uno existente, la ficha pasa a una vista "¿Es el mismo?" con tres salidas: usar el existente, guardar como nuevo o volver. | R15 |
| D9 | **Contraseñas**: botón "Mostrar contraseña" / "Ocultar contraseña" con `aria-pressed`, y botón "Generar contraseña" que arma palabra + palabra + número (fácil de dictar) y la anuncia deletreada por grupos. | R17 |
| D10 | **Errores**: toda llamada de error en la consola usa `{ urgente: true }`; los formularios marcan `aria-invalid`, describen el error con `aria-describedby` y devuelven el foco al campo. | R4 |
| D11 | **Contraste**: los colores fijos de la consola en `index.css` (eliminar, insignias, avisos) pasan a los tokens AAA. | R16 |
| D12 | **Arnés de la consola**: `frontend/tests/a11y/consola.spec.js` con `INVISION_ADMIN_EMAIL` e `INVISION_ADMIN_PASSWORD` (solo en el entorno). Mide axe, AAA y 48 px en las pestañas y cubre V4 y V7 a V14. La subida (V5) se prueba con el permiso y el `PUT` simulados con `page.route`: **nunca escribe en el almacenamiento real**. | R16, R29 |

## Grupos B y C (pendientes de Gate 1), a nivel de diseño
- **Inicio y publicación (R18, R19):** estado derivado de ficha + índice de audio (spec 004) + tabla `audiolibro_publicacion` fuera del `create_all`; los socios filtran por publicado.
- **Verificación de audio (R20):** análisis en el servidor al confirmar la subida (duración con `mutagen`, tamaño, detección de silencio), guardado junto a la pista.
- **Tareas (R21) e importador (R22):** tabla `tareas_admin` con estado por libro; importador con mapeo explícito, validación en el servidor y CSV; parser de planillas con una librería sin avisos de seguridad.
- **Papelera y fusión (R23, R24):** borrado lógico con fecha; historial de valores; fusión transaccional con vista previa.
- **Perfiles (R25):** tabla `perfil_accesibilidad`; el sitio aplica las preferencias iniciales en el primer ingreso.
- **Auditoría de contenido e informe (R26, R27):** reutiliza `operaciones_admin` del spec 004.

## Tech stack
Sin tecnología nueva en el grupo A. Se quita `xlsx`.

## Data model / schemas

```
audiolibro_narracion   (fuera del create_all)
  audiolibro_id   entero, clave, referencia a audiolibros.id
  narrador        texto(200)
  en_memoria      booleano
  actualizado_en  fecha y hora (UTC)
```

## Contracts / interfaces
- `POST /audiolibros/{id}/capitulos/presign-upload?filename=` → `{estado: "subir", sas_url, blob_path}` | `{estado: "existe", blob_path}` | 422 `{detail}`.
- `POST /admin/importar-lote` → 503 `{detail: "La ingesta desde SharePoint está deshabilitada..."}`.
- `GET /users/` → cada usuario con `roles: [{id, name}]`.
- `GET /admin/auditoria/sesiones/` → cada evento con `usuario: {username, email}`.
- `GET /admin/audiolibros` → cada libro con `narrador`, `en_memoria` y el indicador `narracion_habilitada`.
- `POST|PUT /admin/audiolibros` aceptan `narrador` y `en_memoria` (opcionales).

## Dependencies
Ninguna nueva. Se elimina `xlsx`.

## Risk mitigation & security gate (CWE mapping)
- **CWE-22 (path traversal):** D1.
- **CWE-20 / CWE-79:** validación en el servidor (esquemas Pydantic con largos máximos); todo se muestra con React.
- **CWE-862 / CWE-285:** las rutas nuevas y modificadas conservan la verificación del rol Admin en el servidor.
- **CWE-200 / CWE-209:** la auditoría muestra usuario y correo solo a Admin; los errores no llevan detalle de Azure.
- **Integridad del contenido:** permiso de solo creación (D1), ingesta deshabilitada (D2).
- **Dependencias:** se quita `xlsx`.

## Constitution check
- **P5:** cumple. Test de API por cambio, visto en rojo; arnés de la consola.
- **P8:** cumple. Ver CWE.
- **P10:** cumple. Ningún éxito sin confirmación (R2).
- **P12, P13:** cumple. Narrador en tabla aparte, fuera del `create_all`, con aprobación.
- **P14, P17:** cumple. Toda decisión parte del administrador ciego.

## Risks & open questions
- **Subida real en local:** la API local firma permisos contra el almacenamiento real. El arnés los simula, pero una persona que use la consola local **sí sube al almacenamiento de producción**, igual que hoy el panel. Se avisa en la ficha ("Las pistas se suben al almacenamiento real").
- **CORS de Blob:** la subida desde el navegador requiere que el almacenamiento acepte `PUT` desde el origen del sitio. Si no está habilitado, la subida falla con aviso urgente y la configuración va al documento de aprobación.
- **Tamaño de la tabla:** con más de 1.200 fichas, una tabla sin paginar sigue siendo larga; el control por fila y el buscador lo mitigan, y la paginación entra con el Inicio (R18).
