#!/usr/bin/env python3
"""Crea las tablas nuevas del spec 005 en la base SQLite LOCAL. SOLO PARA DEMO Y DESARROLLO.

    .venv/bin/python InvisionAPI-main/scripts/habilitar_extras.py \\
        --destino InvisionAPI-main/audiobooks/invision.db

Las mismas tablas en producción se crean solo con el DDL aprobado en
`aprobaciones/2026-09-29_narrador_en_memoria.md` (P12). Este script se niega a
cualquier cosa que no sea un archivo SQLite existente en disco.
"""
import argparse
import os
import sqlite3
import sys

DDL_SQLITE = """
CREATE TABLE IF NOT EXISTS audiolibro_narracion (
    audiolibro_id  INTEGER PRIMARY KEY REFERENCES audiolibros(id) ON DELETE CASCADE,
    narrador       VARCHAR(200),
    en_memoria     BOOLEAN NOT NULL DEFAULT 0,
    actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP
)
"""


def habilitar(destino):
    if "://" in destino:
        raise ValueError("El destino tiene que ser un archivo SQLite local, no una URL de base")
    if not os.path.isfile(destino):
        raise ValueError(f"No existe la base local {destino}")
    con = sqlite3.connect(destino)
    try:
        with con:
            con.execute(DDL_SQLITE)
    finally:
        con.close()


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--destino", required=True, help="Archivo SQLite local")
    args = parser.parse_args(argv)
    habilitar(args.destino)
    print(f"Tablas del spec 005 habilitadas en {args.destino} (solo local)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
