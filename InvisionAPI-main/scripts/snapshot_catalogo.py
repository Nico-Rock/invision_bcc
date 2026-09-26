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
import sqlite3
import sys

# Lista blanca, no patrón (T32 de 001): un regex de "empieza con SELECT" dejaba
# pasar "SELECT 1 DELETE FROM ..." (T-SQL admite dos sentencias sin ';') y
# "SELECT ... INTO nueva". Solo se ejecuta exactamente esta consulta.
CONSULTA_CATALOGO = "SELECT id, nombre, descripcion, genero, autor FROM audiolibros ORDER BY id"
CONSULTAS_PERMITIDAS = frozenset({CONSULTA_CATALOGO})


class _CursorSoloLectura:
    def __init__(self, cursor):
        self._cursor = cursor

    def execute(self, sql, params=None):
        if sql.strip() not in CONSULTAS_PERMITIDAS:
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
    cursor.execute(CONSULTA_CATALOGO)
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


def credencial_solo_lectura():
    """Usuario y clave de un login de SOLO LECTURA (R43 de 001, defensa en la
    capa que la hace cumplir: la base, no el script).

    Se niega a usar la credencial de escritura de la API (SQL_USERNAME). Crear
    ese login en Azure SQL es un cambio en producción: va por el PR de
    aprobación `aprobaciones/2026-09-29_login_solo_lectura.md` (P12).
    """
    usuario = os.environ.get("SQL_RO_USERNAME")
    clave = os.environ.get("SQL_RO_PASSWORD")
    if not usuario or not clave:
        raise SystemExit(
            "Faltan SQL_RO_USERNAME y SQL_RO_PASSWORD: la copia del catálogo solo "
            "corre con un login de solo lectura (ver aprobaciones/2026-09-29_login_solo_lectura.md)."
        )
    if usuario == os.environ.get("SQL_USERNAME"):
        raise SystemExit(
            "SQL_RO_USERNAME es la misma credencial de escritura de la API: "
            "la copia del catálogo no corre con permisos de escritura."
        )
    return usuario, clave


def _conectar_produccion():
    import pymssql
    from dotenv import load_dotenv

    raiz = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    load_dotenv(os.path.join(raiz, ".env"))
    usuario, clave = credencial_solo_lectura()
    servidor = os.environ["SQL_SERVER"].replace("tcp:", "").split(",")[0]
    return pymssql.connect(
        server=servidor,
        user=usuario,
        password=clave,
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
