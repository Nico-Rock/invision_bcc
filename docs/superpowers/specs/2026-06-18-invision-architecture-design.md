# Documento de Diseño: Biblioteca Digital Accesible Invision (BCC)

Este documento detalla la arquitectura, el modelo de datos y el plan de integración para actualizar la plataforma Invision. Transicionaremos la interfaz actual a una Single Page Application (SPA) basada en React + Vite, optimizada para accesibilidad auditiva/visual (WCAG 2.1 AA/AAA), y añadiremos un panel de administración para gestionar contenido de forma masiva directamente desde SharePoint.

---

## 1. Arquitectura General y Flujo de Datos

El sistema adopta una arquitectura desacoplada:

```
[ Cliente React (SPA) ]  <--- (HTTPS / Auth JWT) ---> [ API FastAPI ]
        |                                                   |
        | (Streaming Audio HTTP 206)                        | (Ingesta Graph API)
        v                                                   v
[ Azure Blob Storage ] <------------------------------ [ SharePoint (M365) ]
```

1.  **React + Vite:** Frontend modular e interactivo. Incorpora herramientas de accesibilidad (alto contraste, controles de tamaño de texto, señales auditivas/earcons) y atajos de teclado globales.
2.  **FastAPI Backend:** Expone los endpoints REST, autentica mediante JWT, administra los modelos de base de datos con SQLAlchemy (sobre SQL Server), registra auditorías de acceso e implementa la cola de ingesta asíncrona conectada a SharePoint.
3.  **Azure Blob Storage:** Hospeda y sirve los archivos MP3 con soporte de peticiones parciales (HTTP 206) para un streaming ágil y posicionamiento dinámico de tiempo.
4.  **SharePoint Online:** Repositorio de origen para los audiolibros cargados por el administrador. El backend de la app los lee mediante Microsoft Graph API.

---

## 2. Modelo de Base de Datos (SQL Server via SQLAlchemy)

Actualizaremos `models.py` agregando tablas y relaciones dinámicas:

```
                  +-------------------+
                  |      Usuario      |
                  +-------------------+
                            | 1
                            |
                            | *
                  +-------------------+
                  |   SesionAcceso    |
                  +-------------------+
                  | id: Int (PK)      |
                  | usuario_id: (FK)  |
                  | tipo_evento: Str  |
                  | timestamp: DateTime|
                  +-------------------+

      +-------------------+          +-------------------+
      |     Categoria     |          |   Clasificacion   |
      +-------------------+          +-------------------+
      | id: Int (PK)      |          | id: Int (PK)      |
      | nombre: Str       |          | nombre: Str       |
      | descripcion: Str  |          | descripcion: Str  |
      +-------------------+          +-------------------+
               | 1                             | *
               |                               |
               | *                             | * (Tabla de Asociación)
      +-------------------+          +---------------------------+
      |    Audiolibro     | -------- |  audiolibro_clasificacion |
      +-------------------+          +---------------------------+
      | id: Int (PK)      |          | audiolibro_id (FK)        |
      | nombre: Str       |          | clasificacion_id (FK)     |
      | descripcion: Str  |          +---------------------------+
      | autor: Str        |
      | categoria_id: (FK)|
      +-------------------+
```

### Definición de Modelos (SQLAlchemy)

*   **`Categoria`:** Estructura jerárquica principal (ej: Literatura, Historia, Actas).
*   **`Clasificacion`:** Etiquetas transversales del patrimonio cultural (ej: Siglo XIX, Colección Local, Discursos).
*   **`SesionAcceso`:** Registros de login (`"LOGIN"`) y logout (`"LOGOUT"`) vinculados al usuario, sirviendo de historial de auditoría de accesos.
*   **`Audiolibro`:** Modificado para vincularse de manera obligatoria a una `Categoria` y a múltiples `Clasificaciones`.

---

## 3. Endpoints y Modificaciones API Backend

### Rutas de Gestión de Contenido (Solo Administradores)
*   `POST /categorias/` - Crear categoría.
*   `PUT /categorias/{id}/` - Editar categoría.
*   `DELETE /categorias/{id}/` - Eliminar categoría.
*   `POST /clasificaciones/` - Crear clasificación.
*   `PUT /clasificaciones/{id}/` - Editar clasificación.
*   `DELETE /clasificaciones/{id}/` - Eliminar clasificación.

### Rutas de Ingesta desde SharePoint
*   `POST /admin/importar-lote`:
    *   **Entrada:** Formulario Multipart conteniendo el archivo Excel (`.xlsx`) y opcionalmente credenciales temporales.
    *   **Proceso:**
        1.  El backend lee el archivo Excel en memoria.
        2.  Registra los audiolibros nuevos en la base de datos (con su categoría y clasificaciones).
        3.  Encola una `BackgroundTask` para procesar la descarga de audio.
    *   **Salida:** Retorna un ID de tarea (`task_id`) y el estado inicial `"PRACTICANDO_O_EN_COLA"`.
*   `GET /admin/importar-lote/status/{task_id}`:
    *   **Salida:** Retorna el progreso actual de la ingesta (ej. `{"status": "procesando", "total": 200, "completados": 45, "errores": []}`).

### Auditoría y Seguridad
*   `GET /admin/auditoria/sesiones/` - Devuelve el listado ordenado de accesos (`SesionAcceso`) para control del administrador.
*   `POST /auth/logout` - Invalida la sesión actual del usuario y registra el evento `"LOGOUT"` en la base de datos.

---

## 4. Servicio de Ingesta de SharePoint (FastAPI)

