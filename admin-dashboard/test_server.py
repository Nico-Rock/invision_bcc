import http.client
import io
import json
import socket
import sqlite3
import threading
from http.server import HTTPServer

import pytest

import server
from conftest import FakeContainer


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


def test_subir_pista_no_deja_un_mp3_truncado(container):
    """Si el cliente corta a mitad, el blob no puede quedar publicado.

    Es el peor fallo posible acá: un MP3 truncado se sube "bien", nadie lo nota,
    y recien aparece cuando un usuario ciego escucha un capitulo que se corta.
    Mejor fallar ruidoso y que la pista se pueda reintentar.
    """
    # Declara 100 bytes pero el stream entrega 10: simula una conexion cortada
    status, data = server.subir_pista(
        "Libro", "01.mp3", io.BytesIO(b"0123456789"), 100, container
    )
    assert status == 500
    assert data["ok"] is False
    assert "RuntimeError" not in data["mensaje"]  # se lee por voz
    assert "Libro/01.mp3" not in container.store  # no queda basura publicada


def test_subir_pista_acepta_el_tamano_exacto(container):
    """Control: con el largo correcto la guarda de truncamiento no molesta."""
    status, data = server.subir_pista(
        "Libro", "01.mp3", io.BytesIO(b"0123456789"), 10, container
    )
    assert status == 201
    assert container.store["Libro/01.mp3"]["content"] == b"0123456789"


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


# --- Lector acotado -------------------------------------------------------


def test_bounded_reader_no_lee_de_mas():
    origen = io.BytesIO(b"AAAABBBB")  # 4 bytes nuestros + 4 de la proxima request
    lector = server._BoundedReader(origen, 4)
    assert lector.read() == b"AAAA"
    assert lector.read() == b""
    assert origen.read() == b"BBBB"  # intacto para el resto del stream


def test_bounded_reader_respeta_tamano_pedido():
    lector = server._BoundedReader(io.BytesIO(b"ABCDEF"), 6)
    assert lector.read(2) == b"AB"
    assert lector.read(10) == b"CDEF"
    assert lector.read(1) == b""


def test_bounded_reader_no_se_cuelga_si_el_cliente_corta():
    """Si el cliente corta la subida a mitad, el lector devuelve b'' y no reintenta.

    Un socket cerrado devuelve b'' para siempre; el lector tiene que propagar ese
    fin de datos en vez de quedarse pidiendo los bytes que faltan. Colgarse sin
    feedback es el peor final posible para quien opera el panel sin ver.
    """
    lector = server._BoundedReader(io.BytesIO(b"AA"), 10)  # prometio 10, llegan 2
    assert lector.read() == b"AA"
    assert lector.read() == b""
    assert lector.read() == b""


# --- Guarda de Host (DNS rebinding) ---------------------------------------


def test_host_valido_acepta_la_maquina_local():
    for host in ["localhost", "localhost:8888", "127.0.0.1", "127.0.0.1:8888"]:
        assert server._host_valido({"Host": host}) is True, host


def test_host_valido_rechaza_dominio_externo_o_ausente():
    """Un dominio del atacante que resuelva a 127.0.0.1 no puede leer el token."""
    for host in ["evil.com", "evil.com:8888", "rebind.localhost.evil.com", ""]:
        assert server._host_valido({"Host": host}) is False, host
    assert server._host_valido({}) is False  # falla cerrado


# --- Extremo a extremo: servidor HTTP real, Azure y base stubeados --------

TOKEN_DE_PRUEBA = "token-solo-de-test"


class _FakeBlobService:
    """Reemplaza a BlobServiceClient: siempre entrega el mismo contenedor falso."""

    contenedor = None

    @classmethod
    def from_connection_string(cls, conn_str):
        return cls()

    def get_container_client(self, nombre):
        return type(self).contenedor


