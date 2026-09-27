"""Spec 005, grupos B y C (R18 a R27). Base SQLite de prueba; Azure simulado.

Cada test cita su requisito. Las tablas nuevas se crean solo para este módulo
(viven fuera del create_all de la API, R28).
"""
import datetime
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from test_routes import test_db, client, admin_token  # noqa: F401  (fixtures)
from test_database import test_engine
from models import Audiolibro
from models_extras import BaseExtras, PapeleraAudiolibro

CUADRO = bytes([0xFF, 0xFB, 0x90, 0x64]) + bytes(413)


def mp3(cuadros):
    return CUADRO * cuadros


def H(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module", autouse=True)
def tablas_extras(test_db):
    BaseExtras.metadata.create_all(bind=test_engine)
    yield
    BaseExtras.metadata.drop_all(bind=test_engine)


@pytest.fixture(autouse=True)
def lanzar_en_linea():
    """Las tareas corren en un hilo; en los tests, en el mismo hilo."""
    with patch("admin_extras.lanzar", side_effect=lambda fn: fn()):
        yield


def _token(client, email, clave):
    return client.post("/auth/token/", data={"username": email, "password": clave}).json()["access_token"]


@pytest.fixture(scope="module")
def socio(client, admin_token):
    r = client.post("/users/", headers=H(admin_token),
                    json={"email": "socio.bc@example.com", "username": "sociobc", "password": "clave-segura-1"})
    assert r.status_code == 201, r.text
    return {"id": r.json()["id"], "token": _token(client, "socio.bc@example.com", "clave-segura-1")}


def crear(client, admin_token, nombre, **extra):
    r = client.post("/admin/audiolibros", headers=H(admin_token), json={"nombre": nombre, **extra})
    assert r.status_code == 201, r.text
    return r.json()["id"]


def ficha(client, admin_token, libro_id):
    return next((b for b in client.get("/admin/audiolibros", headers=H(admin_token)).json() if b["id"] == libro_id), None)


def contenedor(blobs):
    c = MagicMock()

    def cliente_blob(nombre):
        bc = MagicMock()
        bc.exists.return_value = nombre in blobs
        bc.download_blob.return_value.readall.return_value = blobs.get(nombre, b"")
        return bc

    c.get_blob_client.side_effect = cliente_blob
    c.list_blobs.side_effect = lambda name_starts_with="": [
        SimpleNamespace(name=n, size=len(b), last_modified=None) for n, b in blobs.items() if n.startswith(name_starts_with)
    ]
    return c


def indice(con_audio):
    falso = MagicMock()
    falso.estado.return_value = {"estado": "listo", "error": None, "ultimo_ok": None}
    falso.datos.return_value = {"books": {n: {"title": n, "tracks": [], "total_tracks": 1} for n in con_audio}}
    return falso


# --- R19: publicación ---------------------------------------------------------------

def test_r19_las_fichas_existentes_sin_fila_siguen_publicadas(client, admin_token):
    viejo = next(b for b in client.get("/admin/audiolibros", headers=H(admin_token)).json() if b["nombre"] == "Libro de Prueba")
    assert viejo["estado_publicacion"] == "publicado"


def test_r19_nueva_ficha_nace_en_borrador_y_no_la_ven_los_socios(client, admin_token, socio):
    libro_id = crear(client, admin_token, "BORRADOR BC", genero="GENERO SOLO BORRADOR")
    assert ficha(client, admin_token, libro_id)["estado_publicacion"] == "borrador"
    assert "GENERO SOLO BORRADOR" not in client.get("/genres").json()
    r = client.get("/books-by-genre/GENERO SOLO BORRADOR", headers=H(socio["token"]))
    assert all(b["id"] != libro_id for b in r.json())


def test_r19_publicar_exige_audio(client, admin_token, socio):
    libro_id = crear(client, admin_token, "PUBLICABLE BC", genero="GENERO PUBLICABLE")
    with patch("admin_extras.container_client", contenedor({})):
        r = client.put(f"/admin/audiolibros/{libro_id}/publicacion", headers=H(admin_token), json={"estado": "publicado"})
    assert r.status_code == 409 and "audio" in r.json()["detail"]
    with patch("admin_extras.container_client", contenedor({"PUBLICABLE BC/Pista 1.mp3": mp3(1000)})):
        r = client.put(f"/admin/audiolibros/{libro_id}/publicacion", headers=H(admin_token), json={"estado": "publicado"})
    assert r.status_code == 200, r.text
    assert ficha(client, admin_token, libro_id)["estado_publicacion"] == "publicado"
    assert "GENERO PUBLICABLE" in client.get("/genres").json()
    r = client.get("/books-by-genre/GENERO PUBLICABLE", headers=H(socio["token"]))
    assert any(b["id"] == libro_id for b in r.json())


# --- R18: Inicio con pendientes --------------------------------------------------------

def test_r18_pendientes(client, admin_token):
    crear(client, admin_token, "CON AUDIO BC", genero="CUENTOS BC")
    crear(client, admin_token, "SIN AUDIO PEND", genero="cuento bc")
    with patch("admin_extras.INDICE_AUDIO", indice(["CON AUDIO BC"])):
        r = client.get("/admin/pendientes", headers=H(admin_token))
    assert r.status_code == 200, r.text
    p = r.json()
    nombres_sin_audio = [b["nombre"] for b in p["sin_audio"]["libros"]]
    assert "SIN AUDIO PEND" in nombres_sin_audio and "CON AUDIO BC" not in nombres_sin_audio
    assert p["sin_narrador"]["cantidad"] >= 2
    assert p["borradores"]["cantidad"] >= 2
    assert ["CUENTOS BC", "cuento bc"] in [sorted(g) for g in p["parecidos"]["generos"]] or \
        sorted(["CUENTOS BC", "cuento bc"]) in [sorted(g) for g in p["parecidos"]["generos"]]
    assert "informe" in p


# --- R20 y R21: verificación y tareas --------------------------------------------------

def test_r20_confirmar_una_pista_la_verifica(client, admin_token):
    libro_id = crear(client, admin_token, "VERIF BC")
    blobs = {"VERIF BC/Pista 1.mp3": mp3(1000), "VERIF BC/Pista 2.mp3": b"dummy mp3 content"}
    with patch("admin_extras.container_client", contenedor(blobs)):
        buena = client.post(f"/audiolibros/{libro_id}/capitulos/confirmar", headers=H(admin_token), json={"blob_path": "VERIF BC/Pista 1.mp3"})
        mala = client.post(f"/audiolibros/{libro_id}/capitulos/confirmar", headers=H(admin_token), json={"blob_path": "VERIF BC/Pista 2.mp3"})
        ajena = client.post(f"/audiolibros/{libro_id}/capitulos/confirmar", headers=H(admin_token), json={"blob_path": "OTRO/Pista 1.mp3"})
        falta = client.post(f"/audiolibros/{libro_id}/capitulos/confirmar", headers=H(admin_token), json={"blob_path": "VERIF BC/Pista 9.mp3"})
    assert buena.status_code == 200 and buena.json()["problemas"] == []
    assert abs(buena.json()["duracion_segundos"] - 26.12) < 0.05
    assert "segundos" in buena.json()["duracion_hablada"]
    assert mala.json()["problemas"] == ["sin_audio"] and "no tiene audio" in mala.json()["descripcion"]
    assert ajena.status_code == 422
    assert falta.status_code == 404


def test_r20_r21_verificar_un_libro_es_una_tarea_con_estado_real(client, admin_token):
    libro_id = crear(client, admin_token, "TAREA BC")
    blobs = {"TAREA BC/Pista 1.mp3": mp3(1000), "TAREA BC/Pista 2.mp3": mp3(300) + bytes([0x12]) * 20000 + mp3(300)}
    with patch("admin_extras.container_client", contenedor(blobs)):
        r = client.post(f"/admin/audiolibros/{libro_id}/verificar", headers=H(admin_token))
    assert r.status_code == 202, r.text
    tarea = client.get(f"/admin/tareas/{r.json()['tarea_id']}", headers=H(admin_token)).json()
    assert tarea["estado"] == "con_errores"
    assert tarea["total"] == 2 and tarea["hechos"] == 2 and tarea["fallidos"] == 1
    assert any("dañado" in item["mensaje"] for item in tarea["detalle"])
    audio = client.get(f"/admin/audiolibros/{libro_id}/audio", headers=H(admin_token)).json()
    assert audio["verificadas"] == 2 and audio["duracion_total_segundos"] > 26
    assert any(t["id"] == tarea["id"] for t in client.get("/admin/tareas", headers=H(admin_token)).json())


# --- R22: importador ----------------------------------------------------------------------

def test_r22_importador_analiza_sin_escribir_y_ejecuta_como_tarea(client, admin_token, test_db):
    crear(client, admin_token, "EXISTENTE BC", genero="NOVELA BC")
    texto = "Título;Autor;Narrador;Género\nNUEVO IMPORTADO;AUTORA;ANA VOZ;novelas bc\nEXISTENTE BC;X;Y;NOVELA BC\n;SIN;TITULO;NOVELA BC\n"
    antes = test_db.query(Audiolibro).count()
    a = client.post("/admin/importador/analizar", headers=H(admin_token), json={"texto": texto}).json()
    assert test_db.query(Audiolibro).count() == antes
    assert a["resumen"]["listas"] == 1 and a["resumen"]["bloqueadas"] == 2 and a["resumen"]["con_avisos"] == 1
    r = client.post("/admin/importador/ejecutar", headers=H(admin_token), json={"texto": texto, "mapeo": a["mapeo"]})
    assert r.status_code == 202, r.text
    tarea = client.get(f"/admin/tareas/{r.json()['tarea_id']}", headers=H(admin_token)).json()
    assert tarea["estado"] == "terminada" and tarea["hechos"] == 1
    nuevo = next(b for b in client.get("/admin/audiolibros", headers=H(admin_token)).json() if b["nombre"] == "NUEVO IMPORTADO")
    assert nuevo["estado_publicacion"] == "borrador"
    assert nuevo["genero"] == "NOVELA BC" and nuevo["narrador"] == "ANA VOZ"


# --- R23: papelera, historial y deshacer --------------------------------------------------

def test_r23_papelera_restaurar_y_vaciar_vencidos(client, admin_token, test_db):
    libro_id = crear(client, admin_token, "PAPELERA BC")
    r = client.delete(f"/admin/audiolibros/{libro_id}", headers=H(admin_token))
    assert r.status_code == 200 and r.json()["papelera"] is True
    assert ficha(client, admin_token, libro_id) is None
    papelera = client.get("/admin/papelera", headers=H(admin_token)).json()
    item = next(p for p in papelera if p["audiolibro_id"] == libro_id)
    assert item["dias_restantes"] == 30
    assert client.post(f"/admin/papelera/{libro_id}/restaurar", headers=H(admin_token)).status_code == 200
    assert ficha(client, admin_token, libro_id) is not None

    client.delete(f"/admin/audiolibros/{libro_id}", headers=H(admin_token))
    fila = test_db.query(PapeleraAudiolibro).filter_by(audiolibro_id=libro_id).first()
    fila.eliminado_en = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=31)
    test_db.commit()
    r = client.post("/admin/papelera/vaciar-vencidos", headers=H(admin_token))
    assert r.json()["eliminados"] == 1
    test_db.expire_all()
    assert test_db.query(Audiolibro).filter_by(id=libro_id).first() is None


