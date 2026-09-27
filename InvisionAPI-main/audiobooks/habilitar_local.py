"""Crea las tablas del spec 005 en la base SQLite LOCAL de la demo. Nunca en producción.

    docker exec invision_local python habilitar_local.py
    docker exec invision_local python habilitar_local.py --limpiar-pruebas

Usa los mismos modelos que la API (`BaseExtras`), así el esquema local no se
desincroniza. Se niega a correr si la base configurada no es SQLite: en
producción las tablas se crean solo con el DDL aprobado en
`aprobaciones/2026-09-29_tablas_administracion.md` (P12).
"""
import sys

from models_extras import BaseExtras


def _solo_sqlite(motor):
    if not motor.url.drivername.startswith("sqlite"):
        raise ValueError("Solo se habilita en una base SQLite local; producción va por aprobación de la BCC.")


def limpiar_pruebas(motor):
    """Borra los rastros del arnés automático ("PRUEBA ARNES") del registro y de
    las tareas, para que no aparezcan en una demo. Solo en SQLite local."""
    _solo_sqlite(motor)
    from sqlalchemy.orm import Session
    from models_extras import RegistroOperacion, TareaAdmin
    with Session(bind=motor) as db:
        n = db.query(RegistroOperacion).filter(
            RegistroOperacion.objeto.like("PRUEBA ARNES%")
            | RegistroOperacion.objeto.like("pruebaarnes%")
            | RegistroOperacion.objeto.like("GENERO ARNES%")
        ).delete(synchronize_session=False)
        n += db.query(TareaAdmin).filter(
            TareaAdmin.titulo.like("%PRUEBA ARNES%") | TareaAdmin.detalle.like("%PRUEBA ARNES%")
        ).delete(synchronize_session=False)
        db.commit()
    return n


def habilitar(motor):
    _solo_sqlite(motor)
    BaseExtras.metadata.create_all(bind=motor)
    return sorted(BaseExtras.metadata.tables)


if __name__ == "__main__":
    from database import engine
    try:
        if "--limpiar-pruebas" in sys.argv:
            print(f"Rastros del arnés borrados: {limpiar_pruebas(engine)}")
        else:
            print("Tablas habilitadas en la base local:", ", ".join(habilitar(engine)))
    except ValueError as e:
        print(e)
        sys.exit(1)
