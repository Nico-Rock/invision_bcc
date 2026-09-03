"""Fixtures para los tests del admin-dashboard.

Nada acá toca Azure ni Azure SQL: contenedor falso en memoria y SQLite temporal.
"""
import sqlite3
from types import SimpleNamespace

import pytest


class FakeBlobClient:
    def __init__(self, store, name):
        self.store = store
        self.name = name

    def exists(self):
        return self.name in self.store

    def upload_blob(self, data, overwrite=False, content_settings=None, length=None,
                    **kwargs):
        # Igual que el SDK real: el content-type SOLO se toma de `content_settings`.
        # Los kwargs que el SDK no conoce (p. ej. `content_type=`) se ignoran en
        # silencio, así que acá también -> el blob queda sin content-type y el
        # test lo caza, en vez de pasar por un fake más permisivo que la realidad.
        if self.name in self.store and not overwrite:
            raise FileExistsError(self.name)
        contenido = data.read() if hasattr(data, "read") else data
        self.store[self.name] = {
            "content": contenido,
            "content_type": getattr(content_settings, "content_type", None),
            "length": length,
        }

    def get_blob_properties(self):
        # `size` es lo REALMENTE escrito, no el largo declarado: si el cliente
        # cortó a mitad, los dos difieren y ahi esta la gracia de este fake.
        if self.name not in self.store:
            raise FileNotFoundError(self.name)
        return SimpleNamespace(size=len(self.store[self.name]["content"]))

    def delete_blob(self):
        self.store.pop(self.name, None)


class FakeContainer:
    """Reemplaza al ContainerClient de Azure. `store` es el estado inspeccionable."""

    def __init__(self):
        self.store = {}

    def get_blob_client(self, name):
        return FakeBlobClient(self.store, name)


@pytest.fixture
def container():
    return FakeContainer()


@pytest.fixture
def db_info(tmp_path):
    """SQLite temporal con el mismo esquema que la tabla real de audiolibros."""
    conn = sqlite3.connect(tmp_path / "test.db")
    conn.row_factory = sqlite3.Row
    conn.execute(
        """
        CREATE TABLE audiolibros (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            descripcion TEXT,
            genero TEXT,
            autor TEXT,
            categoria_id INTEGER
        )
        """
    )
    conn.commit()
    yield {"type": "sqlite", "conn": conn}
    conn.close()