def test_r23_historial_y_deshacer(client, admin_token):
    libro_id = crear(client, admin_token, "HIST BC", autor="AUTORA UNO")
    client.put(f"/admin/audiolibros/{libro_id}", headers=H(admin_token), json={"nombre": "HIST BC", "autor": "AUTORA DOS"})
    historial = client.get(f"/admin/audiolibros/{libro_id}/historial", headers=H(admin_token)).json()
    cambio = next(h for h in historial if h["campo"] == "autor")
    assert cambio["antes"] == "AUTORA UNO" and cambio["despues"] == "AUTORA DOS"
    r = client.post(f"/admin/historial/{cambio['id']}/deshacer", headers=H(admin_token))
    assert r.status_code == 200, r.text
    assert ficha(client, admin_token, libro_id)["autor"] == "AUTORA UNO"
    assert client.get(f"/admin/audiolibros/{libro_id}/historial", headers=H(admin_token)).json()[0]["motivo"] == "deshacer"


# --- R24: fusión de valores -------------------------------------------------------------

def test_r24_fusionar_variantes_con_vista_previa(client, admin_token):
    a = crear(client, admin_token, "FUSION A", genero="POESIA BC")
    b = crear(client, admin_token, "FUSION B", genero="POESÍAS BC")
    previa = client.get("/admin/vocabulario/vista-previa", headers=H(admin_token),
                        params={"campo": "genero", "origen": ["POESIA BC"], "destino": "POESÍAS BC"}).json()
    assert previa["fichas"] == 1
    r = client.post("/admin/vocabulario/fusionar", headers=H(admin_token),
                    json={"campo": "genero", "origen": ["POESIA BC"], "destino": "POESÍAS BC"})
    assert r.status_code == 200 and r.json()["fichas"] == 1
    assert ficha(client, admin_token, a)["genero"] == "POESÍAS BC" == ficha(client, admin_token, b)["genero"]
    assert client.get(f"/admin/audiolibros/{a}/historial", headers=H(admin_token)).json()[0]["motivo"] == "fusion"
    malo = client.post("/admin/vocabulario/fusionar", headers=H(admin_token),
                       json={"campo": "hashed_password", "origen": ["x"], "destino": "y"})
    assert malo.status_code == 422