def _pedir(puerto, metodo, ruta, cuerpo=None, headers=None):
    """Request HTTP de verdad contra el servidor de prueba. Devuelve (status, dict)."""
    conn = http.client.HTTPConnection("127.0.0.1", puerto, timeout=5)
    try:
        conn.request(metodo, ruta, body=cuerpo, headers=headers or {})
        respuesta = conn.getresponse()
        crudo = respuesta.read()
        try:
            return respuesta.status, json.loads(crudo)
        except ValueError:
            return respuesta.status, {"_crudo": crudo}
    finally:
        conn.close()


@pytest.fixture
def panel(monkeypatch, tmp_path):
    """Levanta el servidor real en un puerto efímero, sin tocar producción.

    La base es un SQLite temporal y el contenedor de Blob es el fake en memoria:
    ningún test escribe en Azure SQL ni en Azure Blob.
    """
    ruta_db = tmp_path / "panel.db"
    inicial = sqlite3.connect(ruta_db)
    inicial.executescript(
        """
        CREATE TABLE audiolibros (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            descripcion TEXT,
            genero TEXT,
            autor TEXT,
            categoria_id INTEGER
        );
        CREATE TABLE categorias (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL
        );
        INSERT INTO categorias (nombre) VALUES ('Novela'), ('Ensayo');
        """
    )
    inicial.commit()
    inicial.close()

    def db_falsa():
        # La conexión se abre DENTRO del hilo del servidor: sqlite3 no permite
        # compartir una conexión entre hilos.
        conn = sqlite3.connect(ruta_db)
        conn.row_factory = sqlite3.Row
        return {"type": "sqlite", "conn": conn}

    contenedor = FakeContainer()
    _FakeBlobService.contenedor = contenedor

    monkeypatch.setattr(server, "ADMIN_TOKEN", TOKEN_DE_PRUEBA)
    monkeypatch.setattr(server, "get_db_connection", db_falsa)
    monkeypatch.setattr(server, "AZURE_SDK_AVAILABLE", True)
    monkeypatch.setattr(server, "AZURE_ACCOUNT_KEY", "clave-falsa")
    monkeypatch.setattr(server, "BlobServiceClient", _FakeBlobService, raising=False)
    monkeypatch.setattr(server.AdminApiHandler, "log_message", lambda *a, **k: None)

    httpd = HTTPServer(("127.0.0.1", 0), server.AdminApiHandler)
    hilo = threading.Thread(target=httpd.serve_forever, daemon=True)
    hilo.start()
    try:
        yield {
            "puerto": httpd.server_address[1],
            "contenedor": contenedor,
            "ruta_db": ruta_db,
        }
    finally:
        httpd.shutdown()
        httpd.server_close()
        hilo.join(timeout=5)


def _auth(extra=None):
    headers = {"X-Admin-Token": TOKEN_DE_PRUEBA}
    headers.update(extra or {})
    return headers


def test_e2e_crear_libro_sin_token_da_401(panel):
    status, data = _pedir(
        panel["puerto"],
        "POST",
        "/api/admin/crear-libro",
        json.dumps({"nombre": "Sin permiso"}),
        {"Content-Type": "application/json"},
    )
    assert status == 401
    assert data["ok"] is False
    # No creó nada
    conn = sqlite3.connect(panel["ruta_db"])
    assert conn.execute("SELECT COUNT(*) FROM audiolibros").fetchone()[0] == 0
    conn.close()


def test_e2e_rechazo_con_cuerpo_grande_igual_llega_al_cliente(panel):
    """El 401 tiene que llegar aunque el cuerpo no se haya leido.

    Si el servidor cierra el socket con bytes sin leer, TCP manda un RST y el
    navegador tira la respuesta: el admin escucharia un error de red en vez de
    "no estás autorizado". Con un cuerpo grande el RST es sistematico.
    """
    grande = json.dumps({"nombre": "x" * 300_000})
    status, data = _pedir(
        panel["puerto"],
        "POST",
        "/api/admin/subir-pista?nombre=Libro&archivo=01.mp3",
        grande,
    )
    assert status == 401
    assert data["ok"] is False
    assert panel["contenedor"].store == {}


