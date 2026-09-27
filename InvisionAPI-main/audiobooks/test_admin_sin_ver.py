"""Spec 005, grupo A: reparaciones de la auditoría del administrador ciego.

Cada test cita su criterio de verificación (V#). Reutiliza las fixtures de
test_routes.py (base SQLite de prueba, nunca producción). El almacenamiento de
audio está simulado: ningún test escribe en Azure.
"""
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy import inspect

from test_routes import test_db, client, admin_token  # noqa: F401  (fixtures)
from test_database import test_engine, Base
from models import Audiolibro, SesionAcceso, Usuario


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def libro(test_db):
    nuevo = Audiolibro(nombre="LIBRO SIN VER")
    test_db.add(nuevo)
    test_db.commit()
    test_db.refresh(nuevo)
    return nuevo


# --- T1 · V3: subida sin rutas ni sobrescritura --------------------------------

@pytest.mark.parametrize("nombre", ["../x.mp3", "a/b.mp3", "a\\b.mp3", "x.wav", "", "pista..mp3/.."])
def test_v3_presign_rechaza_nombres_peligrosos(client, admin_token, libro, nombre):
    with patch("routes.container_client", MagicMock()):
        r = client.post(f"/audiolibros/{libro.id}/capitulos/presign-upload",
                        params={"filename": nombre}, headers=_auth(admin_token))
    assert r.status_code == 422, r.text


def test_v3_presign_firma_solo_creacion(client, admin_token, libro):
    contenedor = MagicMock()
    contenedor.get_blob_client.return_value.exists.return_value = False
    with patch("routes.container_client", contenedor), \
         patch("routes.generate_blob_sas", return_value="sig=1") as firmar:
        r = client.post(f"/audiolibros/{libro.id}/capitulos/presign-upload",
                        params={"filename": "Pista 01.mp3"}, headers=_auth(admin_token))
    assert r.status_code == 200, r.text
    assert r.json()["estado"] == "subir"
    permiso = firmar.call_args.kwargs["permission"]
    assert permiso.create is True
    assert not permiso.write, "el permiso no puede permitir sobrescribir"
    assert r.json()["blob_path"] == "LIBRO SIN VER/Pista 01.mp3"


def test_v3_presign_no_firma_si_ya_existe(client, admin_token, libro):
    contenedor = MagicMock()
    contenedor.get_blob_client.return_value.exists.return_value = True
    with patch("routes.container_client", contenedor), \
         patch("routes.generate_blob_sas") as firmar:
        r = client.post(f"/audiolibros/{libro.id}/capitulos/presign-upload",
                        params={"filename": "Pista 01.mp3"}, headers=_auth(admin_token))
    assert r.status_code == 200
    assert r.json()["estado"] == "existe"
    firmar.assert_not_called()


# --- T2 · V1: ingesta deshabilitada, sin escritura -------------------------------

def test_v1_importar_lote_deshabilitado_no_escribe(client, admin_token, test_db):
    antes = test_db.query(Audiolibro).count()
    contenedor = MagicMock()
    with patch("sharepoint.container_client", contenedor):
        r = client.post("/admin/importar-lote", headers=_auth(admin_token),
                        json={"libros": [{"nombre": "NUEVO", "sharepoint_url": "https://ejemplo.org/x"}]})
    assert r.status_code == 503
    assert "deshabilitada" in r.json()["detail"].lower()
    assert test_db.query(Audiolibro).count() == antes
    contenedor.get_blob_client.assert_not_called()


def test_v1_la_ingesta_simulada_ya_no_sube_nada():
    import asyncio
    import sharepoint
    contenedor = MagicMock()
    with patch("sharepoint.container_client", contenedor), patch("sharepoint.get_graph_token", return_value="t"):
        with pytest.raises(NotImplementedError):
            asyncio.run(sharepoint.ingest_audiobook_files("https://ejemplo.org/x", "LIBRO"))
    contenedor.get_blob_client.assert_not_called()