# --- R25: perfil de accesibilidad -------------------------------------------------------

def test_r25_perfil_define_las_preferencias_iniciales(client, admin_token, socio):
    r = client.put(f"/admin/usuarios/{socio['id']}/perfil", headers=H(admin_token), json={"perfil": "baja_vision"})
    assert r.status_code == 200, r.text
    lista = client.get("/users/", headers=H(admin_token)).json()
    assert next(u for u in lista if u["id"] == socio["id"])["perfil"] == "baja_vision"
    pref = client.get("/user/me/preferencias", headers=H(socio["token"])).json()
    assert pref == {"perfil": "baja_vision", "preferencias": {"contraste": True, "texto": 24, "voz": True}}
    assert client.put(f"/admin/usuarios/{socio['id']}/perfil", headers=H(admin_token), json={"perfil": "otro"}).status_code == 422
    admin_pref = client.get("/user/me/preferencias", headers=H(admin_token)).json()
    assert admin_pref["perfil"] is None


# --- R26 y R27: registro de operaciones e informe del día ------------------------------

def test_r26_r27_registro_e_informe(client, admin_token):
    libro_id = crear(client, admin_token, "INFORME BC")
    blobs = {"INFORME BC/Pista 1.mp3": mp3(1000)}
    with patch("admin_extras.container_client", contenedor(blobs)):
        client.post(f"/audiolibros/{libro_id}/capitulos/confirmar", headers=H(admin_token), json={"blob_path": "INFORME BC/Pista 1.mp3"})
        client.put(f"/admin/audiolibros/{libro_id}/publicacion", headers=H(admin_token), json={"estado": "publicado"})
    ops = client.get("/admin/operaciones", headers=H(admin_token), params={"operacion": "crear_libro"}).json()
    assert any(o["objeto"] == "INFORME BC" and o["usuario"]["email"] == "admin@example.com" for o in ops)
    informe = client.get("/admin/informe", headers=H(admin_token)).json()
    assert informe["creados"] >= 1 and informe["publicados"] >= 1 and informe["pistas_subidas"] >= 1
    assert informe["fecha"] == datetime.date.today().isoformat()


