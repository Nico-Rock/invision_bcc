# Aprobación: login de solo lectura en Azure SQL para la copia del catálogo

**Estado:** propuesta, pendiente de aprobación de la BCC (constitución P12)
**Origen:** spec 001, requisito 43 y tarea T32; auditoría de seguridad del 2026-09-26
**Quién ejecuta, una vez aprobada:** la persona con acceso de administración a la base `Invision` en Azure SQL

## Qué se pide

Crear un login y un usuario de base con permiso de **solo lectura** sobre la tabla `audiolibros`, para que el script `InvisionAPI-main/scripts/snapshot_catalogo.py` copie el catálogo a la base local de demo sin usar la credencial de escritura de la API.

## Por qué

Hoy la copia usa las mismas credenciales con que la API escribe en producción. El script tiene una guarda que solo deja pasar la consulta del catálogo, pero la protección que vale es la de la base: aunque el script tenga un error o alguien lo modifique, un login de solo lectura no puede escribir.

## Cambio propuesto (no ejecutado)

```sql
-- En master
CREATE LOGIN invision_lectura WITH PASSWORD = '<generada y guardada en el gestor de secretos>';

-- En la base Invision
CREATE USER invision_lectura FOR LOGIN invision_lectura;
GRANT SELECT ON dbo.audiolibros TO invision_lectura;
```

Sin `db_datareader`: el permiso se limita a la única tabla que se copia. `usuarios` y `progreso_audiolibros` quedan fuera.

## Cómo se usa después

Las variables `SQL_RO_USERNAME` y `SQL_RO_PASSWORD` van **solo** en el entorno de quien corre la copia. Nunca se versionan, y nunca van en el `.env` compartido junto a la credencial de escritura. Si faltan, o si son iguales a `SQL_USERNAME`, el script se niega a correr.

## Reversión

```sql
DROP USER invision_lectura;   -- en la base Invision
DROP LOGIN invision_lectura;  -- en master
```

## Registro

| Rol | Nombre | Decisión | Fecha |
|---|---|---|---|
| BCC | | | |
| Dueño técnico | Nico | Propuesto | 2026-09-26 |
