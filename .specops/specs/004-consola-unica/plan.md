# Plan — 004-consola-unica

> CÓMO. Cada decisión cita el requisito (R#) o el principio (P#) que la justifica.
> Constitución: `.specops/constitution.md` v1.2.0.

**Status:** constitution-checked  **Author:** Nico (vía Claude Code)  **Date:** 2026-09-26

## Hallazgos que condicionan el plan (verificados en el código)
1. **Repetición real.** Usuarios, auditoría de sesiones, alta de libros, subida de capítulos y categorías ya existen en la API (`routes.py`: `/users`, `/admin/auditoria/sesiones/`, `/admin/audiolibros`, `/audiolibros/{id}/capitulos/presign-upload`, `/admin/categorias`) y en las pestañas de `/admin`. Solo el panel tiene el resumen con el índice de Blob, el explorador con escucha previa, la carga guiada (`carga.js`) y la gobernanza.
2. **Vulnerabilidad en la API actual (CWE-22).** `presign-upload` arma `blob_name = f"{audiolibro.nombre}/{filename}"` con el `filename` tal como llega, y firma un permiso SAS de **escritura** por una hora. Con `../` o un nombre existente se puede sobrescribir cualquier audio del contenedor.
3. **Límite del proxy.** `nginx_test.conf` fija `client_max_body_size 20M`. Una pista puede pesar más, así que la subida no puede pasar por la API: tiene que ir del navegador directo a Blob.
4. **La API ya tiene cliente de Blob** (`config.py`: `blob_service_client`, `container_client`) y el patrón de rol Admin en el JWT.
5. **Código del panel reutilizable y probado:** `invision/indice_blob.py` (índice en segundo plano, orden de capítulo, error sin detalle), `invision/esquema.py` (degradación por tabla faltante), validaciones de `subir_pista` y la lógica de `carga.js`.

## Architecture

| # | Decisión | Justifica |
|---|---|---|
| D1 | **Router nuevo `audiobooks/admin_ops.py`**, montado en `/admin/ops`. Una dependencia `requiere_admin` verifica el rol en el JWT **una sola vez** para todo el router: ninguna ruta puede olvidarse el control. | R13 |
| D2 | **Índice de audio en la API**: `indice_blob.py` pasa a `audiobooks/` sin cambios de lógica, con el `container_client` de la API. Arranca en segundo plano con la app. `GET /admin/ops/resumen` devuelve cifras + estado (sin detalle de error). `POST /admin/ops/indice/refrescar` requiere Admin y tiene límite de uso. | R1, R2, R3, R16, R17 |
| D3 | **Explorador**: `GET /admin/ops/libros?q=&pagina=` busca sobre el índice completo en el servidor y devuelve las pistas en orden de capítulo (`_clave_capitulo`). | R4, R5 |
| D4 | **Escucha previa**: `GET /admin/ops/audio-previo?blob=` verifica que el blob exista en el índice o en el contenedor. Recién entonces firma un SAS de **solo lectura** (`r`) por 10 minutos para ese blob. | R6, R14 |
| D5 | **Subida directa con SAS de solo creación**. `POST /admin/ops/libros/{id}/pistas/permiso` valida el nombre (sin `/`, `\` ni `..`, solo `.mp3`, largo máximo), el tamaño declarado (límite de `MAX_PISTA_BYTES`) y que el blob **no exista**; responde "ya existe" o un SAS con permiso **`c` (crear) sin `w`**, válido 15 minutos. Con permiso `c`, Azure no deja sobrescribir un blob existente aunque se reintente con el mismo nombre. El navegador sube con `Put Blob` (bloques para archivos grandes); un blob en bloques no existe hasta el commit, así que una subida cortada no deja archivo a medias. `POST /admin/ops/libros/{id}/pistas/confirmar` verifica que el blob exista y que el tamaño coincida, y registra la operación. | R7–R10, R14, R15 |
| D6 | **Corrección de `presign-upload`**: reutiliza la validación y el permiso de D5 (`c` sin `w`, 15 minutos). Mantiene su contrato actual para no romper `ContentManagement`. | R11 |
| D7 | **Registro de operaciones**: tabla `operaciones_admin` (quién, cuándo, operación, objeto, resultado), fuera del `create_all` como en el spec 003 (D5 de 003). Sin la tabla, el registro va al log del servidor y la operación sigue (P13). El DDL va en el documento de aprobación. | R15, R25, P12 |
| D8 | **Límite de uso**: contador en memoria por cuenta y operación (ventana deslizante), sin dependencias nuevas: refresco del índice 1 cada 60 s; permisos de subida 120 por hora. En varios procesos el límite es por proceso: se documenta como aceptable para el volumen actual. | R17 |
| D9 | **Pantallas del sitio**: `AdminPanel` suma las pestañas **Resumen**, **Explorador de audios**, **Carga guiada** y **Gobernanza** al patrón de pestañas que ya tiene. Los componentes se portan de `index.html`/`carga.js` a React sin cambiar el comportamiento accesible: dos canales de aviso con `announceText`, foco explícito en cada paso, `<dialog>` para reintentos y construcción sin `innerHTML`. El reproductor de escucha previa reutiliza el `AudioPlayer` del sitio en modo "previo". | R7, R12, R22 |
| D10 | **Atajos**: las acciones de la consola se agregan a la zona `admin` del catálogo del spec 003 (`atajos_catalogo.json`) y solo se cargan para cuentas Admin. | R23 |
| D11 | **Transición**: el panel no se toca salvo para arreglos. Mientras tanto, un test de paridad compara `GET /api/overview` del panel con `GET /admin/ops/resumen` de la API sobre el mismo stub de Blob. | R18, R26, V1 |
| D12 | **Retiro**: `aprobaciones/AAAA-MM-DD_retiro_panel.md` con una tabla función por función (panel → consola, verificación en producción, firma). Solo con la tabla completa se borra `admin-dashboard/` y sus tests migran: índice y carga a la API, accesibilidad al arnés del sitio. | R20, R21 |
| D13 | **Despliegue**: `aprobaciones/2026-09-29_consola_unica.md` lista las rutas nuevas, el DDL de `operaciones_admin`, las variables de entorno (sin valores) y la reversión (desplegar la imagen anterior; la tabla nueva no se usa en otro lado). | R19, R24 |

## Tech stack
Sin tecnología nueva: FastAPI + SQLAlchemy 1.4 + `azure-storage-blob` (ya en la API), React 19, Playwright y pytest.

## Data model / schemas

```
operaciones_admin
  id, usuario_id, operacion ('crear_libro' | 'permiso_subida' | 'confirmar_pista' | 'refrescar_indice'),
  objeto (texto 300: libro o blob), resultado ('ok' | 'rechazado' | 'error'), fecha (UTC)
```

## Contracts / interfaces
- `GET /admin/ops/resumen` → `{ cifras: {libros, pistas, gb, usuarios}, indice: {estado, ultimo_ok} }`.
- `GET /admin/ops/libros?q=&pagina=` → `{ total, libros: [{titulo, pistas: [{nombre, blob, mb}]}] }`.
- `GET /admin/ops/audio-previo?blob=` → `{ url }`, con 404 si no existe.
- `POST /admin/ops/libros/{id}/pistas/permiso` `{nombre, bytes}` → `{ estado: 'subir', url, blob }`, `{ estado: 'existe' }` o 422 con `regla`.
- `POST /admin/ops/libros/{id}/pistas/confirmar` `{blob, bytes}` → `{ ok }` o 409 si no coincide.
- Códigos: 401 sin sesión, 403 sin rol Admin, 422 validación, 429 límite, 503 almacenamiento no disponible (sin detalle).

## Dependencies
Ninguna nueva. El CORS de Blob tiene que permitir `PUT` desde el dominio del sitio: es un cambio de configuración del almacenamiento de producción y va en el documento de aprobación (P12).

## Risk mitigation & security gate (CWE mapping)
- **Path traversal (CWE-22):** validación del nombre en el servidor (D5); corrección de `presign-upload` (D6).
- **Input sanitization (CWE-20 / CWE-79):** tamaños y nombres validados en el servidor; en pantalla todo se muestra con React.
- **Authentication / authorization (CWE-285, CWE-862, CWE-863):** una dependencia de rol para todo el router (D1), con un test que recorre todas las rutas del router sin rol.
- **Secrets / sensitive data exposure (CWE-798, CWE-200, CWE-209):** solo SAS acotados a un blob, un permiso y minutos; nunca clave de cuenta ni cadena de conexión; errores genéricos (R16).
- **Resource exhaustion (CWE-770):** límites de D8 y tope de tamaño por pista.
- **Overwrite / integrity:** permiso `c` sin `w` y confirmación de tamaño (D5).
- **Performance:** índice en segundo plano, búsqueda paginada en el servidor.

## Constitution check
- **P1:** cumple. Sin frameworks nuevos.
- **P3, P5:** cumple. Tests de API por ruta, de paridad (D11), de permisos (D1) y arnés del sitio.
- **P8:** cumple. Ver CWE.
- **P10:** cumple. El índice en segundo plano conserva el último válido (código ya probado).
- **P12, P13:** cumple. Aprobaciones para el despliegue, el DDL y el CORS; la API degrada si faltan tablas.
- **P14, P17:** cumple. Las pantallas nuevas pasan el arnés del spec 002 y usan el catálogo del spec 003.

## Risks & open questions
- **Dependencia del despliegue:** sin la API nueva en producción, la consola no reemplaza al panel. La fecha la decide la BCC.
- **CORS de Blob:** sin habilitar `PUT` desde el dominio del sitio, la carga guiada no funciona en producción; en local se prueba contra un contenedor de desarrollo o un stub.
- **Límite en memoria:** con varios procesos, el límite es por proceso. Si el tráfico crece, se pasa a la base.
- **Orden con el spec 003:** la zona `admin` del catálogo necesita el spec 003 implementado; si no llega, las pestañas nuevas usan los atajos por defecto.