Para conectar el backend con SharePoint, utilizaremos el protocolo OAuth2 de Microsoft Azure AD y la librería `msal`:

1.  **Registro de Aplicación en Azure AD:** Se requiere crear un registro en el tenant de la institución con los siguientes permisos de Microsoft Graph API:
    *   `Files.Read.All` (Lectura de archivos en SharePoint).
    *   `Sites.Read.All` (Lectura de sitios de SharePoint corporativos).
2.  **Descarga y Subida en Streaming (Piping):**
    El script asíncrono no descargará los archivos MP3 completos al almacenamiento local de la API para evitar llenar el disco. En su lugar, obtendrá el flujo binario desde Graph API y lo transmitirá directamente al cliente Azure Blob:

    ```python
    import httpx
    from azure.storage.blob import BlobServiceClient

    async def transfer_sharepoint_to_azure(sp_file_url: str, az_blob_path: str, access_token: str):
        headers = {"Authorization": f"Bearer {access_token}"}
        
        # Conexión HTTP persistente
        async with httpx.AsyncClient() as client:
            async with client.stream("GET", sp_file_url, headers=headers) as response:
                if response.status_code != 200:
                    raise Exception("Error al descargar de SharePoint")
                
                # Inicializar Azure Blob Client
                blob_client = container_client.get_blob_client(az_blob_path)
                
                # Subir en bloques leyendo el flujo HTTP
                # Se utiliza una carga por bloques (Block Blobs)
                def block_generator():
                    for chunk in response.iter_bytes(chunk_size=1024*1024): # Bloques de 1MB
                        yield chunk
                
                blob_client.upload_blob(block_generator(), overwrite=True, blob_type="BlockBlob")
    ```

---

## 5. Diseño del Frontend en React

El frontend se construirá de forma modular en **React (Vite)** para cargarse instantáneamente y evitar retrasos en lectores de pantalla.

### Modos de Accesibilidad Visual (CSS Reactivo)
*   **Tema Estándar (Blanco y Naranja):** Diseñado con un contraste mínimo de 4.5:1 para elementos interactivos.
*   **Tema de Alto Contraste (Negro y Amarillo):** Activado de forma global, aplica colores `#000000` de fondo y `#FFFF00` para textos y bordes dinámicos.
*   **Zoom de Texto Reactivo:** Los tamaños de fuente utilizarán unidades `rem` basadas en un tamaño raíz (`--font-scale`) ajustable dinámicamente con los botones A+ / A- (de 12px a 28px).

### Atajos de Teclado y Sonidos (Earcons)
*   Usaremos la API de Web Audio (`AudioContext`) para emitir señales auditivas cuando el foco se mueva entre elementos importantes (clics suaves de navegación, campana de éxito en búsquedas y tono grave para errores).
*   **Atajos globales:**
    *   `S` o `Shift + S`: Enfoca y limpia la caja de búsqueda.
    *   `Espacio`: Reproduce/pausa el audio actual (solo cuando no se escribe en formularios).
    *   `Flechas`: Adelanta/retrocede 15s el reproductor.
    *   `1` a `4`: Navegación directa entre secciones del menú.
    *   `Esc`: Cierra modales y el reproductor de audio flotante.

### Panel de Administración (Ingesta Masiva)
El panel administrativo constará de:
1.  **Gestor de Clasificaciones y Categorías:** Formularios rápidos para agregar tipos de datos culturales.
2.  **Carga de Lotes de SharePoint:**
    *   El administrador selecciona un archivo `.xlsx`.
    *   Ingresa el enlace base del SharePoint institucional.
    *   Presiona "Iniciar Ingesta".
    *   La app React se conecta mediante WebSockets o Polling al endpoint de estado del backend para mostrar una barra de progreso interactiva del procesamiento de los libros.

---

## 6. Escalabilidad (1.000 a 2.500 Libros)

Para garantizar un rendimiento óptimo al alcanzar miles de registros:
*   **Paginación del Catálogo:** Implementada del lado del servidor. Las búsquedas y filtros por categorías retornarán conjuntos ordenados de 20 libros.
*   **A11y en Listas Grandes:** React utilizará un contenedor `aria-live="assertive"` para anunciar el progreso de carga y cambios en el DOM a los usuarios con ceguera, impidiendo que el lector se abrume leyendo listas masivas.
*   **Indices de Búsqueda:** Creación de índices específicos en SQL Server para optimizar búsquedas basadas en cadenas de texto e IDs de relaciones categorizadas.

---

## 7. Plan de Verificación

### Pruebas Automatizadas (Backend)
1.  Pruebas unitarias de los nuevos endpoints (`test_routes.py`) utilizando un cliente de pruebas de FastAPI con una base de datos SQLite en memoria simulando SQL Server.
2.  Prueba de generación de la SAS de Azure para confirmar permisos y expiración de tokens.
3.  Simulacro de conexión con SharePoint (Mocking de Microsoft Graph API).

### Verificación de Accesibilidad (Frontend)
1.  **Auditoría de Teclado:** Asegurar que todos los elementos interactivos se alcancen con `Tab` y se activen con `Enter` / `Espacio`.
2.  **Prueba de Lector de Pantalla:** Ejecutar la aplicación con lectores de pantalla reales (VoiceOver en macOS / NVDA en Windows) para validar la correcta pronunciación de las etiquetas y notificaciones `aria-live`.
3.  **Prueba de Contraste:** Validar mediante herramientas de desarrollador que el ratio de contraste sea superior a 4.5:1 (Estándar WCAG AA) en modo estándar y alto contraste.