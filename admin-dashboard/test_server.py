import server


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