def test_e2e_crear_libro_con_token_crea(panel):
    status, data = _pedir(
        panel["puerto"],
        "POST",
        "/api/admin/crear-libro",
        json.dumps({"nombre": "Rayuela", "autor": "Cortázar"}),
        _auth({"Content-Type": "application/json"}),
    )
    assert status == 201
    assert data["ok"] is True
    assert "Rayuela" in data["mensaje"]

    conn = sqlite3.connect(panel["ruta_db"])
    assert conn.execute("SELECT nombre FROM audiolibros").fetchone()[0] == "Rayuela"
    conn.close()


def test_e2e_crear_libro_con_nombre_no_texto_da_400(panel):
    """Un nombre numérico haría explotar el .strip() -> 400 hablado, no 500 mudo."""
    status, data = _pedir(
        panel["puerto"],
        "POST",
        "/api/admin/crear-libro",
        json.dumps({"nombre": 123}),
        _auth({"Content-Type": "application/json"}),
    )
    assert status == 400
    assert data["ok"] is False
    assert "texto" in data["mensaje"].lower()


def test_e2e_crear_libro_con_json_que_no_es_objeto_da_400(panel):
    status, data = _pedir(
        panel["puerto"],
        "POST",
        "/api/admin/crear-libro",
        json.dumps(["no", "es", "un", "objeto"]),
        _auth({"Content-Type": "application/json"}),
    )
    assert status == 400
    assert data["ok"] is False


def test_e2e_crear_libro_con_json_roto_no_dice_jerga(panel):
    """El JSON inválido cae al except general: el mensaje se lee por voz."""
    status, data = _pedir(
        panel["puerto"],
        "POST",
        "/api/admin/crear-libro",
        "{esto no es json",
        _auth({"Content-Type": "application/json"}),
    )
    assert status == 500
    assert data["ok"] is False
    assert "JSONDecodeError" not in data["mensaje"]
    assert data["detalle"] == "JSONDecodeError"  # el dato técnico va aparte


def test_e2e_subir_pista_sin_token_da_401(panel):
    status, data = _pedir(
        panel["puerto"],
        "POST",
        "/api/admin/subir-pista?nombre=Rayuela&archivo=01.mp3",
        b"audio-falso",
    )
    assert status == 401
    assert data["ok"] is False
    assert panel["contenedor"].store == {}  # no tocó el storage


def test_e2e_subir_pista_con_token_sube(panel):
    status, data = _pedir(
        panel["puerto"],
        "POST",
        "/api/admin/subir-pista?nombre=Rayuela&archivo=01.mp3",
        b"audio-falso",
        _auth(),
    )
    assert status == 201
    assert data["ok"] is True
    assert panel["contenedor"].store["Rayuela/01.mp3"]["content"] == b"audio-falso"
    assert panel["contenedor"].store["Rayuela/01.mp3"]["content_type"] == "audio/mpeg"


def test_e2e_endpoint_post_desconocido_da_404(panel):
    status, data = _pedir(
        panel["puerto"], "POST", "/api/admin/inventado", b"{}", _auth()
    )
    assert status == 404
    assert data["ok"] is False


def test_e2e_get_categorias(panel):
    status, data = _pedir(panel["puerto"], "GET", "/api/categorias")
    assert status == 200
    assert data["total"] == 2
    assert [c["nombre"] for c in data["categorias"]] == ["Ensayo", "Novela"]


def test_e2e_host_malicioso_da_403(panel):
    """DNS rebinding: evil.com resuelve a 127.0.0.1 y el navegador leería el token."""
    for metodo, ruta, cuerpo in [
        ("GET", "/", None),
        ("GET", "/api/categorias", None),
        ("POST", "/api/admin/crear-libro", json.dumps({"nombre": "x"})),
    ]:
        status, data = _pedir(
            panel["puerto"], metodo, ruta, cuerpo, _auth({"Host": "evil.com"})
        )
        assert status == 403, f"{metodo} {ruta}"
        assert data["ok"] is False

    conn = sqlite3.connect(panel["ruta_db"])
    assert conn.execute("SELECT COUNT(*) FROM audiolibros").fetchone()[0] == 0
    conn.close()


