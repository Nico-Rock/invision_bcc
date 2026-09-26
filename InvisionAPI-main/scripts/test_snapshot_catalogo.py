"""T17 — snapshot de solo lectura del catálogo [R21, R22, R36]."""
import sqlite3

import pytest

import snapshot_catalogo as snap


class _CursorProd:
    def __init__(self, filas):
        self.filas = filas
        self.consultas = []

    def execute(self, sql, params=None):
        self.consultas.append(sql)

    def fetchall(self):
        return self.filas


class _ConnProd:
    def __init__(self, filas):
        self.cur = _CursorProd(filas)

    def cursor(self, *a, **kw):
        return self.cur


FILAS = [
    (1, "RAYUELA", "Novela experimental", "CLÁSICOS DE LA LITERATURA", "CORTÁZAR, JULIO"),
    (2, "AFRODITA", None, None, "ALLENDE, ISABEL"),
]


@pytest.fixture
def destino(tmp_path):
    ruta = tmp_path / "local.db"
    conn = sqlite3.connect(ruta)
    conn.executescript(
        """
        CREATE TABLE audiolibros (id INTEGER PRIMARY KEY, nombre VARCHAR NOT NULL,
            descripcion VARCHAR, genero VARCHAR, autor VARCHAR, categoria_id INTEGER);
        CREATE TABLE usuarios (id INTEGER PRIMARY KEY, email VARCHAR);
        INSERT INTO usuarios (email) VALUES ('admin@invision.com');
        INSERT INTO audiolibros (nombre) VALUES ('LIBRO VIEJO DE PRUEBA');
        """
    )
    conn.commit()
    conn.close()
    return ruta


def test_copia_el_catalogo_y_reemplaza_el_local(destino):
    prod = _ConnProd(FILAS)
    total = snap.copiar_catalogo(prod, destino)

    assert total == 2
    conn = sqlite3.connect(destino)
    filas = conn.execute("SELECT id, nombre, genero, autor FROM audiolibros ORDER BY id").fetchall()
    assert filas == [
        (1, "RAYUELA", "CLÁSICOS DE LA LITERATURA", "CORTÁZAR, JULIO"),
        (2, "AFRODITA", None, "ALLENDE, ISABEL"),
    ]


def test_a_produccion_solo_se_le_hacen_select(destino):
    prod = _ConnProd(FILAS)
    snap.copiar_catalogo(prod, destino)

    assert prod.cur.consultas, "no consultó nada"
    for sql in prod.cur.consultas:
        assert sql.lstrip().upper().startswith("SELECT"), sql


def test_la_guarda_rechaza_escrituras_a_produccion():
    guardada = snap.SoloLectura(_ConnProd([]))
    with pytest.raises(PermissionError):
        guardada.cursor().execute("DELETE FROM audiolibros")
    with pytest.raises(PermissionError):
        guardada.cursor().execute("SELECT 1; DROP TABLE usuarios")


def test_no_copia_usuarios_ni_progreso(destino):
    snap.copiar_catalogo(_ConnProd(FILAS), destino)

    conn = sqlite3.connect(destino)
    emails = [r[0] for r in conn.execute("SELECT email FROM usuarios")]
    assert emails == ["admin@invision.com"]  # solo las cuentas demo locales


def test_destino_debe_ser_sqlite_local(tmp_path):
    with pytest.raises(ValueError):
        snap.validar_destino("mssql+pyodbc://prod")
    with pytest.raises(ValueError):
        snap.validar_destino(str(tmp_path / "no_existe.db"))
