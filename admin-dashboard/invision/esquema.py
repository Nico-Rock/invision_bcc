"""Introspección del esquema: qué tablas y columnas existen en la base conectada.

El modelo ORM y la base de producción divergen (docs/specs/13). En vez de asumir
el modelo, el panel pregunta: una tabla ausente se informa como "no disponible",
no tumba la vista.

`db_info` es el dict que devuelve `server.get_db_connection()`:
{"type": "sqlite" | "azure_sql", "conn": <conexión>}.
"""

# Los nombres de tabla nunca salen de la entrada del usuario, pero la lista blanca
# cierra la puerta igual: PRAGMA no acepta parámetros y el nombre va en el string.
TABLAS_CONOCIDAS = frozenset({
    "audiolibros",
    "usuarios",
    "roles",
    "user_roles",
    "progreso_audiolibros",
    "categorias",
    "clasificaciones",
    "audiolibro_clasificacion",
    "sesiones_acceso",
    "carpeta_sharepoint",
})


def _validar(tabla):
    if tabla not in TABLAS_CONOCIDAS:
        raise ValueError(f"Tabla no reconocida: {tabla!r}")


def tabla_existe(db_info, tabla):
    _validar(tabla)
    conn = db_info["conn"]
    if db_info["type"] == "sqlite":
        fila = conn.execute(
            "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?", (tabla,)
        ).fetchone()
        return fila is not None

    cursor = conn.cursor()
    cursor.execute(
        "SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = %s", (tabla,)
    )
    return cursor.fetchone() is not None


def columnas(db_info, tabla):
    """Conjunto de nombres de columna; vacío si la tabla no existe."""
    _validar(tabla)
    conn = db_info["conn"]
    if db_info["type"] == "sqlite":
        return {fila[1] for fila in conn.execute(f"PRAGMA table_info({tabla})")}

    cursor = conn.cursor()
    cursor.execute(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = %s",
        (tabla,),
    )
    return {fila[0] for fila in cursor.fetchall()}
