#!/usr/bin/env python3
"""Copia el catálogo de producción a la base SQLite local. SOLO PARA DEMO Y DESARROLLO.

    .venv/bin/python InvisionAPI-main/scripts/snapshot_catalogo.py \\
        --destino InvisionAPI-main/audiobooks/invision.db

Garantías (spec 001, R21, R22, R36):
- A producción solo se le hacen SELECT: la conexión va envuelta en `SoloLectura`,
  que rechaza cualquier otra sentencia antes de mandarla.
- Solo se copian las fichas de `audiolibros`. Nunca `usuarios` ni
  `progreso_audiolibros`: la base local conserva sus cuentas demo.
- No cambia a qué base apunta nada: la API sigue usando Azure SQL salvo que se
  la arranque con DATABASE_URL=sqlite:///invision.db explícito en el comando.
  El audio no se copia: la API local lo sigue leyendo de Azure Blob por nombre.
"""
import argparse
import os
import re
import sqlite3
import sys

_SOLO_SELECT = re.compile(r"^\s*SELECT\b[^;]*;?\s*$", re.IGNORECASE | re.DOTALL)


class _CursorSoloLectura:
    def __init__(self, cursor):
        self._cursor = cursor

    def execute(self, sql, params=None):
        if not _SOLO_SELECT.match(sql):
            raise PermissionError(f"Sentencia no permitida contra producción: {sql[:60]!r}")
        if params is None:
            return self._cursor.execute(sql)
        return self._cursor.execute(sql, params)

    def fetchall(self):
        return self._cursor.fetchall()


class SoloLectura:
    """Envuelve una conexión de producción y solo deja pasar un SELECT por sentencia."""

    def __init__(self, conn):
        self._conn = conn

    def cursor(self, *args, **kwargs):
        return _CursorSoloLectura(self._conn.cursor(*args, **kwargs))


def validar_destino(ruta):
    if "://" in ruta:
        raise ValueError("El destino tiene que ser un archivo SQLite local, no una URL de base")
    if not os.path.isfile(ruta):
        raise ValueError(f"No existe la base local {ruta}: arrancá la API local una vez para crearla")
    return ruta


def copiar_catalogo(conn_prod, ruta_destino):
    """Reemplaza las fichas locales por las de producción. Devuelve cuántas copió."""
    cursor = SoloLectura(conn_prod).cursor()
    cursor.execute("SELECT id, nombre, descripcion, genero, autor FROM audiolibros ORDER BY id")
    filas = [tuple(f) for f in cursor.fetchall()]

    local = sqlite3.connect(ruta_destino)
    try:
        with local:  # una sola transacción: o queda la copia entera o nada
            local.execute("DELETE FROM audiolibros")
            local.executemany(
                "INSERT INTO audiolibros (id, nombre, descripcion, genero, autor) "
                "VALUES (?, ?, ?, ?, ?)",
                filas,
            )
    finally:
        local.close()
    return len(filas)


def _conectar_produccion():
    import pymssql
    from dotenv import load_dotenv

    raiz = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    load_dotenv(os.path.join(raiz, ".env"))
    servidor = os.environ["SQL_SERVER"].replace("tcp:", "").split(",")[0]
    return pymssql.connect(
        server=servidor,
        user=os.environ["SQL_USERNAME"],
        password=os.environ["SQL_PASSWORD"],
        database=os.environ["SQL_DATABASE"],
        login_timeout=10,
    )


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--destino", required=True, help="Archivo SQLite local de destino")
    args = parser.parse_args(argv)

    destino = validar_destino(args.destino)
    prod = _conectar_produccion()
    try:
        total = copiar_catalogo(prod, destino)
    finally:
        prod.close()
    print(f"Catálogo copiado: {total} audiolibros → {destino} (solo lectura sobre producción)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
