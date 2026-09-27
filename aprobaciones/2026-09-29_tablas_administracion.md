# Aprobación: tablas de la administración sin ver en la base de producción

**Estado:** propuesta, pendiente de aprobación de la BCC (constitución P12)
**Origen:** spec 005, grupos B y C (requisitos 18 a 27), aprobados por Nico el 2026-09-26
**Complementa:** [narrador e iniciativa "En Memoria"](2026-09-29_narrador_en_memoria.md)
**Quién ejecuta, una vez aprobada:** la persona con acceso de administración a `nombre_base` en Azure SQL

## Qué se pide

Crear siete tablas nuevas. **No se modifica ninguna tabla existente.** Cada una habilita una función de la consola:

| Tabla | Para qué |
|---|---|
| `audiolibro_publicacion` | Borrador o publicado. Sin fila = publicado: las fichas actuales siguen visibles |
| `pista_verificacion` | Duración y problemas de cada pista, medidos al subirla |
| `tareas_admin` | Estado real de las tareas largas (verificar audio, importar fichas) |
| `audiolibro_papelera` | Fichas eliminadas que se pueden restaurar durante 30 días |
| `audiolibro_historial` | Cambios de cada ficha, para revisar y deshacer |
| `perfil_accesibilidad` | Perfil de cada socio, que define su configuración inicial |
| `registro_operaciones` | Quién hizo qué y cuándo; alimenta la auditoría y el informe del día |

## Garantías

- La API funciona con o sin cada tabla. Si falta una, la función que la usa responde "todavía no está habilitado en esta base" y el resto sigue igual.
- Ninguna tabla se crea sola al desplegar: quedan fuera del mecanismo automático de la API a propósito.
- **Efecto visible para los socios al crear `audiolibro_publicacion` y `audiolibro_papelera`:** las fichas nuevas quedan en borrador hasta publicarlas, y las eliminadas dejan de verse. Las 538 fichas existentes no cambian.

## Cambio propuesto (no ejecutado)

```sql
CREATE TABLE dbo.audiolibro_publicacion (
    audiolibro_id  INT            NOT NULL PRIMARY KEY
        REFERENCES dbo.audiolibros (id) ON DELETE CASCADE,
    estado         NVARCHAR(20)   NOT NULL DEFAULT 'borrador',
    actualizado_en DATETIMEOFFSET NULL DEFAULT SYSDATETIMEOFFSET()
);

CREATE TABLE dbo.pista_verificacion (
    blob              NVARCHAR(500)  NOT NULL PRIMARY KEY,
    audiolibro_id     INT            NOT NULL,
    bytes             INT            NOT NULL DEFAULT 0,
    duracion_segundos FLOAT          NOT NULL DEFAULT 0,
    problemas         NVARCHAR(200)  NOT NULL DEFAULT '',
    verificado_en     DATETIMEOFFSET NULL DEFAULT SYSDATETIMEOFFSET()
);
CREATE INDEX ix_pista_verificacion_libro ON dbo.pista_verificacion (audiolibro_id);

CREATE TABLE dbo.tareas_admin (
    id             INT IDENTITY(1,1) PRIMARY KEY,
    tipo           NVARCHAR(40)   NOT NULL,
    estado         NVARCHAR(20)   NOT NULL DEFAULT 'encolada',
    titulo         NVARCHAR(300)  NOT NULL DEFAULT '',
    total          INT            NOT NULL DEFAULT 0,
    hechos         INT            NOT NULL DEFAULT 0,
    fallidos       INT            NOT NULL DEFAULT 0,
    detalle        NVARCHAR(MAX)  NOT NULL DEFAULT '[]',
    usuario_id     INT            NULL,
    creada_en      DATETIMEOFFSET NULL DEFAULT SYSDATETIMEOFFSET(),
    actualizada_en DATETIMEOFFSET NULL DEFAULT SYSDATETIMEOFFSET()
);

CREATE TABLE dbo.audiolibro_papelera (
    audiolibro_id INT            NOT NULL PRIMARY KEY
        REFERENCES dbo.audiolibros (id) ON DELETE CASCADE,
    nombre        NVARCHAR(255)  NOT NULL,
    eliminado_por INT            NULL,
    eliminado_en  DATETIMEOFFSET NULL DEFAULT SYSDATETIMEOFFSET()
);

CREATE TABLE dbo.audiolibro_historial (
    id            INT IDENTITY(1,1) PRIMARY KEY,
    audiolibro_id INT            NOT NULL,
    campo         NVARCHAR(40)   NOT NULL,
    antes         NVARCHAR(MAX)  NULL,
    despues       NVARCHAR(MAX)  NULL,
    motivo        NVARCHAR(40)   NOT NULL DEFAULT 'edicion',
    usuario_id    INT            NULL,
    fecha         DATETIMEOFFSET NULL DEFAULT SYSDATETIMEOFFSET()
);
CREATE INDEX ix_historial_libro ON dbo.audiolibro_historial (audiolibro_id);

CREATE TABLE dbo.perfil_accesibilidad (
    usuario_id     INT            NOT NULL PRIMARY KEY
        REFERENCES dbo.usuarios (id) ON DELETE CASCADE,
    perfil         NVARCHAR(30)   NOT NULL,
    actualizado_en DATETIMEOFFSET NULL DEFAULT SYSDATETIMEOFFSET()
);

CREATE TABLE dbo.registro_operaciones (
    id         INT IDENTITY(1,1) PRIMARY KEY,
    usuario_id INT            NULL,
    operacion  NVARCHAR(40)   NOT NULL,
    objeto     NVARCHAR(300)  NOT NULL DEFAULT '',
    detalle    NVARCHAR(500)  NOT NULL DEFAULT '',
    fecha      DATETIMEOFFSET NULL DEFAULT SYSDATETIMEOFFSET()
);
CREATE INDEX ix_registro_fecha ON dbo.registro_operaciones (fecha);
```

## Reversión

```sql
DROP TABLE dbo.registro_operaciones;
DROP TABLE dbo.perfil_accesibilidad;
DROP TABLE dbo.audiolibro_historial;
DROP TABLE dbo.audiolibro_papelera;
DROP TABLE dbo.tareas_admin;
DROP TABLE dbo.pista_verificacion;
DROP TABLE dbo.audiolibro_publicacion;
```

La API sigue funcionando sin ellas. Atención: si se borra `audiolibro_papelera` con fichas adentro, esas fichas **vuelven a verse**.

## Verificación después de aplicar

1. En la consola, **Inicio** muestra borradores, papelera y el informe del día sin avisos de "no habilitado".
2. Registrar un libro de prueba: queda en borrador y no aparece en el catálogo de socios.
3. Subir una pista: la ficha dice su duración.
4. Eliminar el libro de prueba: aparece en la papelera y se puede restaurar.

## Registro

| Rol | Nombre | Decisión | Fecha |
|---|---|---|---|
| BCC | | | |
| Dueño técnico | Nico | Propuesto | 2026-09-26 |
