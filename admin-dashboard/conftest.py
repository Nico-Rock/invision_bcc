"""Fixtures para los tests del admin-dashboard.

Nada acá toca Azure ni Azure SQL: contenedor falso en memoria y SQLite temporal.
"""
import sqlite3
import pytest


class FakeBlobClient:
    def __init__(self, store, name):
        self.store = store
        self.name = name

    def exists(self):
        return self.name in self.store

    def upload_blob(self, data, overwrite=False, content_type=None, length=None):
        if self.name in self.store and not overwrite:
            raise FileExistsError(self.name)
        contenido = data.read() if hasattr(data, "read") else data
        self.store[self.name] = {
            "content": contenido,
            "content_type": content_type,
            "length": length,
        }


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
