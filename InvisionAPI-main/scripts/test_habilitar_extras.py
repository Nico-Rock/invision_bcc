"""Spec 005 (R7, R28): la tabla del narrador solo se crea en SQLite local."""
import sqlite3

import pytest

import habilitar_extras as hab


def test_crea_la_tabla_en_sqlite_local(tmp_path):
    base = tmp_path / "invision.db"
    sqlite3.connect(base).close()
    hab.habilitar(str(base))
    con = sqlite3.connect(base)
    columnas = [c[1] for c in con.execute("PRAGMA table_info(audiolibro_narracion)")]
    assert columnas == ["audiolibro_id", "narrador", "en_memoria", "actualizado_en"]
    hab.habilitar(str(base))  # idempotente


@pytest.mark.parametrize("destino", ["mssql+pyodbc://x", "sqlite:///x.db", "https://x"])
def test_se_niega_a_todo_lo_que_no_sea_un_archivo_local(destino):
    with pytest.raises(ValueError):
        hab.habilitar(destino)


def test_se_niega_a_un_archivo_que_no_existe(tmp_path):
    with pytest.raises(ValueError):
        hab.habilitar(str(tmp_path / "no-existe.db"))
