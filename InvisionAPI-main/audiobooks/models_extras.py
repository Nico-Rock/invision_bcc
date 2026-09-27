"""Tablas nuevas que NO se crean solas al arrancar la API (spec 005, R7 y R28).

`main.py` corre `Base.metadata.create_all`: cualquier modelo registrado en `Base`
aparecería en producción con el próximo despliegue, sin aprobación de la BCC
(P12). Por eso estas tablas usan su propia `BaseExtras`. En local se crean con
`scripts/habilitar_extras.py`; en producción, con el DDL aprobado en
`aprobaciones/2026-09-29_narrador_en_memoria.md`.

Tampoco se agrega el narrador como columna de `audiolibros`: toda consulta a esa
tabla la pediría y fallaría en producción, donde no existe (P13).
"""
from sqlalchemy import Boolean, Column, DateTime, Integer, String, inspect
from sqlalchemy.orm import declarative_base
from sqlalchemy.sql import func

BaseExtras = declarative_base()

TABLA_NARRACION = "audiolibro_narracion"


class NarracionAudiolibro(BaseExtras):
    """Narrador de un audiolibro e iniciativa "En Memoria".

    La clave foránea a `audiolibros.id` la declara el DDL de producción; acá no,
    porque `audiolibros` vive en otra metadata. El borrado se hace explícito en la
    ruta de eliminación.
    """
    __tablename__ = TABLA_NARRACION

    audiolibro_id = Column(Integer, primary_key=True)
    narrador = Column(String(200), nullable=True)
    en_memoria = Column(Boolean, nullable=False, default=False)
    actualizado_en = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


def narracion_habilitada(db):
    """True si la base tiene la tabla del narrador. Sin ella, la ficha funciona igual."""
    return inspect(db.get_bind()).has_table(TABLA_NARRACION)
