"""T2 — el Resumen y los Registros de Acceso no fallan si la base no tiene sesiones_acceso [R1, R2].

Producción no tiene esa tabla (docs/specs/13). Antes, las dos vistas devolvían el
error de SQL crudo.
"""
import sqlite3

import pytest

import server


@pytest.fixture
def db_como_produccion(tmp_path):
    """SQLite con la forma de producción: usuarios sí, sesiones_acceso no."""
    conn = sqlite3.connect(tmp_path / "prod_like.db")
    conn.row_factory = sqlite3.Row
    conn.executescript(
        """
        CREATE TABLE usuarios (id INTEGER PRIMARY KEY, email TEXT, username TEXT);
        INSERT INTO usuarios (email, username) VALUES ('ana@bibliociegos.cl', 'ana');
        INSERT INTO usuarios (email, username) VALUES ('ops@bibliociegos.cl', 'ops');
        """
    )
    yield {"type": "sqlite", "conn": conn}
    conn.close()


@pytest.fixture
def db_con_sesiones(db_como_produccion):
    conn = db_como_produccion["conn"]
    conn.executescript(
        """
        CREATE TABLE sesiones_acceso (
            id INTEGER PRIMARY KEY, usuario_id INTEGER, tipo_evento TEXT, timestamp TEXT
        );
        INSERT INTO sesiones_acceso (usuario_id, tipo_evento, timestamp)
            VALUES (1, 'LOGIN', '2026-09-01 10:00:00');
        """
    )
    return db_como_produccion


def test_resumen_sin_tabla_de_sesiones_no_falla(db_como_produccion):
    datos = server.resumen_base(db_como_produccion)

    assert datos["total_users"] == 2
    assert datos["total_access_logs"] is None
    assert "total_access_logs" in datos["no_disponible"]
    assert "sesiones" in datos["no_disponible"]["total_access_logs"].lower()


def test_resumen_con_tabla_de_sesiones_cuenta(db_con_sesiones):
    datos = server.resumen_base(db_con_sesiones)
    assert datos["total_access_logs"] == 1
    assert datos["no_disponible"] == {}


def test_registros_sin_tabla_informa_no_disponible(db_como_produccion):
    datos = server.registros_acceso(db_como_produccion)

    assert datos["disponible"] is False
    assert datos["motivo"] == "Esta base no registra sesiones de acceso"
    assert datos["logs"] == []


def test_registros_con_tabla_lista_eventos(db_con_sesiones):
    datos = server.registros_acceso(db_con_sesiones)
    assert datos["disponible"] is True
    assert datos["total"] == 1
    assert datos["logs"][0]["email"] == "ana@bibliociegos.cl"
