# Aprobación: narrador e iniciativa "En Memoria" en la base de producción

**Estado:** propuesta, pendiente de aprobación de la BCC (constitución P12)
**Origen:** spec 005, requisitos 6 y 7 (hallazgo C4 de la auditoría del 2026-09-26); decisión D6 del PRD de la biblioteca
**Quién ejecuta, una vez aprobada:** la persona con acceso de administración a la base `nombre_base` en Azure SQL

## Qué se pide

Crear una tabla nueva, `audiolibro_narracion`, para guardar el narrador de cada audiolibro y si forma parte de la iniciativa "En Memoria". **No se modifica ninguna tabla existente.**

## Por qué una tabla aparte y no una columna nueva

Si se agregara una columna a `audiolibros`, la API nueva la pediría en cada consulta y fallaría contra una base que todavía no la tiene. Con una tabla aparte:
- la API funciona con o sin la tabla;
- sin ella, la ficha del libro se guarda igual y el campo "Narrador" dice que no está habilitado.

La tabla tampoco se crea sola al desplegar: queda fuera del mecanismo automático de la API a propósito.

## Cambio propuesto (no ejecutado)

```sql
CREATE TABLE dbo.audiolibro_narracion (
    audiolibro_id  INT            NOT NULL PRIMARY KEY,
    narrador       NVARCHAR(200)  NULL,
    en_memoria     BIT            NOT NULL CONSTRAINT df_narracion_en_memoria DEFAULT 0,
    actualizado_en DATETIMEOFFSET NULL CONSTRAINT df_narracion_actualizado DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT fk_narracion_audiolibro FOREIGN KEY (audiolibro_id)
        REFERENCES dbo.audiolibros (id) ON DELETE CASCADE
);
```

## Reversión

```sql
DROP TABLE dbo.audiolibro_narracion;
```

La API sigue funcionando sin la tabla: el campo vuelve a mostrarse como no habilitado.

## Verificación después de aplicar

1. En la consola, "Libros" → "Gestionar" un libro: el campo "Narrador" está habilitado.
2. Guardar un narrador y marcar "En Memoria"; volver a abrir la ficha y escucharlos.
3. Eliminar un libro de prueba: su fila en `audiolibro_narracion` desaparece.

## Registro

| Rol | Nombre | Decisión | Fecha |
|---|---|---|---|
| BCC | | | |
| Dueño técnico | Nico | Propuesto | 2026-09-26 |