def test_e2e_cliente_que_corta_a_mitad_no_cuelga_ni_ensucia_la_consola(panel, capfd):
    """El admin cierra la pestaña a mitad de la subida.

    El servidor atiende de a una request: si se queda esperando los bytes que
    faltan, el panel entero deja de responder y quien no ve la pantalla no tiene
    forma de darse cuenta. Y un cliente que se fue no puede dejar un traceback de
    dos pantallas en la consola, que es donde se diagnostica el panel.
    """
    s = socket.create_connection(("127.0.0.1", panel["puerto"]), timeout=5)
    s.sendall(
        b"POST /api/admin/subir-pista?nombre=Cortada&archivo=01.mp3 HTTP/1.0\r\n"
        b"Host: localhost\r\n"
        + f"X-Admin-Token: {TOKEN_DE_PRUEBA}\r\n".encode()
        + b"Content-Length: 5000000\r\n\r\n"  # promete 5 MB
        + b"M" * 1000  # manda 1000 bytes y se va
    )
    s.close()

    status, _ = _pedir(panel["puerto"], "GET", "/api/categorias")
    assert status == 200, "el servidor quedo colgado esperando el resto del cuerpo"
    assert "Traceback" not in capfd.readouterr().err


def test_e2e_content_length_invalido_contesta_en_vez_de_morir(panel):
    """Un Content-Length que no es un numero tiene que terminar en respuesta.

    Si la request muere sin contestar, el panel se queda esperando para siempre
    y no hay nada que anunciar por voz: el admin no ve la pantalla para notarlo.
    """
    s = socket.create_connection(("127.0.0.1", panel["puerto"]), timeout=5)
    s.sendall(
        b"POST /api/admin/crear-libro HTTP/1.0\r\n"
        b"Host: localhost\r\n"
        + f"X-Admin-Token: {TOKEN_DE_PRUEBA}\r\n".encode()
        + b"Content-Length: abc\r\n\r\n"
    )
    respuesta = b""
    while True:
        trozo = s.recv(4096)
        if not trozo:
            break
        respuesta += trozo
    s.close()

    assert b"400" in respuesta.split(b"\r\n")[0], respuesta[:200]
    assert b'"ok": false' in respuesta


def test_e2e_error_inesperado_no_habla_en_jerga(panel, monkeypatch):
    def db_rota():
        raise RuntimeError("se cayo la red")

    monkeypatch.setattr(server, "get_db_connection", db_rota)
    status, data = _pedir(
        panel["puerto"],
        "POST",
        "/api/admin/crear-libro",
        json.dumps({"nombre": "Rayuela"}),
        _auth({"Content-Type": "application/json"}),
    )
    assert status == 500
    assert data["ok"] is False
    assert "RuntimeError" not in data["mensaje"]
    assert data["detalle"] == "RuntimeError"


# --- T3: refresco del índice de audio [R4] ---

def test_e2e_refrescar_indice_sin_token_da_401(panel, monkeypatch):
    from invision.indice_blob import IndiceBlob

    llamadas = []
    monkeypatch.setattr(server, "INDICE_AUDIO", IndiceBlob(listar=lambda: llamadas.append(1) or []))
    status, data = _pedir(panel["puerto"], "POST", "/api/books/refrescar", "", {})
    assert status == 401
    assert llamadas == []


def test_e2e_refrescar_indice_con_token_reindexa(panel, monkeypatch):
    from invision.indice_blob import IndiceBlob

    indice = IndiceBlob(listar=lambda: [])
    monkeypatch.setattr(server, "INDICE_AUDIO", indice)
    status, data = _pedir(panel["puerto"], "POST", "/api/books/refrescar", "", _auth())
    indice.esperar(timeout=2)

    assert status == 202
    assert data["ok"] is True
    assert indice.estado()["estado"] == "listo"
