import io
import sqlite3

import server


def test_crear_libro_persiste_para_otra_conexion(db_info, tmp_path):
    """El commit tiene que ser real: otra conexion debe ver la fila.

    Los demas tests consultan la MISMA conexion que hizo el INSERT, donde una
    escritura sin commitear igual se ve. Sin este test, borrar el conn.commit()
    no rompe nada y la carga del bibliotecario se perderia en silencio.
    """
    server.crear_libro({"nombre": "Persistente"}, db_info)
    otra = sqlite3.connect(tmp_path / "test.db")
    try:
        assert (
            otra.execute(
                "SELECT COUNT(*) FROM audiolibros WHERE nombre = 'Persistente'"
            ).fetchone()[0]
            == 1
        )
    finally:
        otra.close()


def test_crear_libro_exitoso(db_info):
    status, data = server.crear_libro({"nombre": "Libro Nuevo", "autor": "Autora"}, db_info)
    assert status == 201
    assert data["ok"] is True
    assert isinstance(data["id"], int)
    assert "Libro Nuevo" in data["mensaje"]

    fila = db_info["conn"].execute("SELECT nombre, autor FROM audiolibros").fetchone()
    assert fila["nombre"] == "Libro Nuevo"
    assert fila["autor"] == "Autora"


def test_crear_libro_rechaza_nombre_vacio(db_info):
    status, data = server.crear_libro({"nombre": "   "}, db_info)
    assert status == 400
    assert data["ok"] is False
    assert db_info["conn"].execute("SELECT COUNT(*) FROM audiolibros").fetchone()[0] == 0


def test_crear_libro_detecta_duplicado_ignorando_mayusculas(db_info):
    server.crear_libro({"nombre": "Actos Humanos"}, db_info)
    status, data = server.crear_libro({"nombre": "actos humanos"}, db_info)
    assert status == 409
    assert data["ok"] is False
    assert "ya existe" in data["mensaje"].lower()
    # No debe haber insertado una segunda fila
    assert db_info["conn"].execute("SELECT COUNT(*) FROM audiolibros").fetchone()[0] == 1


def test_subir_pista_exitosa(container):
    status, data = server.subir_pista(
        "Actos Humanos", "01.mp3", io.BytesIO(b"audio-falso"), 11, container
    )
    assert status == 201
    assert data["ok"] is True
    assert data["skipped"] is False
    assert container.store["Actos Humanos/01.mp3"]["content"] == b"audio-falso"
    assert container.store["Actos Humanos/01.mp3"]["content_type"] == "audio/mpeg"


def test_subir_pista_saltea_si_ya_existe(container):
    server.subir_pista("Libro", "01.mp3", io.BytesIO(b"original"), 8, container)
    status, data = server.subir_pista(
        "Libro", "01.mp3", io.BytesIO(b"reemplazo"), 9, container
    )
    assert status == 200
    assert data["skipped"] is True
    # El audio original NO se pisó
    assert container.store["Libro/01.mp3"]["content"] == b"original"


def test_subir_pista_rechaza_extension_invalida(container):
    status, data = server.subir_pista(
        "Libro", "notas.txt", io.BytesIO(b"x"), 1, container
    )
    assert status == 400
    assert "MP3" in data["mensaje"]
    assert container.store == {}  # no tocó el storage


def test_subir_pista_rechaza_archivo_vacio(container):
    status, data = server.subir_pista("Libro", "01.mp3", io.BytesIO(b""), 0, container)
    assert status == 400
    assert container.store == {}


def test_subir_pista_rechaza_path_traversal(container):
    for nombre, archivo in [
        ("Libro", "../../etc/passwd.mp3"),
        ("../secreto", "01.mp3"),
        ("Libro", "sub/carpeta.mp3"),
        # El SDK deja los dot-segments sin escapar en la URL: un nombre "." haría
        # que cualquier capa que normalice la ruta escriba en la raíz del contenedor.
        (".", "01.mp3"),
        (". ", "01.mp3"),
    ]:
        status, data = server.subir_pista(
            nombre, archivo, io.BytesIO(b"x"), 1, container
        )
        assert status == 400, f"deberia rechazar {nombre}/{archivo}"
    assert container.store == {}


def test_subir_pista_informa_error_de_azure(container):
    class ContainerRoto:
        def get_blob_client(self, name):
            class C:
                def exists(self):
                    return False

                def upload_blob(self, *a, **k):
                    raise RuntimeError("network down")

            return C()

    status, data = server.subir_pista(
        "Libro", "01.mp3", io.BytesIO(b"x"), 1, ContainerRoto()
    )
    assert status == 500
    assert data["ok"] is False
    assert "01.mp3" in data["mensaje"]
    # El mensaje se lee por voz: no puede llevar el nombre crudo de la excepción.
    assert "RuntimeError" not in data["mensaje"]
    assert data["detalle"] == "RuntimeError"  # queda aparte, para diagnóstico


def test_token_valido_acepta_el_token_configurado(monkeypatch):
    monkeypatch.setattr(server, "ADMIN_TOKEN", "secreto-de-prueba")
    assert server._token_valido({"X-Admin-Token": "secreto-de-prueba"}) is True


def test_token_valido_rechaza_token_incorrecto_o_ausente(monkeypatch):
    monkeypatch.setattr(server, "ADMIN_TOKEN", "secreto-de-prueba")
    assert server._token_valido({"X-Admin-Token": "otro"}) is False
    assert server._token_valido({}) is False


def test_token_valido_rechaza_todo_si_no_hay_token_configurado(monkeypatch):
    """Sin ADMIN_TOKEN en el entorno se bloquea la escritura, no se abre."""
    monkeypatch.setattr(server, "ADMIN_TOKEN", "")
    assert server._token_valido({"X-Admin-Token": ""}) is False
    assert server._token_valido({"X-Admin-Token": "loquesea"}) is False
