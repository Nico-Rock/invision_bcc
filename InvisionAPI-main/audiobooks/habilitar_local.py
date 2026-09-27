"""Crea las tablas del spec 005 en la base SQLite LOCAL de la demo. Nunca en producción.

    docker exec invision_local python habilitar_local.py

Usa los mismos modelos que la API (`BaseExtras`), así el esquema local no se
desincroniza. Se niega a correr si la base configurada no es SQLite: en
producción las tablas se crean solo con el DDL aprobado en
`aprobaciones/2026-09-29_tablas_administracion.md` (P12).
"""
import sys

from models_extras import BaseExtras


def habilitar(motor):
    if not motor.url.drivername.startswith("sqlite"):
        raise ValueError("Solo se habilita en una base SQLite local; producción va por aprobación de la BCC.")
    BaseExtras.metadata.create_all(bind=motor)
    return sorted(BaseExtras.metadata.tables)


if __name__ == "__main__":
    from database import engine
    try:
        tablas = habilitar(engine)
    except ValueError as e:
        print(e)
        sys.exit(1)
    print("Tablas habilitadas en la base local:", ", ".join(tablas))
