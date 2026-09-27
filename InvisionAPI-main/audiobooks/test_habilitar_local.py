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


def test_limpiar_pruebas_borra_solo_rastros_del_arnes():
    from test_database import TestingSessionLocal
    from models_extras import RegistroOperacion, TareaAdmin
    habilitar_local.habilitar(test_engine)
    db = TestingSessionLocal()
    db.add_all([
        RegistroOperacion(operacion="crear_libro", objeto="PRUEBA ARNES 123"),
        RegistroOperacion(operacion="crear_libro", objeto="RAYUELA"),
        TareaAdmin(tipo="importar_fichas", titulo="Importar 1 fichas", detalle='[{"nombre": "PRUEBA ARNES IMPORTADA 9"}]'),
        TareaAdmin(tipo="verificar_audio", titulo="Verificar el audio de RAYUELA", detalle="[]"),
    ])
    db.commit()
    borrados = habilitar_local.limpiar_pruebas(test_engine)
    assert borrados == 2
    assert [r.objeto for r in db.query(RegistroOperacion).all()] == ["RAYUELA"]
    assert [t.titulo for t in db.query(TareaAdmin).all()] == ["Verificar el audio de RAYUELA"]
    db.close()
    BaseExtras.metadata.drop_all(bind=test_engine)