# --- T3 · V9 y V10: roles y persona en la auditoría -----------------------------

def test_v9_usuarios_incluyen_sus_roles(client, admin_token):
    r = client.get("/users/", headers=_auth(admin_token))
    assert r.status_code == 200
    admin = next(u for u in r.json() if u["email"] == "admin@example.com")
    assert "Admin" in [rol["name"] for rol in admin["roles"]]


def test_v10_auditoria_dice_quien(client, admin_token, test_db):
    admin = test_db.query(Usuario).filter_by(email="admin@example.com").first()
    test_db.add(SesionAcceso(usuario_id=admin.id, tipo_evento="LOGIN"))
    test_db.commit()
    r = client.get("/admin/auditoria/sesiones/", headers=_auth(admin_token))
    assert r.status_code == 200
    evento = r.json()[0]
    assert evento["usuario"]["email"] == "admin@example.com"
    assert evento["usuario"]["username"] == "adminuser"


# --- T4 · V6: narrador y "En Memoria" --------------------------------------------

def test_v6_narracion_fuera_del_create_all():
    from models_extras import BaseExtras  # noqa: F401
    assert "audiolibro_narracion" not in Base.metadata.tables


def test_v6_sin_tabla_el_libro_se_guarda_igual(client, admin_token):
    from models_extras import BaseExtras
    BaseExtras.metadata.drop_all(bind=test_engine)
    r = client.post("/admin/audiolibros", headers=_auth(admin_token),
                    json={"nombre": "SIN TABLA", "narrador": "ANA", "en_memoria": True})
    assert r.status_code == 201, r.text
    assert r.json()["narracion"] == "no_habilitada"
    lista = client.get("/admin/audiolibros", headers=_auth(admin_token)).json()
    ficha = next(b for b in lista if b["nombre"] == "SIN TABLA")
    assert ficha["narracion_habilitada"] is False
    assert ficha["narrador"] is None


def test_v6_con_tabla_guarda_edita_y_borra_el_narrador(client, admin_token, test_db):
    from models_extras import BaseExtras
    BaseExtras.metadata.create_all(bind=test_engine)
    try:
        r = client.post("/admin/audiolibros", headers=_auth(admin_token),
                        json={"nombre": "CON NARRADOR", "narrador": "ROSA PÉREZ", "en_memoria": True})
        assert r.status_code == 201, r.text
        libro_id = r.json()["id"]
        ficha = next(b for b in client.get("/admin/audiolibros", headers=_auth(admin_token)).json()
                     if b["id"] == libro_id)
        assert ficha["narrador"] == "ROSA PÉREZ" and ficha["en_memoria"] is True
        assert ficha["narracion_habilitada"] is True

        r = client.put(f"/admin/audiolibros/{libro_id}", headers=_auth(admin_token),
                       json={"nombre": "CON NARRADOR", "narrador": "ROSA PEREZ", "en_memoria": False})
        assert r.status_code == 200
        ficha = next(b for b in client.get("/admin/audiolibros", headers=_auth(admin_token)).json()
                     if b["id"] == libro_id)
        assert ficha["narrador"] == "ROSA PEREZ" and ficha["en_memoria"] is False

        assert client.delete(f"/admin/audiolibros/{libro_id}", headers=_auth(admin_token)).status_code == 204
        with test_engine.connect() as conn:
            quedan = conn.exec_driver_sql(
                "SELECT COUNT(*) FROM audiolibro_narracion WHERE audiolibro_id = ?", (libro_id,)).scalar()
        assert quedan == 0
    finally:
        BaseExtras.metadata.drop_all(bind=test_engine)


def test_v6_narrador_se_valida_en_el_servidor(client, admin_token):
    r = client.post("/admin/audiolibros", headers=_auth(admin_token),
                    json={"nombre": "LARGO", "narrador": "x" * 500})
    assert r.status_code == 422
