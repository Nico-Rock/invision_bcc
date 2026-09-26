"""T1 — introspección de esquema [R1, R2].

El esquema de producción manda (P13): el panel pregunta qué existe en vez de asumirlo.
"""
import pytest

from invision import esquema


def test_tabla_existe_en_sqlite(db_info):
    assert esquema.tabla_existe(db_info, "audiolibros") is True
    assert esquema.tabla_existe(db_info, "sesiones_acceso") is False


def test_columnas_en_sqlite(db_info):
    cols = esquema.columnas(db_info, "audiolibros")
    assert {"nombre", "autor", "genero", "descripcion", "categoria_id"} <= cols
    assert "editorial" not in cols


def test_columnas_de_tabla_inexistente_es_vacio(db_info):
    assert esquema.columnas(db_info, "sesiones_acceso") == set()


def test_tabla_fuera_de_lista_blanca_se_rechaza(db_info):
    # Los nombres nunca salen de la entrada del usuario (CWE-89), pero igual se cierran.
    with pytest.raises(ValueError):
        esquema.tabla_existe(db_info, "audiolibros; DROP TABLE usuarios")


class _CursorAzureFalso:
    """Imita el cursor de pymssql: registra las consultas y devuelve filas fijas."""

    def __init__(self, filas):
        self.filas = filas
        self.consultas = []

    def execute(self, sql, params=None):
        self.consultas.append((sql, params))

    def fetchall(self):
        return self.filas

    def fetchone(self):
        return self.filas[0] if self.filas else None


class _ConnAzureFalsa:
    def __init__(self, filas):
        self.cur = _CursorAzureFalso(filas)

    def cursor(self, *a, **kw):
        return self.cur


def test_azure_consulta_information_schema_parametrizada():
    conn = _ConnAzureFalsa([("nombre",), ("editorial",)])
    db = {"type": "azure_sql", "conn": conn}

    assert esquema.columnas(db, "audiolibros") == {"nombre", "editorial"}

    sql, params = conn.cur.consultas[-1]
    assert "INFORMATION_SCHEMA.COLUMNS" in sql
    assert "%s" in sql and params == ("audiolibros",)
    assert "audiolibros" not in sql  # el nombre viaja como parámetro, no en el string


def test_azure_tabla_existe():
    db = {"type": "azure_sql", "conn": _ConnAzureFalsa([])}
    assert esquema.tabla_existe(db, "sesiones_acceso") is False
    db = {"type": "azure_sql", "conn": _ConnAzureFalsa([(1,)])}
    assert esquema.tabla_existe(db, "usuarios") is True
