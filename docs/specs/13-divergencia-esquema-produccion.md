# 13 — Divergencia entre el modelo y el esquema de producción

> Estado: Documentado | **Bloqueante — pendiente de decisión del governance board**

**Fecha del hallazgo:** 2026-09-02
**Cómo se encontró:** implementando la carga de contenido del [módulo 12](12-admin-dashboard.md), al fallar `GET /api/categorias` contra la base real.

---

## 1. El hallazgo

El modelo ORM (`InvisionAPI-main/audiobooks/models.py`) y el esquema real de la base de producción (Azure SQL) **no coinciden**. No es una diferencia menor: afecta qué campos se pueden guardar de un audiolibro.

### Tabla `audiolibros`

| | SQLite local (derivado de `models.py`) | **Azure SQL producción** |
|---|---|---|
| `id` | ✅ | ✅ |
| `nombre` | ✅ (sin límite) | ✅ `nvarchar(255)` |
| `autor` | ✅ | ✅ `nvarchar(255)` |
| `genero` | ✅ | ✅ `nvarchar(100)` |
| `descripcion` | ✅ | ✅ `nvarchar(max)` |
| `editorial` | ❌ **no existe** | ✅ `nvarchar(255)` |
| `categoria_id` | ✅ | ❌ **no existe** |
| **Filas** | **0** | **538** |

### Tablas presentes en cada base

| Tabla | SQLite local | **Azure SQL producción** |
|---|---|---|
| `audiolibros`, `usuarios`, `roles`, `user_roles`, `progreso_audiolibros` | ✅ | ✅ |
| `categorias` | ✅ | ❌ **no existe** |
| `clasificaciones` | ✅ | ❌ **no existe** |
| `audiolibro_clasificacion` | ✅ | ❌ **no existe** |
| `sesiones_acceso` | ✅ | ❌ **no existe** |
| `carpeta_sharepoint` | ❌ | ✅ (no está en el modelo) |

**Lectura:** el SQLite local es un andamio de desarrollo vacío (0 filas) generado desde `models.py` y nunca usado con datos. La base de producción, con 538 audiolibros, es la que refleja la realidad — y evolucionó por otro camino.

---

## 2. Qué rompe hoy

| Afectado | Consecuencia | Estado |
|---|---|---|
| `POST /api/admin/crear-libro` (módulo 12) | El INSERT incluye `categoria_id` → *Invalid column name* en producción. **Ninguna creación funcionaría.** | Bloqueado, sin desplegar |
| `GET /api/categorias` (módulo 12) | La tabla no existe → 500. El desplegable de Categoría del formulario nunca puede poblarse. | Bloqueado, sin desplegar |
| `GET /api/access-logs` (módulo 12) | `sesiones_acceso` no existe → 500. La sección "Registros de Acceso" del panel no funciona contra producción. | **Preexistente**, ya roto |
| `GET /api/overview` (módulo 12) | Cuenta sobre `sesiones_acceso` → error. | **Preexistente**, ya roto |
| Spec [09-admin-panel.md](09-admin-panel.md) §2.4 | Documenta auditoría de sesiones que no puede funcionar contra producción. | Documentación desactualizada |
| Spec [03-catalogo-audiolibros.md](03-catalogo-audiolibros.md) | Describe categorías y clasificaciones inexistentes en producción. | Documentación desactualizada |

**Dato relevante para la carga masiva:** el CSV fuente (`Catalogo digital Audioteca 2025(disponibles).csv`) trae las columnas `AUTOR; NOMBRE; EDITORIAL; GÉNERO; Descripción`. Producción tiene **exactamente** esos campos — incluida `editorial`, y **sin** categorías ni clasificaciones. El esquema de producción está alineado con los datos reales; el modelo ORM no.

---

## 3. Opciones (para decisión del governance board)

### Opción A — Alinear el código al esquema de producción
Adaptar la carga de contenido a las columnas que existen: `nombre, autor, editorial, genero, descripcion`. Se elimina el desplegable de Categoría y el endpoint `/api/categorias`.

- **A favor:** no toca producción; es lo único que funciona contra las 538 filas reales; preserva `editorial`, que hoy se estaría descartando; desbloquea la carga de los ~700 títulos pendientes.
- **En contra:** el catálogo queda sin categorías ni clasificaciones (funcionalidad que las specs 03 y 04 describen); el modelo ORM sigue desalineado y volverá a confundir a quien lo lea.

### Opción B — Soportar ambos esquemas
Detectar en runtime qué columnas existen y adaptar el INSERT.

- **A favor:** robusto ante cambios futuros de esquema.
- **En contra:** complejidad permanente para cubrir una base local que hoy tiene 0 filas; no resuelve la divergencia, la institucionaliza.

### Opción C — Alinear producción al modelo
Crear en producción las tablas faltantes (`categorias`, `clasificaciones`, `audiolibro_clasificacion`, `sesiones_acceso`) y la columna `categoria_id`, más una migración para poblarlas.

- **A favor:** recupera categorías, clasificaciones y auditoría de sesiones — funcionalidad que las specs ya describen y que la app espera; deja una sola fuente de verdad.
- **En contra:** **interviene el esquema de producción**, lo que activa el mandato de gobernanza del panel ("ningún cambio a bases de datos o código en producción sin validación formal previa del equipo BCC"); requiere plan de migración, backup y ventana; riesgo sobre 538 filas en uso.

---

## 4. Recomendación técnica

**Opción A para desbloquear la carga ahora**, con la Opción C evaluada aparte como proyecto propio si el board decide que categorías, clasificaciones y auditoría son funcionalidad requerida.

Razón: A es reversible y no toca producción; C es la única que recupera funcionalidad perdida, pero es una intervención sobre datos vivos que merece su propio plan, no un paso dentro de otra tarea.

**Independientemente de la opción elegida**, hay que corregir `models.py` o documentar explícitamente que no refleja producción — hoy es una trampa para cualquiera que lo lea como fuente de verdad.

---

## 5. Nota sobre validación de longitud

Producción define `nombre nvarchar(255)`, `autor nvarchar(255)`, `genero nvarchar(100)`. El código de carga **no valida longitudes**, así que un título largo produciría un error de base con un mensaje inútil leído por voz. Debe cerrarse en cualquiera de las opciones.
