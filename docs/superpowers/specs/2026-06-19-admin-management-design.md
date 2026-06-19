# Diseño Técnico: Gestión de Usuarios y Contenidos (A11y Premium)

**Fecha:** 2026-06-19  
**Estado:** Propuesto  
**Autor:** Antigravity (AI Assistant)

---

## 1. Contexto y Objetivos

Este documento detalla el diseño de las nuevas funcionalidades para el rol de **Administrador** en la plataforma **Invision** (Biblioteca Central para Ciegos). 

Actualmente, el administrador solo puede importar audiolibros masivamente mediante una planilla Excel y visualizar logs de accesos. Este diseño expande el Panel de Administración para permitir:
1.  **Gestión de Usuarios Completa**: Listar usuarios, registrar nuevos usuarios, editar sus perfiles/roles y eliminarlos.
2.  **Gestión de Contenido Completa**: Listar el catálogo de audiolibros, crearlos manualmente (sin depender de Excel), editar sus metadatos (título, autor, descripción, género, categoría) y eliminarlos.
3.  **Mantener Estándar de Accesibilidad Premium**: Asegurar soporte completo para lectores de pantalla, navegación fluida mediante teclado (atajos, tabuladores), anuncios por voz dinámicos (`announceText`) y respuestas con pistas de audio (`playCue`).

---

## 2. Cambios en el Backend (FastAPI)

### 2.1 Esquemas Pydantic (`schemas.py`)
Añadiremos los siguientes esquemas para la validación y transferencia de datos:

```python
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List

# Esquema para que el administrador actualice datos críticos de cualquier usuario
class AdminUserUpdate(BaseModel):
    username: Optional[str] = Field(None, min_length=3, max_length=50)
    email: Optional[EmailStr] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone_number: Optional[str] = None

# Esquema para crear y actualizar audiolibros manualmente
class AudiobookCreateUpdate(BaseModel):
    nombre: str = Field(..., min_length=1)
    descripcion: Optional[str] = None
    genero: Optional[str] = None
    autor: Optional[str] = None
    categoria_id: Optional[int] = None
    clasificaciones: Optional[List[str]] = []
```

### 2.2 Rutas API (`routes.py`)

Añadiremos y adaptaremos los siguientes endpoints:

1.  **Listar todos los audiolibros (Admin-only)**:
    *   **Ruta**: `GET /admin/audiolibros`
    *   **Descripción**: Devuelve la lista completa de audiolibros en la base de datos junto con su categoría y clasificaciones vinculadas.

2.  **Crear audiolibro manual (Admin-only)**:
    *   **Ruta**: `POST /admin/audiolibros`
    *   **Cuerpo**: `AudiobookCreateUpdate`
    *   **Descripción**: Registra un audiolibro en la base de datos sqlite.

3.  **Actualizar audiolibro (Admin-only)**:
    *   **Ruta**: `PUT /admin/audiolibros/{id}`
    *   **Cuerpo**: `AudiobookCreateUpdate`
    *   **Descripción**: Actualiza metadatos básicos y categorías del audiolibro.

4.  **Eliminar audiolibro (Admin-only)**:
    *   **Ruta**: `DELETE /admin/audiolibros/{id}`
    *   **Descripción**: Elimina el registro del audiolibro de la base de datos (con cascada de progreso).

5.  **Listar Categorías (Admin/User)**:
    *   **Ruta**: `GET /admin/categorias`
    *   **Descripción**: Devuelve la lista de categorías existentes para utilizarlas en los formularios selectores.

6.  **Desvincular un Rol de un Usuario (Admin-only)**:
    *   **Ruta**: `DELETE /users/{user_id}/roles/{role_id}`
    *   **Descripción**: Remueve el rol del usuario en la tabla asociativa `user_roles`.

7.  **Editar Datos de Usuario por Admin (Admin-only)**:
    *   **Ruta**: `PUT /users/{user_id}/admin`
    *   **Cuerpo**: `AdminUserUpdate`
    *   **Descripción**: Permite cambiar datos sensibles como el `email` y `username` de cualquier usuario (el endpoint original `/user/{user_id}/` solo permitía perfil básico).

---

## 3. Arquitectura Frontend (Vite + React)

Refactorizaremos el componente `AdminPanel.jsx` y dividiremos las responsabilidades en subcomponentes ubicados bajo:
`frontend/src/pages/Admin/components/`

```
Admin/
├── AdminPanel.jsx             # Vista controladora principal (manejo de pestañas)
└── components/
    ├── ExcelImporter.jsx      # Panel de carga masiva de SharePoint (actual)
    ├── AuditLogs.jsx          # Panel de registros de inicio/cierre (actual)
    ├── UserManagement.jsx     # Panel de ABM de Usuarios e instalación de Roles
    └── ContentManagement.jsx  # Panel de ABM de Audiolibros y Categorías
```

### 3.1 Pestañas Accesibles (W3C ARIA Tabs Pattern)
Se implementará navegación de pestañas con controles de teclado completos:
*   Las pestañas usarán `role="tab"`, `aria-selected` y `aria-controls`.
*   El contenedor de las pestañas usará `role="tablist"` y `aria-label`.
*   Navegación horizontal con teclas **Flecha Izquierda** y **Flecha Derecha**.
*   Anuncio por voz dinámico a través de `announceText` al alternar pestañas.

### 3.2 Modales y Control de Foco
Las ventanas de creación o edición de usuarios y libros se implementarán como modales accesibles:
*   `role="dialog"` y `aria-modal="true"`.
*   Captura de foco: el foco del teclado se mantendrá dentro del modal.
*   Cierre nativo al presionar la tecla `Escape`.
*   Retorno del foco al botón que originó la acción una vez que se cierre el modal.

---

## 4. Plan de Verificación

### Pruebas Automatizadas
*   Pruebas en FastAPI (`test_routes.py`) simulando peticiones CRUD con usuarios con y sin rol de administrador para verificar la seguridad de los endpoints.

### Pruebas Manuales y de Accesibilidad
*   Validar la navegación completa usando solo el teclado (`Tab`, `Shift+Tab`, flechas, `Escape`).
*   Verificar que la voz sintetizada del navegador (`announceText`) anuncie correctamente los cambios de estado en las pestañas y los formularios de edición.
*   Probar la correcta asignación y revocación de roles, y validar que los cambios se reflejen al momento de iniciar sesión.
