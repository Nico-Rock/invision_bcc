"""R28: las tablas nuevas solo se crean solas en SQLite local."""
from unittest.mock import MagicMock

import pytest

import habilitar_local
from test_database import test_engine
from models_extras import BaseExtras


def test_crea_todas_las_tablas_en_sqlite():
    tablas = habilitar_local.habilitar(test_engine)
    assert set(tablas) == set(BaseExtras.metadata.tables)
    BaseExtras.metadata.drop_all(bind=test_engine)


def test_se_niega_a_una_base_que_no_es_sqlite():
    motor = MagicMock()
    motor.url.drivername = "mssql+pyodbc"
    with pytest.raises(ValueError):
        habilitar_local.habilitar(motor)