# --- Permisos y degradación -------------------------------------------------------------

RUTAS_ADMIN = [
    ("get", "/admin/pendientes"), ("get", "/admin/tareas"), ("get", "/admin/papelera"),
    ("get", "/admin/operaciones"), ("get", "/admin/informe"),
    ("post", "/admin/importador/analizar"), ("post", "/admin/vocabulario/fusionar"),
]


@pytest.mark.parametrize("metodo,ruta", RUTAS_ADMIN)
def test_rutas_nuevas_exigen_admin(client, socio, metodo, ruta):
    assert getattr(client, metodo)(ruta).status_code == 401
    assert getattr(client, metodo)(ruta, headers=H(socio["token"])).status_code == 403


def test_r28_sin_tablas_degrada_con_aviso(client, admin_token):
    BaseExtras.metadata.drop_all(bind=test_engine)
    try:
        with patch("admin_extras.INDICE_AUDIO", indice([])):
            p = client.get("/admin/pendientes", headers=H(admin_token))
        assert p.status_code == 200 and p.json()["borradores"]["habilitado"] is False
        libro_id = crear(client, admin_token, "SIN TABLAS BC")
        r = client.put(f"/admin/audiolibros/{libro_id}/publicacion", headers=H(admin_token), json={"estado": "publicado"})
        assert r.status_code == 503 and "habilitad" in r.json()["detail"]
        assert client.get("/admin/papelera", headers=H(admin_token)).status_code == 503
        assert client.delete(f"/admin/audiolibros/{libro_id}", headers=H(admin_token)).status_code == 204
    finally:
        BaseExtras.metadata.create_all(bind=test_engine)
